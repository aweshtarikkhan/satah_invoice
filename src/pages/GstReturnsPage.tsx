import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
import { SEO } from "@/components/shared/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download, FileJson, FileSpreadsheet, AlertCircle, Receipt, FileText, IndianRupee, Percent, CalendarDays, Copy } from "lucide-react";
import {
  buildGstr1Json,
  buildGstr3bSummary,
  buildHsnSummary,
  buildTallySalesCsv,
  buildGstr2Json,
  downloadJson,
  downloadCsv,
  filterInvoicesForPeriod,
  gstrPeriod,
  stateCodeFromGstin,
  lineTaxSplit,
  type InvoiceForGst,
  type LineForGst,
  type ClientForGst,
  type TaxRateForGst,
} from "@/lib/gst";
import { format, addDays, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, subQuarters } from "date-fns";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function GstReturnsPage() {
  const org = useAppStore((s) => s.organization);
  const now = new Date();
  
  const [filterType, setFilterType] = useState("this_month");
  const [startDate, setStartDate] = useState(() => format(startOfMonth(now), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(() => format(endOfMonth(now), "yyyy-MM-dd"));

  const [invoices, setInvoices] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);
  const [billLines, setBillLines] = useState<any[]>([]);
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
        (supabase as any).from("bills").select("*, vendors(id, name, gstin, billing_address)").eq("org_id", org.id).neq("status", "cancelled").neq("status", "draft"),
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
      const billsData = bData.data || [];
      setBills(billsData);
      if (billsData.length) {
        const bIds = billsData.map((b: any) => b.id);
        const { data: bLines } = await (supabase as any).from("bill_lines").select("*").in("bill_id", bIds);
        setBillLines(bLines || []);
      }
      setLoading(false);
    };
    load();
  }, [org?.id]);

  const orgGstin = (org as any)?.gst_number || (org as any)?.tax_number || "";

  const gstInput = useMemo(() => {
    const sDate = new Date(`${startDate}T00:00:00`);
    const eDate = new Date(`${endDate}T23:59:59`);
    
    const periodInvoices = (invoices as InvoiceForGst[]).filter((inv) => {
      if (!inv.issue_date) return false;
      const d = new Date(inv.issue_date);
      return d >= sDate && d <= eDate;
    });

    const periodIds = new Set(periodInvoices.map((i) => i.id));
    const periodLines: LineForGst[] = (lines as LineForGst[]).filter((l) => periodIds.has(l.invoice_id));
    
    const repYear = eDate.getFullYear();
    const repMonth = eDate.getMonth() + 1;

    return {
      orgGstin,
      period: { year: repYear, month: repMonth },
      invoices: periodInvoices,
      lines: periodLines,
      clients: clients as ClientForGst[],
      taxRates: taxRates as TaxRateForGst[],
    };
  }, [invoices, lines, clients, taxRates, startDate, endDate, orgGstin]);

  const { filteredBills, itcSummary } = useMemo(() => {
    const sDate = new Date(`${startDate}T00:00:00`);
    const eDate = new Date(`${endDate}T23:59:59`);
    
    const fBills = bills.filter((b) => {
      if (!b.bill_date) return false;
      const d = new Date(b.bill_date);
      return d >= sDate && d <= eDate;
    });

    let totalPurchases = 0, totalPurchaseTax = 0;
    fBills.forEach(b => {
      totalPurchases += Number(b.subtotal || 0);
      totalPurchaseTax += Number(b.tax_total || 0);
    });
    return { filteredBills: fBills, itcSummary: { totalPurchases, totalPurchaseTax } };
  }, [bills, startDate, endDate]);

  const gstr2Input = useMemo(() => {
    const sDate = new Date(`${startDate}T00:00:00`);
    const eDate = new Date(`${endDate}T23:59:59`);
    const repYear = eDate.getFullYear();
    const repMonth = eDate.getMonth() + 1;

    return {
      orgGstin,
      period: { year: repYear, month: repMonth },
      bills: filteredBills,
      billLines: billLines.filter(bl => filteredBills.some(b => b.id === bl.bill_id)),
    };
  }, [filteredBills, billLines, orgGstin, startDate, endDate]);

  const { gstr2, gstr2Error } = useMemo(() => {
    try {
      return { gstr2: buildGstr2Json(gstr2Input), gstr2Error: null };
    } catch (err: any) {
      return { gstr2: null, gstr2Error: err.message };
    }
  }, [gstr2Input]);

  const gstr1 = useMemo(() => buildGstr1Json(gstInput), [gstInput]);
  const gstr3b = useMemo(() => buildGstr3bSummary(gstInput), [gstInput]);
  const hsn = useMemo(() => buildHsnSummary(gstInput), [gstInput]);
  const tallyRows = useMemo(() => buildTallySalesCsv(gstInput), [gstInput]);

  const gstr1InvoiceRows = useMemo(() => {
    const rows: any[] = [];
    if (!gstInput) return rows;
    
    const orgState = stateCodeFromGstin(gstInput.orgGstin);

    gstInput.invoices.forEach(inv => {
      const client = gstInput.clients.find(c => c.id === inv.client_id);
      const cGstin = client?.tax_number?.trim();
      const cState = stateCodeFromGstin(cGstin) || (client?.billing_address as any)?.state_code;
      const isInterstate = orgState && cState && orgState !== cState;
      
      const isB2B = !!cGstin;
      const txType = isB2B ? "B2B" : "B2CS";

      const invLines = gstInput.lines.filter(l => l.invoice_id === inv.id);

      let taxable = 0;
      let cgst = 0;
      let sgst = 0;
      let igst = 0;
      let total = 0;

      invLines.forEach(line => {
        const taxSplit = lineTaxSplit(line, gstInput.taxRates, !!isInterstate);
        taxable += (line.amount || 0);
        cgst += (taxSplit.camt || 0);
        sgst += (taxSplit.samt || 0);
        igst += (taxSplit.iamt || 0);
        total += (line.amount || 0) + (line.tax_amount || 0);
      });

      if (invLines.length > 0) {
        rows.push({
          id: inv.id,
          date: inv.issue_date,
          invoiceNo: inv.invoice_number,
          partyName: client?.display_name || "Cash",
          txType,
          gstin: cGstin || "",
          taxable,
          cgst,
          sgst,
          igst,
          total
        });
      }
    });
    
    return rows.sort((a, b) => a.date.localeCompare(b.date));
  }, [gstInput]);

  const periodLabel = filterType === "custom" 
    ? `${format(new Date(startDate), "dd MMM")} to ${format(new Date(endDate), "dd MMM yyyy")}` 
    : filterType.replace("_", " ").toUpperCase();
    
  const fmt = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleFilterChange = (val: string) => {
    setFilterType(val);
    const t = new Date();
    if (val === "this_month") {
      setStartDate(format(startOfMonth(t), "yyyy-MM-dd"));
      setEndDate(format(endOfMonth(t), "yyyy-MM-dd"));
    } else if (val === "last_month") {
      setStartDate(format(startOfMonth(subMonths(t, 1)), "yyyy-MM-dd"));
      setEndDate(format(endOfMonth(subMonths(t, 1)), "yyyy-MM-dd"));
    } else if (val === "this_quarter") {
      setStartDate(format(startOfQuarter(t), "yyyy-MM-dd"));
      setEndDate(format(endOfQuarter(t), "yyyy-MM-dd"));
    } else if (val === "last_quarter") {
      setStartDate(format(startOfQuarter(subQuarters(t, 1)), "yyyy-MM-dd"));
      setEndDate(format(endOfQuarter(subQuarters(t, 1)), "yyyy-MM-dd"));
    }
  };

  const totalsBanner = (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="rounded-xl shadow-sm border-muted">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
            <FileText className="h-7 w-7" />
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Invoices</div>
            <div className="text-2xl font-bold text-foreground">{gstInput.invoices.length}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Total Invoices</div>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-xl shadow-sm border-muted">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0">
            <IndianRupee className="h-7 w-7" />
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Taxable Value</div>
            <div className="text-2xl font-bold text-foreground">{fmt(gstr3b.total_taxable_value)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Total Taxable Value</div>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-xl shadow-sm border-muted">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-orange-50 text-orange-400 flex items-center justify-center shrink-0">
            <Percent className="h-7 w-7" />
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Total Tax</div>
            <div className="text-2xl font-bold text-foreground">{fmt(gstr3b.total_tax_payable)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Total Tax Amount</div>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-xl shadow-sm border-muted">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0">
            <CalendarDays className="h-7 w-7" />
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Period</div>
            <div className="text-lg font-bold text-foreground leading-tight max-w-[120px] truncate">{periodLabel}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Selected Period</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="p-6 space-y-8 max-w-[1400px] mx-auto bg-slate-50/50 min-h-screen">
      <SEO title="GST Returns" description="Generate GSTR-1 JSON, GSTR-3B summary, HSN-wise summary and Tally CSV export from your invoices." path="/gst-returns" />
      
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <FileText className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">GST Returns</h1>
            <p className="text-sm text-muted-foreground mt-1">Monthly GSTR-1, GSTR-3B, HSN summary and Tally export, ready to file.</p>
          </div>
        </div>
        {orgGstin && (
          <div className="flex items-center gap-2 px-4 py-2 border rounded-full bg-background shadow-sm h-10">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">GSTIN:</span>
            <span className="font-mono font-bold text-sm text-foreground">{orgGstin}</span>
            <button className="text-muted-foreground hover:text-foreground ml-2 transition-colors" onClick={() => navigator.clipboard.writeText(orgGstin)} title="Copy GSTIN">
              <Copy className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {!orgGstin && (
        <Card className="border-warning bg-warning/10 shadow-none">
          <CardContent className="flex items-start gap-3 pt-4">
            <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-semibold">Your organisation GSTIN is not set.</div>
              <div className="text-muted-foreground mt-1">Go to Settings and add your GSTIN ("Tax Number") so exports include your registration and split tax correctly between IGST and CGST/SGST.</div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <div className="text-[12px] text-muted-foreground">Date Range</div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 px-4 py-2 border rounded-xl bg-background shadow-sm h-11 w-72">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <span className="flex-1 text-sm font-medium">{format(new Date(startDate), "d MMM yyyy")} – {format(new Date(endDate), "d MMM yyyy")}</span>
          </div>
          
          <div className="flex items-center p-1 border rounded-xl bg-background shadow-sm h-11">
            {["this_month", "last_month", "this_quarter", "last_quarter", "custom"].map((val) => (
              <button
                key={val}
                onClick={() => handleFilterChange(val)}
                className={`px-5 py-1.5 text-sm rounded-lg transition-colors ${filterType === val ? "bg-blue-600 text-white font-medium shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
              >
                {val === "this_month" ? "This Month" : val === "last_month" ? "Last Month" : val === "this_quarter" ? "This Quarter" : val === "last_quarter" ? "Last Quarter" : "Custom Range"}
              </button>
            ))}
          </div>

          {filterType === "custom" && (
            <div className="flex items-center gap-2">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36 h-11 rounded-xl" />
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36 h-11 rounded-xl" />
            </div>
          )}
        </div>
      </div>

      {totalsBanner}

      <Tabs defaultValue="gstr1" className="w-full">
        <TabsList className="bg-transparent border-b w-full justify-start h-auto p-0 rounded-none mb-6 space-x-8">
          <TabsTrigger value="gstr1" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none bg-transparent px-1 py-3 text-sm font-medium text-muted-foreground hover:text-foreground">GSTR-1</TabsTrigger>
          <TabsTrigger value="gstr2b" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none bg-transparent px-1 py-3 text-sm font-medium text-muted-foreground hover:text-foreground">GSTR-2 (Purchase Register)</TabsTrigger>
          <TabsTrigger value="gstr3b" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none bg-transparent px-1 py-3 text-sm font-medium text-muted-foreground hover:text-foreground">GSTR-3B</TabsTrigger>
          <TabsTrigger value="hsn" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none bg-transparent px-1 py-3 text-sm font-medium text-muted-foreground hover:text-foreground">HSN Summary</TabsTrigger>
          <TabsTrigger value="tally" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none bg-transparent px-1 py-3 text-sm font-medium text-muted-foreground hover:text-foreground">Tally Export</TabsTrigger>
        </TabsList>

        {/* GSTR-1 */}
        <TabsContent value="gstr1" className="space-y-4">
          <Card className="shadow-sm border-muted">
            <CardHeader className="pb-6">
              <CardTitle className="text-2xl flex items-center justify-between font-bold">
                <span className="flex items-center gap-2"><FileJson className="h-6 w-6 text-blue-600" /> Sales Register (GSTR-1)</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    onClick={() => downloadJson(`GST_Govt_GSTR1_${gstrPeriod(gstInput.period.year, gstInput.period.month)}.json`, gstr1)}
                    disabled={loading || gstInput.invoices.length === 0}
                  >
                    <Download className="mr-2 h-4 w-4" /> Download JSON
                  </Button>
                  <Button
                    variant="outline"
                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    onClick={() => downloadCsv(`Tally_Output_Sales_${gstrPeriod(gstInput.period.year, gstInput.period.month)}.csv`, tallyRows)}
                    disabled={loading || tallyRows.length === 0}
                  >
                    <Download className="mr-2 h-4 w-4" /> Download CSV
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

          <Card className="shadow-sm border-muted mt-6">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold">Detailed Sales (Invoice-wise)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-transparent border-b border-border/50">
                    <TableRow className="border-none hover:bg-transparent">
                      <TableHead className="text-blue-600 font-bold uppercase tracking-wider text-xs whitespace-nowrap">Date</TableHead>
                      <TableHead className="text-blue-600 font-bold uppercase tracking-wider text-xs whitespace-nowrap">Invoice No.</TableHead>
                      <TableHead className="text-blue-600 font-bold uppercase tracking-wider text-xs whitespace-nowrap">Party Name</TableHead>
                      <TableHead className="text-blue-600 font-bold uppercase tracking-wider text-xs whitespace-nowrap">Type</TableHead>
                      <TableHead className="text-blue-600 font-bold uppercase tracking-wider text-xs whitespace-nowrap">GSTIN/UIN</TableHead>
                      <TableHead className="text-blue-600 font-bold uppercase tracking-wider text-xs text-right whitespace-nowrap">Taxable</TableHead>
                      <TableHead className="text-blue-600 font-bold uppercase tracking-wider text-xs text-right whitespace-nowrap">CGST</TableHead>
                      <TableHead className="text-blue-600 font-bold uppercase tracking-wider text-xs text-right whitespace-nowrap">SGST</TableHead>
                      <TableHead className="text-blue-600 font-bold uppercase tracking-wider text-xs text-right whitespace-nowrap">IGST</TableHead>
                      <TableHead className="text-blue-600 font-bold uppercase tracking-wider text-xs text-right whitespace-nowrap">Total Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gstr1InvoiceRows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="whitespace-nowrap">{r.date}</TableCell>
                        <TableCell className="whitespace-nowrap font-medium">
                          <Link to={`/invoices/${r.id}`} className="text-blue-600 hover:underline">{r.invoiceNo}</Link>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{r.partyName}</TableCell>
                        <TableCell>{r.txType}</TableCell>
                        <TableCell className="whitespace-nowrap">{r.gstin}</TableCell>
                        <TableCell className="text-right">{fmt(r.taxable)}</TableCell>
                        <TableCell className="text-right">{fmt(r.cgst)}</TableCell>
                        <TableCell className="text-right">{fmt(r.sgst)}</TableCell>
                        <TableCell className="text-right">{fmt(r.igst)}</TableCell>
                        <TableCell className="text-right font-bold">{fmt(r.total)}</TableCell>
                      </TableRow>
                    ))}
                    {gstr1InvoiceRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-6 text-muted-foreground">
                          No sales data found for this period.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* GSTR-2 / Purchase Register */}
        <TabsContent value="gstr2b" className="space-y-4">
          <Card className="shadow-sm border-muted">
            <CardHeader className="pb-6">
              <CardTitle className="text-2xl flex items-center justify-between font-bold">
                <span className="flex items-center gap-2"><FileSpreadsheet className="h-6 w-6 text-blue-600" /> GSTR-2 (Purchase Register)</span>
                <div className="flex gap-2">
                  {gstr2Error && <span className="text-sm font-medium text-red-500 self-center truncate max-w-sm" title={gstr2Error}>{gstr2Error}</span>}
                  <Button
                    variant="outline"
                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    onClick={() => {
                      if (gstr2) downloadJson(`GST_Govt_Purchase_Register_${periodLabel.replace(" ", "_")}.json`, gstr2);
                    }}
                    disabled={filteredBills.length === 0 || !!gstr2Error}
                  >
                    <Download className="mr-2 h-4 w-4" /> Download JSON
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

          <Card className="shadow-sm border-muted mt-6">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold">Detailed Purchases (Bill-wise)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-transparent border-b border-border/50">
                    <TableRow className="border-none hover:bg-transparent">
                      <TableHead className="text-blue-600 font-bold uppercase tracking-wider text-xs whitespace-nowrap">Date</TableHead>
                      <TableHead className="text-blue-600 font-bold uppercase tracking-wider text-xs whitespace-nowrap">Bill No.</TableHead>
                      <TableHead className="text-blue-600 font-bold uppercase tracking-wider text-xs whitespace-nowrap">Vendor Name</TableHead>
                      <TableHead className="text-blue-600 font-bold uppercase tracking-wider text-xs whitespace-nowrap">Type</TableHead>
                      <TableHead className="text-blue-600 font-bold uppercase tracking-wider text-xs whitespace-nowrap">GSTIN/UIN</TableHead>
                      <TableHead className="text-blue-600 font-bold uppercase tracking-wider text-xs text-right whitespace-nowrap">Taxable Value</TableHead>
                      <TableHead className="text-blue-600 font-bold uppercase tracking-wider text-xs text-right whitespace-nowrap">CGST</TableHead>
                      <TableHead className="text-blue-600 font-bold uppercase tracking-wider text-xs text-right whitespace-nowrap">SGST</TableHead>
                      <TableHead className="text-blue-600 font-bold uppercase tracking-wider text-xs text-right whitespace-nowrap">IGST</TableHead>
                      <TableHead className="text-blue-600 font-bold uppercase tracking-wider text-xs text-right whitespace-nowrap">Total Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBills.map((b, i) => {
                      const vGstin = b.vendors?.gstin?.trim();
                      const vState = stateCodeFromGstin(vGstin) || (b.vendors?.billing_address as any)?.state_code;
                      const isInterstate = gstInput?.orgGstin ? (stateCodeFromGstin(gstInput.orgGstin) !== vState) : false;
                      const taxTotal = Number(b.tax_total || 0);
                      const cgst = isInterstate ? 0 : taxTotal / 2;
                      const sgst = isInterstate ? 0 : taxTotal / 2;
                      const igst = isInterstate ? taxTotal : 0;
                      const isB2B = !!vGstin;
                      const txType = isB2B ? "B2B" : "B2CS";

                      return (
                        <TableRow key={b.id || i}>
                          <TableCell className="whitespace-nowrap">{b.bill_date}</TableCell>
                          <TableCell className="whitespace-nowrap font-medium">
                            <Link to={`/bills/${b.id}`} className="text-blue-600 hover:underline">{b.vendor_bill_number || b.bill_number}</Link>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{b.vendors?.name || "—"}</TableCell>
                          <TableCell>{txType}</TableCell>
                          <TableCell className="whitespace-nowrap">{vGstin || "—"}</TableCell>
                          <TableCell className="text-right">{fmt(b.subtotal)}</TableCell>
                          <TableCell className="text-right">{fmt(cgst)}</TableCell>
                          <TableCell className="text-right">{fmt(sgst)}</TableCell>
                          <TableCell className="text-right">{fmt(igst)}</TableCell>
                          <TableCell className="text-right font-bold">{fmt(b.total)}</TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredBills.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-6 text-muted-foreground">
                          No purchase bills found for this period.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* GSTR-3B */}
        <TabsContent value="gstr3b" className="space-y-4">
          <Card className="shadow-sm border-muted">
            <CardHeader className="flex flex-row items-center justify-between pb-6">
              <CardTitle className="text-2xl flex items-center gap-2 text-foreground font-bold">
                <Receipt className="h-6 w-6 text-blue-600" /> GSTR-3B Summary — {periodLabel}
              </CardTitle>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                  onClick={() => downloadCsv(`GST_Govt_GSTR3B_${gstrPeriod(gstInput.period.year, gstInput.period.month)}.csv`, [
                    { particulars: "3.1(a) Outward taxable", amount: gstr3b["3.1(a)_outward_taxable"] },
                    { particulars: "3.1(c) Nil/Exempt", amount: gstr3b["3.1(c)_nil_exempt"] },
                    { particulars: "Total taxable value", amount: gstr3b.total_taxable_value },
                    { particulars: "IGST", amount: gstr3b.integrated_tax_igst },
                    { particulars: "CGST", amount: gstr3b.central_tax_cgst },
                    { particulars: "SGST", amount: gstr3b.state_tax_sgst },
                    { particulars: "Total tax payable", amount: gstr3b.total_tax_payable },
                    { particulars: "ITC Available", amount: itcSummary.totalPurchaseTax },
                    { particulars: "Net Tax Payable", amount: Math.max(0, gstr3b.total_tax_payable - itcSummary.totalPurchaseTax) },
                  ])}
                >
                  <Download className="mr-2 h-4 w-4" /> Download PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-transparent border-b border-border/50">
                  <TableRow className="border-none hover:bg-transparent">
                    <TableHead className="text-blue-600 font-bold uppercase tracking-wider text-xs px-6 py-4">Particulars</TableHead>
                    <TableHead className="text-blue-600 font-bold uppercase tracking-wider text-xs text-right px-6 py-4">Amount (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <Row label="3.1(a) Outward taxable supplies (other than zero/nil/exempt)" value={fmt(gstr3b["3.1(a)_outward_taxable"])} />
                  <Row label="3.1(c) Other outward (Nil rated, exempt)" value={fmt(gstr3b["3.1(c)_nil_exempt"])} />
                  <Row label="Total taxable value" value={fmt(gstr3b.total_taxable_value)} highlight />
                  <Row label="Integrated Tax (IGST)" value={fmt(gstr3b.integrated_tax_igst)} />
                  <Row label="Central Tax (CGST)" value={fmt(gstr3b.central_tax_cgst)} />
                  <Row label="State Tax (SGST)" value={fmt(gstr3b.state_tax_sgst)} />
                  <Row label="Total tax payable (Output)" value={fmt(gstr3b.total_tax_payable)} bold />
                  <Row label="4(A) ITC Available (All other ITC)" value={fmt(itcSummary.totalPurchaseTax)} />
                  <Row label="Net Tax Payable" value={fmt(Math.max(0, gstr3b.total_tax_payable - itcSummary.totalPurchaseTax))} highlight />
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HSN Summary */}
        <TabsContent value="hsn" className="space-y-4">
          <Card className="shadow-sm border-muted">
            <CardHeader className="pb-6">
              <CardTitle className="text-2xl flex items-center justify-between font-bold">
                <span className="flex items-center gap-2"><FileSpreadsheet className="h-6 w-6 text-blue-600" /> HSN-wise Summary — {periodLabel}</span>
                <Button
                  variant="outline"
                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                  onClick={() => downloadCsv(`HSN_Summary_${gstrPeriod(gstInput.period.year, gstInput.period.month)}.csv`, hsn)}
                  disabled={hsn.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" /> Export CSV
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {hsn.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">No invoices in this period.</div>
              ) : (
                <Table>
                  <TableHeader className="bg-transparent border-b border-border/50">
                    <TableRow className="border-none hover:bg-transparent">
                      <TableHead className="text-blue-600 font-bold uppercase tracking-wider text-xs whitespace-nowrap px-6">HSN/SAC</TableHead>
                      <TableHead className="text-blue-600 font-bold uppercase tracking-wider text-xs whitespace-nowrap">Description</TableHead>
                      <TableHead className="text-blue-600 font-bold uppercase tracking-wider text-xs whitespace-nowrap">UQC</TableHead>
                      <TableHead className="text-blue-600 font-bold uppercase tracking-wider text-xs text-right whitespace-nowrap">Qty</TableHead>
                      <TableHead className="text-blue-600 font-bold uppercase tracking-wider text-xs text-right whitespace-nowrap">Rate%</TableHead>
                      <TableHead className="text-blue-600 font-bold uppercase tracking-wider text-xs text-right whitespace-nowrap">Taxable</TableHead>
                      <TableHead className="text-blue-600 font-bold uppercase tracking-wider text-xs text-right whitespace-nowrap">IGST</TableHead>
                      <TableHead className="text-blue-600 font-bold uppercase tracking-wider text-xs text-right whitespace-nowrap">CGST</TableHead>
                      <TableHead className="text-blue-600 font-bold uppercase tracking-wider text-xs text-right whitespace-nowrap px-6">SGST</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hsn.map((h, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs px-6">{h.hsn_sc || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-sm">{h.desc}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{h.uqc}</TableCell>
                        <TableCell className="text-right text-sm">{h.qty}</TableCell>
                        <TableCell className="text-right text-sm">{h.rt}%</TableCell>
                        <TableCell className="text-right text-sm">{fmt(h.txval)}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(h.iamt)}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(h.camt)}</TableCell>
                        <TableCell className="text-right text-sm px-6">{fmt(h.samt)}</TableCell>
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
          <Card className="shadow-sm border-muted">
            <CardHeader className="pb-6">
              <CardTitle className="text-2xl flex items-center justify-between font-bold">
                <span className="flex items-center gap-2"><FileSpreadsheet className="h-6 w-6 text-blue-600" /> Tally Sales Voucher CSV</span>
                <Button
                  variant="outline"
                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                  onClick={() => downloadCsv(`Tally_Sales_${gstrPeriod(gstInput.period.year, gstInput.period.month)}.csv`, tallyRows)}
                  disabled={tallyRows.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" /> Download CSV
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

function Row({ label, value, bold, highlight }: { label: string; value: string; bold?: boolean; highlight?: boolean }) {
  return (
    <TableRow className={`border-none border-b border-border/50 hover:bg-transparent ${highlight ? "bg-blue-50/60" : ""}`}>
      <TableCell className={`px-6 py-4 text-sm ${bold ? "font-semibold" : ""} ${highlight ? "text-blue-700 font-bold" : ""}`}>{label}</TableCell>
      <TableCell className={`px-6 py-4 text-sm text-right font-medium ${bold ? "font-semibold" : ""} ${highlight ? "text-blue-700 font-bold" : ""}`}>{value}</TableCell>
    </TableRow>
  );
}
