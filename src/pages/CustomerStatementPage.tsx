import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
import { SEO } from "@/components/shared/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Printer, Download, ArrowLeft, IndianRupee, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { getDocumentPreviewClass, getPrintPageCSS } from "@/lib/document-templates";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

interface TransactionLine {
  date: string;
  type: "Invoice" | "Payment" | "Credit Note";
  number: string;
  details: string;
  amount: number;
  payment: number;
  balance: number;
}

export default function CustomerStatementPage() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const org = useAppStore((s) => s.organization);

  const [client, setClient] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState(clientId || "");
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [creditNotes, setCreditNotes] = useState<any[]>([]);
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(false);

  const statementRef = useRef<HTMLDivElement>(null);

  // Fetch clients list
  useEffect(() => {
    if (!org?.id) return;
    supabase.from("clients").select("id, display_name").eq("org_id", org.id).eq("status", "active").order("display_name")
      .then(({ data }) => setClients(data || []));
  }, [org?.id]);

  // Fetch data when client selected
  useEffect(() => {
    if (!selectedClientId || !org?.id) return;
    const fetchData = async () => {
      setLoading(true);
      const [clientRes, invRes, payRes, cnRes] = await Promise.all([
        supabase.from("clients").select("*").eq("id", selectedClientId).single(),
        supabase.from("invoices").select("*").eq("client_id", selectedClientId).eq("org_id", org.id)
          .gte("issue_date", dateFrom).lte("issue_date", dateTo).neq("status", "void").order("issue_date"),
        supabase.from("payments").select("*").eq("client_id", selectedClientId).eq("org_id", org.id)
          .gte("payment_date", dateFrom).lte("payment_date", dateTo).order("payment_date"),
        supabase.from("credit_notes").select("*").eq("client_id", selectedClientId).eq("org_id", org.id)
          .gte("issue_date", dateFrom).lte("issue_date", dateTo).neq("status", "void").order("issue_date"),
      ]);
      setClient(clientRes.data);
      setInvoices(invRes.data || []);
      setPayments(payRes.data || []);
      setCreditNotes(cnRes.data || []);
      setLoading(false);
    };
    fetchData();
  }, [selectedClientId, org?.id, dateFrom, dateTo]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: org?.currency_code || "USD" }).format(n);

  // Build transaction lines
  const transactions = useMemo(() => {
    const lines: TransactionLine[] = [];
    let runningBalance = 0;

    // Opening balance from client
    const openingBalance = client?.opening_balance ? Number(client.opening_balance) : 0;
    runningBalance = openingBalance;

    // Merge all transactions by date
    const allTxns: { date: string; sortKey: string; type: "Invoice" | "Payment" | "Credit Note"; number: string; details: string; amount: number; payment: number }[] = [];

    invoices.forEach((inv) => {
      allTxns.push({
        date: inv.issue_date,
        sortKey: `${inv.issue_date}_1_${inv.invoice_number}`,
        type: "Invoice",
        number: inv.invoice_number,
        details: `Invoice ${inv.invoice_number}`,
        amount: Number(inv.total),
        payment: 0,
      });
    });

    payments.forEach((p) => {
      allTxns.push({
        date: p.payment_date,
        sortKey: `${p.payment_date}_2_${p.payment_number}`,
        type: "Payment",
        number: p.payment_number,
        details: `Payment ${p.payment_number}${p.reference_number ? ` (Ref: ${p.reference_number})` : ""}`,
        amount: 0,
        payment: Number(p.amount),
      });
    });

    creditNotes.forEach((cn) => {
      allTxns.push({
        date: cn.issue_date,
        sortKey: `${cn.issue_date}_3_${cn.credit_note_number}`,
        type: "Credit Note",
        number: cn.credit_note_number,
        details: `Credit Note ${cn.credit_note_number}`,
        amount: 0,
        payment: Number(cn.total),
      });
    });

    allTxns.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    allTxns.forEach((txn) => {
      runningBalance += txn.amount - txn.payment;
      lines.push({
        date: txn.date,
        type: txn.type,
        number: txn.number,
        details: txn.details,
        amount: txn.amount,
        payment: txn.payment,
        balance: runningBalance,
      });
    });

    return { lines, openingBalance, closingBalance: runningBalance };
  }, [invoices, payments, creditNotes, client]);

  const totalInvoiced = invoices.reduce((s, i) => s + Number(i.total), 0);
  const totalPayments = payments.reduce((s, p) => s + Number(p.amount), 0);
  const totalCredits = creditNotes.reduce((s, c) => s + Number(c.total), 0);

  const handlePrint = () => window.print();

  const handleDownloadPDF = useCallback(async () => {
    if (!statementRef.current) return;
    const paperSizes: Record<string, [number, number]> = {
      a4: [210, 297], letter: [215.9, 279.4], legal: [215.9, 355.6],
    };
    const [pW, pH] = paperSizes[org?.template_paper_size || "a4"] || paperSizes.a4;
    const canvas = await html2canvas(statementRef.current, { scale: 2, useCORS: true, logging: false });
    const imgData = canvas.toDataURL("image/png");
    const imgWidth = pW;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const pdf = new jsPDF("p", "mm", [pW, pH]);
    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pH;
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage([pW, pH]);
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pH;
    }
    pdf.save(`Statement_${client?.display_name || "customer"}_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  }, [client, org]);

  const printCSS = getPrintPageCSS(org?.template_paper_size);

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <style dangerouslySetInnerHTML={{ __html: printCSS }} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight uppercase">Customer Statement</h1>
          <p className="text-sm text-muted-foreground mt-0.5">View complete transaction history for a customer</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-10 rounded-lg px-4" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
          </Button>
          {selectedClientId && (
            <>
              <Button variant="outline" size="sm" className="h-10 rounded-lg px-4" onClick={handlePrint}>
                <Printer className="mr-1.5 h-4 w-4" /> Print
              </Button>
              <Button size="sm" className="h-10 rounded-lg px-4" onClick={handleDownloadPDF}>
                <Download className="mr-1.5 h-4 w-4" /> Download PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="no-print rounded-2xl border-border/60 shadow-sm">
        <CardContent className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-3">Customer & Date Range</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Customer</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger className="h-10 rounded-lg"><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10 rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10 rounded-lg" />
            </div>
          </div>
        </CardContent>
      </Card>

      {!selectedClientId && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Select a customer to view their statement
        </div>
      )}

      {selectedClientId && loading && (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
      )}

      {selectedClientId && !loading && client && (
        <div ref={statementRef} className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 sm:p-8 space-y-6">
          {/* Statement header: 3 columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            <div className="min-w-0">
              <p className="text-base font-bold text-foreground">{org?.name}</p>
              {org?.email && <p className="text-sm text-muted-foreground mt-1">{org.email}</p>}
              {org?.phone && <p className="text-sm text-muted-foreground">{org.phone}</p>}
              {org?.gst_enabled && org?.gst_number && (
                <p className="text-sm text-muted-foreground">GST: {org.gst_number}</p>
              )}
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold tracking-wide">STATEMENT</p>
              <p className="text-sm text-muted-foreground mt-2">
                {format(new Date(dateFrom), "dd MMM yyyy")} — {format(new Date(dateTo), "dd MMM yyyy")}
              </p>
            </div>
            <div className="md:text-right min-w-0">
              <p className="text-sm font-medium text-muted-foreground">To</p>
              <p className="font-bold text-foreground mt-1">{client.display_name}</p>
              {client.company_name && <p className="text-sm text-muted-foreground">{client.company_name}</p>}
              {client.email && <p className="text-sm text-muted-foreground">{client.email}</p>}
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-border/60 bg-card p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white shrink-0">
                <IndianRupee className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Opening Balance</p>
                <p className="text-base font-bold mt-0.5 break-all">{fmt(transactions.openingBalance)}</p>
              </div>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Invoiced</p>
                <p className="text-base font-bold text-blue-600 dark:text-blue-400 mt-0.5 break-all">{fmt(totalInvoiced)}</p>
              </div>
            </div>
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Paid</p>
                <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 break-all">{fmt(totalPayments + totalCredits)}</p>
              </div>
            </div>
            <div className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-rose-500 flex items-center justify-center text-white shrink-0">
                <AlertCircle className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Balance Due</p>
                <p className="text-base font-bold text-rose-600 dark:text-rose-400 mt-0.5 break-all">{fmt(transactions.closingBalance)}</p>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-[11px] uppercase tracking-wider">Date</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Transaction</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Details</TableHead>
                  <TableHead className="text-right text-[11px] uppercase tracking-wider">Invoiced</TableHead>
                  <TableHead className="text-right text-[11px] uppercase tracking-wider">Paid</TableHead>
                  <TableHead className="text-right text-[11px] uppercase tracking-wider">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-sm">{format(new Date(dateFrom), "dd MMM yyyy")}</TableCell>
                  <TableCell className="text-sm font-medium">Opening Balance</TableCell>
                  <TableCell className="text-sm text-muted-foreground">Opening balance</TableCell>
                  <TableCell className="text-right text-sm">{fmt(0)}</TableCell>
                  <TableCell className="text-right text-sm">{fmt(0)}</TableCell>
                  <TableCell className="text-right font-medium text-sm">{fmt(transactions.openingBalance)}</TableCell>
                </TableRow>
                {transactions.lines.map((txn, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{format(new Date(txn.date), "dd MMM yyyy")}</TableCell>
                    <TableCell className={`text-sm font-medium ${
                      txn.type === "Invoice" ? "text-blue-600 dark:text-blue-400" :
                      txn.type === "Payment" ? "text-emerald-600 dark:text-emerald-400" :
                      "text-amber-600 dark:text-amber-400"
                    }`}>
                      {txn.type === "Invoice" ? `Invoice ${txn.number}` :
                       txn.type === "Payment" ? `Payment ${txn.number}` :
                       `Credit Note ${txn.number}`}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {txn.type === "Invoice" ? "Invoice issued" : txn.type === "Payment" ? "Payment received" : "Credit issued"}
                    </TableCell>
                    <TableCell className="text-right text-sm">{fmt(txn.amount)}</TableCell>
                    <TableCell className={`text-right text-sm ${txn.payment > 0 ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}`}>
                      {fmt(txn.payment)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm">{fmt(txn.balance)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 bg-muted/30 font-bold">
                  <TableCell className="text-sm">TOTAL</TableCell>
                  <TableCell colSpan={2}></TableCell>
                  <TableCell className="text-right text-blue-600 dark:text-blue-400">{fmt(totalInvoiced)}</TableCell>
                  <TableCell className="text-right text-emerald-600 dark:text-emerald-400">{fmt(totalPayments + totalCredits)}</TableCell>
                  <TableCell className="text-right text-rose-600 dark:text-rose-400">{fmt(transactions.closingBalance)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm pt-2">
            <p className="text-muted-foreground">Thank you for your business!</p>
            <p className="text-muted-foreground text-xs">This is a computer generated statement and does not require a signature.</p>
          </div>
        </div>
      )}
    </div>
  );
}
