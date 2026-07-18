import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
import { SEO } from "@/components/shared/SEO";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, Calculator, CheckCircle2 } from "lucide-react";
import { format, isWithinInterval, parseISO } from "date-fns";
import { downloadCSV } from "@/lib/export-csv";
import { formatCurrency } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function GSTReportsPage() {
  const org = useAppStore((s) => s.organization);
  const { toast } = useToast();
  
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);

  useEffect(() => {
    if (!org?.id) return;
    const fetch = async () => {
      setLoading(true);
      // Fetch invoices with client details
      const { data: invData } = await supabase
        .from("invoices")
        .select(`*, clients(display_name, tax_number, billing_address)`)
        .eq("org_id", org.id)
        .neq("status", "void")
        .neq("status", "draft");

      // Fetch bills with vendor details
      const { data: billData } = await (supabase as any)
        .from("bills")
        .select(`*, vendors(name, gstin, billing_address)`)
        .eq("org_id", org.id)
        .neq("status", "void")
        .neq("status", "draft");

      setInvoices(invData || []);
      setBills(billData || []);
      setLoading(false);
    };
    fetch();
  }, [org?.id]);

  const { filteredInvoices, filteredBills, summary } = useMemo(() => {
    const start = new Date(selectedYear, selectedMonth, 1);
    const end = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

    const fInvoices = invoices.filter((i) => {
      if (!i.issue_date) return false;
      const d = parseISO(i.issue_date);
      return isWithinInterval(d, { start, end });
    });

    const fBills = bills.filter((b) => {
      if (!b.bill_date) return false;
      const d = parseISO(b.bill_date);
      return isWithinInterval(d, { start, end });
    });

    let totalSales = 0, totalSalesTax = 0;
    let totalPurchases = 0, totalPurchaseTax = 0;

    fInvoices.forEach(i => {
      const taxable = Number(i.subtotal || 0) - Number(i.total_discount || 0);
      totalSales += taxable; 
      totalSalesTax += Number(i.total_tax || 0);
    });

    fBills.forEach(b => {
      totalPurchases += Number(b.subtotal || 0);
      totalPurchaseTax += Number(b.tax_total || 0);
    });

    return {
      filteredInvoices: fInvoices,
      filteredBills: fBills,
      summary: {
        totalSales,
        totalSalesTax,
        totalPurchases,
        totalPurchaseTax,
        netPayable: totalSalesTax - totalPurchaseTax
      }
    };
  }, [invoices, bills, selectedMonth, selectedYear]);

  const exportGSTR1 = () => {
    if (filteredInvoices.length === 0) {
      toast({ title: "No sales found for this period", variant: "default" });
      return;
    }
    const data = filteredInvoices.map((inv) => {
      const isB2B = !!inv.clients?.tax_number;
      return {
        "Invoice Type": isB2B ? "B2B" : "B2C",
        "Invoice Number": inv.invoice_number,
        "Invoice Date": inv.issue_date ? format(parseISO(inv.issue_date), "dd-MMM-yyyy") : "",
        "Customer Name": inv.clients?.display_name || "Unknown",
        "GSTIN/UIN": inv.clients?.tax_number || "",
        "Taxable Value": (Number(inv.subtotal || 0) - Number(inv.total_discount || 0)).toFixed(2),
        "Tax Amount": Number(inv.total_tax || 0).toFixed(2),
        "Total Invoice Value": Number(inv.total || 0).toFixed(2),
        "Status": inv.status
      };
    });
    downloadCSV(data, `GSTR1_Sales_${MONTHS[selectedMonth]}_${selectedYear}`);
  };

  const exportPurchaseRegister = () => {
    if (filteredBills.length === 0) {
      toast({ title: "No purchases found for this period", variant: "default" });
      return;
    }
    const data = filteredBills.map((bill) => {
      return {
        "Bill Number": bill.bill_number,
        "Vendor Bill No": bill.vendor_bill_number || "",
        "Bill Date": bill.bill_date ? format(parseISO(bill.bill_date), "dd-MMM-yyyy") : "",
        "Vendor Name": bill.vendors?.name || "Unknown",
        "GSTIN": bill.vendors?.gstin || "",
        "Taxable Value": Number(bill.subtotal || 0).toFixed(2),
        "Tax Amount (ITC)": Number(bill.tax_total || 0).toFixed(2),
        "Total Bill Value": Number(bill.total || 0).toFixed(2),
        "Status": bill.status
      };
    });
    downloadCSV(data, `Purchase_Register_${MONTHS[selectedMonth]}_${selectedYear}`);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <SEO title="GST Returns | BillFlow" />
      <PageHeader 
        title="GST Returns (Offline Export)" 
        description="Generate CA-friendly Master Registers for GSTR-1 & ITC matching without any API keys." 
      />

      <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-lg border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Select Month:</span>
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
            <SelectTrigger className="w-32 bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Year:</span>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-24 bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[0, 1, 2, 3, 4, 5].map((offset) => {
                const yr = today.getFullYear() - offset;
                return <SelectItem key={yr} value={String(yr)}>{yr}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Sales / GSTR-1 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" /> Sales Register (GSTR-1)
                </CardTitle>
                <CardDescription>Outward supplies for the selected month</CardDescription>
              </div>
              <Badge variant="outline" className="bg-primary/5">{filteredInvoices.length} Invoices</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted/30 rounded-md border">
                <p className="text-xs text-muted-foreground mb-1">Taxable Value</p>
                <p className="text-lg font-semibold">{formatCurrency(summary.totalSales, org?.currency_code || "INR")}</p>
              </div>
              <div className="p-3 bg-muted/30 rounded-md border">
                <p className="text-xs text-muted-foreground mb-1">Tax Collected (Output)</p>
                <p className="text-lg font-semibold text-rose-600">{formatCurrency(summary.totalSalesTax, org?.currency_code || "INR")}</p>
              </div>
            </div>
            <Button onClick={exportGSTR1} className="w-full" variant="outline" disabled={loading}>
              <Download className="mr-2 h-4 w-4" /> Download GSTR-1 Data (CSV)
            </Button>
          </CardContent>
        </Card>

        {/* Purchases / GSTR-2B */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-indigo-500" /> Purchase Register (ITC)
                </CardTitle>
                <CardDescription>Inward supplies (Bills) for the selected month</CardDescription>
              </div>
              <Badge variant="outline" className="bg-indigo-500/10 text-indigo-700">{filteredBills.length} Bills</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted/30 rounded-md border">
                <p className="text-xs text-muted-foreground mb-1">Taxable Value</p>
                <p className="text-lg font-semibold">{formatCurrency(summary.totalPurchases, org?.currency_code || "INR")}</p>
              </div>
              <div className="p-3 bg-muted/30 rounded-md border">
                <p className="text-xs text-muted-foreground mb-1">Tax Paid (Input Credit)</p>
                <p className="text-lg font-semibold text-emerald-600">{formatCurrency(summary.totalPurchaseTax, org?.currency_code || "INR")}</p>
              </div>
            </div>
            <Button onClick={exportPurchaseRegister} className="w-full" variant="outline" disabled={loading}>
              <Download className="mr-2 h-4 w-4" /> Download Purchase Register (CSV)
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* GSTR-3B Summary Dashboard */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" /> Net Tax Liability Summary (GSTR-3B)
          </CardTitle>
          <CardDescription>Estimate of your net tax payment to the government.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col items-center justify-center p-4 bg-background rounded-lg border shadow-sm">
              <span className="text-sm text-muted-foreground mb-1">Output Tax (From Sales)</span>
              <span className="text-2xl font-bold text-rose-600">{formatCurrency(summary.totalSalesTax, org?.currency_code || "INR")}</span>
            </div>
            <div className="flex flex-col items-center justify-center p-4 bg-background rounded-lg border shadow-sm">
              <span className="text-sm text-muted-foreground mb-1">Minus: Input Tax Credit</span>
              <span className="text-2xl font-bold text-emerald-600">- {formatCurrency(summary.totalPurchaseTax, org?.currency_code || "INR")}</span>
            </div>
            <div className="flex flex-col items-center justify-center p-4 bg-primary text-primary-foreground rounded-lg border shadow-sm">
              <span className="text-sm opacity-90 mb-1">Net Payable Tax</span>
              <span className="text-3xl font-bold">{formatCurrency(Math.max(0, summary.netPayable), org?.currency_code || "INR")}</span>
            </div>
          </div>
          {summary.netPayable < 0 && (
            <div className="mt-4 flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 p-3 rounded-md">
              <CheckCircle2 className="h-4 w-4" /> 
              You have excess ITC of {formatCurrency(Math.abs(summary.netPayable), org?.currency_code || "INR")} this month. This can be carried forward to next month. No tax payment required!
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
