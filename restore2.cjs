const fs = require('fs');
let content = fs.readFileSync('src/lib/gst.ts', 'utf-8');

// 1. Fix lineTaxSplit (amount calculation)
content = content.replace(
  /const txval = Number\(line\.amount \|\| 0\);\s*const totalTax = Number\(line\.tax_amount \|\| 0\);/g,
  `const totalTax = Number(line.tax_amount || 0);\n  const txval = Number(line.amount || 0) - totalTax;`
);

// 2. Fix HSN empty issue
content = content.replace(
  /const hsnKey = `\$\{\(ln\.hsn_code \|\| ""\)\.trim\(\) \|\| "—"\}\|\$\{split\.rt\}`;[\s\S]*?desc: ln\.name,/g,
  `const hsnCode = (ln.hsn_code || "").trim() || "9954";
      const hsnKey = \`\${hsnCode}|\${split.rt}\`;
      const h = hsnMap[hsnKey] || {
        hsn_sc: hsnCode,
        desc: ln.name?.split("\\n")[0] || hsnCode,`
);

// 3. Append missing GSTR-2 and Tax Breakdown functions
const newFunctions = `

export function buildGstr2Json(input: {
  orgGstin: string;
  period: { year: number; month: number };
  bills: any[];
  lines?: any[];
  billLines?: any[];
  taxRates?: any[];
}) {
  const { orgGstin, bills, taxRates, period } = input;
  const lines = input.lines || input.billLines || [];
  const orgState = stateCodeFromGstin(orgGstin);

  const linesByBill: Record<string, any[]> = {};
  lines.forEach((l) => {
    (linesByBill[l.bill_id] = linesByBill[l.bill_id] || []).push(l);
  });

  const b2bMap: Record<string, any[]> = {};
  const b2burList: any[] = [];
  const hsnMap: Record<string, any> = {};

  let totalPurchaseValue = 0;

  for (const bill of bills) {
    const vGstin = (bill.vendors?.gstin || "").trim();
    const vState = stateCodeFromGstin(vGstin) || (bill.vendors?.billing_address as any)?.state_code;
    const interstate = !!(orgState && vState && orgState !== vState);
    const pos = vState || orgState || "00";
    const billLinesArr = linesByBill[bill.id] || [];

    totalPurchaseValue += Number(bill.total || 0);

    const itms: any[] = [];
    let invoiceHasTax = false;

    for (let i = 0; i < billLinesArr.length; i++) {
      const ln = billLinesArr[i];
      const q = Number(ln.quantity) || 0;
      const r = Number(ln.rate) || 0;
      let rt = Number(ln.tax_rate || 0);
      
      const txval = q * r; // base taxable value is always qty * rate
      
      let totalTax = Number(ln.tax_amount || 0);
      if (totalTax === 0 && rt > 0 && txval > 0) {
        totalTax = txval * (rt / 100);
      } else if (rt === 0 && totalTax > 0 && txval > 0) {
        // fallback deduction for old bills where tax_rate wasn't saved
        rt = Math.round((totalTax / txval) * 100);
      }

      if (totalTax > 0) invoiceHasTax = true;

      const iamt = interstate ? totalTax : 0;
      const camt = interstate ? 0 : totalTax / 2;
      const samt = interstate ? 0 : totalTax / 2;
      const csamt = 0;

      const hsnCode = (ln.hsn || "").trim() || "9954";
      
      itms.push({
        num: i + 1,
        itm_det: {
          hsn_sc: hsnCode,
          rt,
          txval: r2(txval),
          iamt: r2(iamt),
          camt: r2(camt),
          samt: r2(samt),
          csamt: r2(csamt),
        }
      });

      const hsnKey = \`\${hsnCode}|\${rt}\`;
      const h = hsnMap[hsnKey] || {
        hsn_sc: hsnCode,
        desc: ln.description?.split("\\n")[0] || hsnCode,
        uqc: (ln.unit || "OTH").toUpperCase().slice(0, 3),
        qty: 0, txval: 0, rt, iamt: 0, camt: 0, samt: 0, csamt: 0,
      };
      h.qty += Number(ln.quantity || 0);
      h.txval += txval;
      h.iamt += iamt;
      h.camt += camt;
      h.samt += samt;
      hsnMap[hsnKey] = h;
    }

    const billObj = {
      inum: bill.vendor_bill_number || bill.bill_number,
      idt: gstrDate(bill.bill_date),
      val: r2(Number(bill.total || 0)),
      pos,
      rchrg: "N",
      inv_typ: "R",
      itms,
    };

    const isGstinValid = vGstin && /^[0-9A-Z]{15}$/.test(vGstin);
    if (isGstinValid) {
      (b2bMap[vGstin] = b2bMap[vGstin] || []).push(billObj);
    } else if (invoiceHasTax) {
      b2burList.push({
        inv: [billObj]
      });
    }
  }

  const b2b = Object.entries(b2bMap).map(([ctin, inv]) => ({ ctin, inv }));
  const hsn = {
    data: Object.values(hsnMap).map((h, i) => ({
      num: i + 1,
      hsn_sc: h.hsn_sc,
      desc: h.desc,
      uqc: h.uqc,
      qty: r2(h.qty),
      rt: h.rt,
      txval: r2(h.txval),
      iamt: r2(h.iamt),
      camt: r2(h.camt),
      samt: r2(h.samt),
      csamt: r2(h.csamt),
    })),
  };

  return {
    gstin: orgGstin,
    fp: gstrPeriod(period.year, period.month),
    gt: r2(totalPurchaseValue),
    cur_gt: r2(totalPurchaseValue),
    b2b,
    b2bur: b2burList,
    hsn,
  };
}

export function calculateTaxBreakdown(
  lines: { tax_id?: string | null, tax_rate?: number | null, tax_amount: number, amount?: number }[],
  taxRates: { id: string, rate: number }[],
  isInterstate: boolean
) {
  const taxBreakdownMap: Record<string, { id: string, name: string, rate: number, amount: number }> = {};

  lines.forEach(line => {
    if (line.tax_amount > 0) {
      let rate = 0;
      if (line.tax_rate) {
        rate = Number(line.tax_rate);
      } else if (line.tax_id) {
        const tax = taxRates.find((t: any) => t.id === line.tax_id);
        if (tax) rate = Number(tax.rate);
      } else if (line.amount) {
        const taxableAmount = line.amount - line.tax_amount;
        if (taxableAmount > 0) {
          rate = Math.round((line.tax_amount / taxableAmount) * 100);
        }
      }
      
      if (rate > 0) {
        if (isInterstate) {
          const key = \`IGST_\${rate}\`;
          if (!taxBreakdownMap[key]) taxBreakdownMap[key] = { id: key, name: \`IGST @ \${rate}%\`, rate, amount: 0 };
          taxBreakdownMap[key].amount += line.tax_amount;
        } else {
          const cgstKey = \`CGST_\${rate/2}\`;
          const sgstKey = \`SGST_\${rate/2}\`;
          if (!taxBreakdownMap[cgstKey]) taxBreakdownMap[cgstKey] = { id: cgstKey, name: \`CGST @ \${rate/2}%\`, rate: rate/2, amount: 0 };
          if (!taxBreakdownMap[sgstKey]) taxBreakdownMap[sgstKey] = { id: sgstKey, name: \`SGST @ \${rate/2}%\`, rate: rate/2, amount: 0 };
          taxBreakdownMap[cgstKey].amount += line.tax_amount / 2;
          taxBreakdownMap[sgstKey].amount += line.tax_amount / 2;
        }
      }
    }
  });

  return Object.values(taxBreakdownMap);
}
`;

content += newFunctions;
fs.writeFileSync('src/lib/gst.ts', content);
console.log('Restored fully!');
