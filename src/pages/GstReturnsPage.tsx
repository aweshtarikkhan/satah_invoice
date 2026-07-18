import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
import { SEO } from "@/components/shared/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download, FileJson, FileSpreadsheet, AlertCircle, Receipt } from "lucide-react";
import {
  buildGstr1Json,
  buildGstr3bSummary,
  buildHsnSummary,
  buildTallySalesCsv,
  downloadJson,
  downloadCsv,
  filterInvoicesForPeriod,
  gstrPeriod,
  type InvoiceForGst,
  type LineForGst,
  type ClientForGst,
  type TaxRateForGst,
} from "@/lib/gst";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function GstReturnsPage() {
  const org = useAppStore((s) => s.organization);
  const now = new Date();
  // Default to previous month (typical filing flow)
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const [year, setYear] = useState<number>(lastMonth.getFullYear());
  const [month, setMonth] = useState<number>(lastMonth.getMonth() + 1);

  const [invoices, setInvoices] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!org?.id) return;
    const load = async () => {
      setLoading(true);
      const [inv, cl, tr, bData] = await Promise.all([
        supabase.from("invoices").select("*").eq("org_id", org.id).neq("status", "void").neq("status", "draft"),
        supabase.from("clients").select("id, display_name, tax_number, billing_address").eq("org_id", org.id),
        supabase.from("tax_rates").select("*").eq("org_id", org.id),
        (supabase as any).from("bills").select("*, vendors(name, gstin, billing_address)").eq("org_id", org.id).neq("status", "void").neq("status", "draft"),
      ]);
      const invs = inv.data || [];
      setInvoices(invs);
      setBills(bData.data || []);
      setClients(cl.data || []);
      setTaxRates(tr.data || []);
      if (invs.length) {
        const ids = invs.map((i) => i.id);
        const { data: ln } = await supabase.from("invoice_lines").select("*").in("invoice_id", ids);
        setLines(ln || []);
      }
      setLoading(false);
    };
    load();
  }, [org?.id]);

  const orgGstin = (org as any)?.tax_number || "";

  const gstInput = useMemo(() => {
    const periodInvoices: InvoiceForGst[] = filterInvoicesForPeriod(invoices as InvoiceForGst[], year, month);
    const periodIds = new Set(periodInvoices.map((i) => i.id));
    const periodLines: LineForGst[] = (lines as LineForGst[]).filter((l) => periodIds.has(l.invoice_id));
    return {
      orgGstin,
      period: { year, month },
      invoices: periodInvoices,
      lines: periodLines,
      clients: clients as ClientForGst[],
      taxRates: taxRates as TaxRateForGst[],
    };
  }, [invoices, lines, clients, taxRates, year, month, orgGstin]);

  const { filteredBills, itcSummary } = useMemo(() => {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);
    
    const fBills = bills.filter((b) => {
      if (!b.bill_date) return false;
      const d = new Date(b.bill_date);
      return d >= start && d <= end;
    });

    let totalPurchases = 0, totalPurchaseTax = 0;
    fBills.forEach(b => {
      totalPurchases += Number(b.subtotal || 0);
      totalPurchaseTax += Number(b.tax_total || 0);
    });
    return { filteredBills: fBills, itcSummary: { totalPurchases, totalPurchaseTax } };
  }, [bills, year, month]);

  const gstr1 = useMemo(() => buildGstr1Json(gstInput), [gstInput]);
  const gstr3b = useMemo(() => buildGstr3bSummary(gstInput), [gstInput]);
  const hsn = useMemo(() => buildHsnSummary(gstInput), [gstInput]);
  const tallyRows = useMemo(() => buildTallySalesCsv(gstInput), [gstInput]);

  const periodLabel = `${MONTHS[month - 1]} ${year}`;
  const fmt = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = now.getFullYear(); y >= now.getFullYear() - 4; y--) arr.push(y);
    return arr;
  }, [now]);

  const totalsBanner = (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card><CardContent className="p-3"><div className="text-[11px] text-muted-foreground uppercase tracking-wider">Invoices</div><div className="text-xl font-bold mt-1">{gstInput.invoices.length}</div></CardContent></Card>
      <Card><CardContent className="p-3"><div className="text-[11px] text-muted-foreground uppercase tracking-wider">Taxable Value</div><div className="text-xl font-bold mt-1">{fmt(gstr3b.total_taxable_value)}</div></CardContent></Card>
      <Card><CardContent className="p-3"><div className="text-[11px] text-muted-foreground uppercase tracking-wider">Total Tax</div><div className="text-xl font-bold mt-1">{fmt(gstr3b.total_tax_payable)}</div></CardContent></Card>
      <Card><CardContent className="p-3"><div className="text-[11px] text-muted-foreground uppercase tracking-wider">Period</div><div className="text-xl font-bold mt-1">{periodLabel}</div></CardContent></Card>
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <SEO title="GST Returns" description="Generate GSTR-1 JSON, GSTR-3B summary, HSN-wise summary and Tally CSV export from your invoices." path="/gst-returns" />
      <PageHeader title="GST Returns" description="Monthly GSTR-1, GSTR-3B, HSN summary and Tally export, ready to file." />

      {!orgGstin && (
        <Card className="border-warning bg-warning/10">
          <CardContent className="flex items-start gap-3 pt-4">
            <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-semibold">Your organisation GSTIN is not set.</div>
              <div className="text-muted-foreground mt-1">Go to Settings and add your GSTIN ("Tax Number") so exports include your registration and split tax correctly between IGST and CGST/SGST.</div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Month</div>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Year</div>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {orgGstin && <div className="ml-auto text-xs text-muted-foreground">GSTIN: <span className="font-mono font-medium text-foreground">{orgGstin}</span></div>}
      </div>

      {totalsBanner}

      <Tabs defaultValue="gstr1">
        <TabsList>
          <TabsTrigger value="gstr1">GSTR-1</TabsTrigger>
          <TabsTrigger value="gstr2b">GSTR-2 (Purchase Register)</TabsTrigger>
          <TabsTrigger value="gstr3b">GSTR-3B</TabsTrigger>
          <TabsTrigger value="hsn">HSN Summary</TabsTrigger>
          <TabsTrigger value="tally">Tally Export</TabsTrigger>
        </TabsList>

        {/* GSTR-1 */}
        <TabsContent value="gstr1" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2"><FileJson className="h-5 w-5" /> Sales Register (GSTR-1)</span>
                <div className="flex gap-2">
                  <Button
                    onClick={() => downloadJson(`GST_Govt_GSTR1_${gstrPeriod(year, month)}.json`, gstr1)}
                    disabled={loading || gstInput.invoices.length === 0}
                  >
                    <Download className="mr-1.5 h-4 w-4" /> Download GST Govt Output (JSON)
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => downloadCsv(`Tally_Output_Sales_${gstrPeriod(year, month)}.csv`, tallyRows)}
                    disabled={loading || tallyRows.length === 0}
                  >
                    <Download className="mr-1.5 h-4 w-4" /> Download Tally Output (CSV)
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Stat label="B2B Buyers" value={gstr1.b2b.length} />
                <Stat label="B2B Invoices" value={gstr1.b2b.reduce((s, b) => s + b.inv.length, 0)} />
                <Stat label="B2CS Rows" value={gstr1.b2cs.length} />
                <Stat label="HSN Rows" value={gstr1.hsn.data.length} />
              </div>
              <div className="text-xs text-muted-foreground border-t pt-3">
                Upload this file in the GST portal's Returns Offline Tool to file GSTR-1 for {periodLabel}. Includes B2B (with buyer GSTIN), B2CS (aggregated by state and rate), and HSN summary sections.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* GSTR-2 / Purchase Register */}
        <TabsContent value="gstr2b" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> GSTR-2 (Purchase Register)</span>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      const data = filteredBills.map(b => ({
                        "GSTIN of Supplier": b.vendors?.gstin || "",
                        "Trade/Legal Name": b.vendors?.name || "Unknown",
                        "Invoice Number": b.vendor_bill_number || b.bill_number,
                        "Invoice Date": b.bill_date || "",
                        "Invoice Value": Number(b.total || 0).toFixed(2),
                        "Taxable Value": Number(b.subtotal || 0).toFixed(2),
                        "Integrated Tax (₹)": Number(b.tax_total || 0).toFixed(2),
                        "Central Tax (₹)": "0.00",
                        "State/UT Tax (₹)": "0.00",
                        "Cess (₹)": "0.00"
                      }));
                      downloadCsv(`GST_Govt_Purchase_Register_${periodLabel.replace(" ", "_")}.csv`, data);
                    }}
                    disabled={filteredBills.length === 0}
                  >
                    <Download className="mr-1.5 h-4 w-4" /> Download GST Govt Output
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const data = filteredBills.map(b => ({
                        "Voucher Date": b.bill_date || "",
                        "Voucher Number": b.vendor_bill_number || b.bill_number,
                        "Party Name": b.vendors?.name || "Unknown",
                        "Party GSTIN": b.vendors?.gstin || "",
                        "Purchase Ledger": "Purchase Accounts",
                        "Taxable Amount": Number(b.subtotal || 0).toFixed(2),
                        "Tax Amount": Number(b.tax_total || 0).toFixed(2),
                        "Total Amount": Number(b.total || 0).toFixed(2),
                      }));
                      downloadCsv(`Tally_Output_Purchases_${periodLabel.replace(" ", "_")}.csv`, data);
                    }}
                    disabled={filteredBills.length === 0}
                  >
                    <Download className="mr-1.5 h-4 w-4" /> Download Tally Output
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Stat label="Total Bills" value={filteredBills.length} />
                <Stat label="Taxable Value" value={fmt(itcSummary.totalPurchases)} />
                <Stat label="ITC Available" value={fmt(itcSummary.totalPurchaseTax)} />
              </div>
              <div className="text-xs text-muted-foreground border-t pt-3">
                Download this report to match against GSTR-2B from the GST portal to claim Input Tax Credit (ITC). Includes all bills dated in this period.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* GSTR-3B */}
        <TabsContent value="gstr3b" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> GSTR-3B Summary — {periodLabel}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px] uppercase tracking-wider">Particulars</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <Row label="3.1(a) Outward taxable supplies (other than zero/nil/exempt)" value={fmt(gstr3b["3.1(a)_outward_taxable"])} />
                  <Row label="3.1(c) Other outward (Nil rated, exempt)" value={fmt(gstr3b["3.1(c)_nil_exempt"])} />
                  <Row label="Total taxable value" value={fmt(gstr3b.total_taxable_value)} bold />
                  <Row label="Integrated Tax (IGST)" value={fmt(gstr3b.integrated_tax_igst)} />
                  <Row label="Central Tax (CGST)" value={fmt(gstr3b.central_tax_cgst)} />
                  <Row label="State Tax (SGST)" value={fmt(gstr3b.state_tax_sgst)} />
                  <Row label="Total tax payable (Output)" value={fmt(gstr3b.total_tax_payable)} bold />
                  <Row label="4(A) ITC Available (All other ITC)" value={fmt(itcSummary.totalPurchaseTax)} bold />
                  <Row label="Net Tax Payable" value={fmt(Math.max(0, gstr3b.total_tax_payable - itcSummary.totalPurchaseTax))} bold />
                </TableBody>
              </Table>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => downloadCsv(`Tally_Output_GSTR3B_${gstrPeriod(year, month)}.csv`, [
                  { particulars: "3.1(a) Outward taxable", amount: gstr3b["3.1(a)_outward_taxable"] },
                  { particulars: "3.1(c) Nil/Exempt", amount: gstr3b["3.1(c)_nil_exempt"] },
                  { particulars: "Total taxable value", amount: gstr3b.total_taxable_value },
                  { particulars: "IGST", amount: gstr3b.integrated_tax_igst },
                  { particulars: "CGST", amount: gstr3b.central_tax_cgst },
                  { particulars: "SGST", amount: gstr3b.state_tax_sgst },
                  { particulars: "Total tax payable", amount: gstr3b.total_tax_payable },
                  { particulars: "ITC Available", amount: itcSummary.totalPurchaseTax },
                  { particulars: "Net Tax Payable", amount: Math.max(0, gstr3b.total_tax_payable - itcSummary.totalPurchaseTax) },
                ])}>
                  <Download className="mr-1.5 h-4 w-4" /> Download Tally Output
                </Button>
                <Button onClick={() => downloadCsv(`GST_Govt_GSTR3B_${gstrPeriod(year, month)}.csv`, [
                  { particulars: "3.1(a) Outward taxable", amount: gstr3b["3.1(a)_outward_taxable"] },
                  { particulars: "3.1(c) Nil/Exempt", amount: gstr3b["3.1(c)_nil_exempt"] },
                  { particulars: "Total taxable value", amount: gstr3b.total_taxable_value },
                  { particulars: "IGST", amount: gstr3b.integrated_tax_igst },
                  { particulars: "CGST", amount: gstr3b.central_tax_cgst },
                  { particulars: "SGST", amount: gstr3b.state_tax_sgst },
                  { particulars: "Total tax payable", amount: gstr3b.total_tax_payable },
                  { particulars: "ITC Available", amount: itcSummary.totalPurchaseTax },
                  { particulars: "Net Tax Payable", amount: Math.max(0, gstr3b.total_tax_payable - itcSummary.totalPurchaseTax) },
                ])}>
                  <Download className="mr-1.5 h-4 w-4" /> Download GST Govt Output
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HSN Summary */}
        <TabsContent value="hsn" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> HSN-wise Summary — {periodLabel}</span>
                <Button
                  variant="outline"
                  onClick={() => downloadCsv(`HSN_Summary_${gstrPeriod(year, month)}.csv`, hsn)}
                  disabled={hsn.length === 0}
                >
                  <Download className="mr-1.5 h-4 w-4" /> Export CSV
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hsn.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">No invoices in this period.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[11px] uppercase tracking-wider">HSN/SAC</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Description</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">UQC</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-right">Qty</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-right">Rate%</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-right">Taxable</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-right">IGST</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-right">CGST</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-right">SGST</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hsn.map((h, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{h.hsn_sc || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-sm">{h.desc}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{h.uqc}</TableCell>
                        <TableCell className="text-right text-sm">{h.qty}</TableCell>
                        <TableCell className="text-right text-sm">{h.rt}%</TableCell>
                        <TableCell className="text-right text-sm">{fmt(h.txval)}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(h.iamt)}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(h.camt)}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(h.samt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tally Export */}
        <TabsContent value="tally" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> Tally Sales Voucher CSV</span>
                <Button
                  onClick={() => downloadCsv(`Tally_Sales_${gstrPeriod(year, month)}.csv`, tallyRows)}
                  disabled={tallyRows.length === 0}
                >
                  <Download className="mr-1.5 h-4 w-4" /> Download CSV
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Stat label="Sales lines" value={tallyRows.length} />
                <Stat label="Invoices" value={gstInput.invoices.length} />
              </div>
              <div className="text-xs text-muted-foreground border-t pt-3">
                One row per invoice line — includes voucher date, party, GSTIN, HSN, qty, rate, taxable value, GST split (IGST/CGST/SGST), and total. Import into Tally Prime via "Import Data → Vouchers (CSV)".
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-base font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <TableRow className={bold ? "bg-muted/40" : ""}>
      <TableCell className={bold ? "font-semibold" : ""}>{label}</TableCell>
      <TableCell className={`text-right font-mono ${bold ? "font-semibold" : ""}`}>{value}</TableCell>
    </TableRow>
  );
}
