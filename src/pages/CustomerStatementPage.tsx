import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
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
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <style dangerouslySetInnerHTML={{ __html: printCSS }} />

      <PageHeader title="Customer Statement" description="View complete transaction history for a customer">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        {selectedClientId && (
          <>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="mr-1 h-4 w-4" /> Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
              <Download className="mr-1 h-4 w-4" /> Download PDF
            </Button>
          </>
        )}
      </PageHeader>

      {/* Filters */}
      <Card className="no-print">
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Customer</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
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
        <div ref={statementRef}>
          <Card className={getDocumentPreviewClass(org?.template_style, org?.template_paper_size)}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{org?.name}</CardTitle>
                  {org?.email && <p className="text-sm text-muted-foreground">{org.email}</p>}
                  {org?.phone && <p className="text-sm text-muted-foreground">{org.phone}</p>}
                  {org?.gst_enabled && org?.gst_number && (
                    <p className="text-sm text-muted-foreground">GST: {org.gst_number}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold mb-1">STATEMENT</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(dateFrom), "dd MMM yyyy")} — {format(new Date(dateTo), "dd MMM yyyy")}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium text-muted-foreground">To:</p>
                <p className="font-semibold">{client.display_name}</p>
                {client.company_name && <p className="text-sm text-muted-foreground">{client.company_name}</p>}
                {client.email && <p className="text-sm text-muted-foreground">{client.email}</p>}
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Opening Balance</p>
                  <p className="text-sm font-bold">{fmt(transactions.openingBalance)}</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Invoiced</p>
                  <p className="text-sm font-bold text-primary">{fmt(totalInvoiced)}</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Paid</p>
                  <p className="text-sm font-bold text-success">{fmt(totalPayments + totalCredits)}</p>
                </div>
                <div className="rounded-lg border p-3 text-center bg-destructive/5">
                  <p className="text-xs text-muted-foreground">Balance Due</p>
                  <p className="text-sm font-bold text-destructive">{fmt(transactions.closingBalance)}</p>
                </div>
              </div>

              {/* Transactions Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Transaction</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="text-right">Invoiced</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.openingBalance !== 0 && (
                    <TableRow>
                      <TableCell className="text-sm">{format(new Date(dateFrom), "dd MMM yyyy")}</TableCell>
                      <TableCell><span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Opening</span></TableCell>
                      <TableCell className="text-sm text-muted-foreground">Opening Balance</TableCell>
                      <TableCell className="text-right">—</TableCell>
                      <TableCell className="text-right">—</TableCell>
                      <TableCell className="text-right font-medium">{fmt(transactions.openingBalance)}</TableCell>
                    </TableRow>
                  )}
                  {transactions.lines.map((txn, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{format(new Date(txn.date), "dd MMM yyyy")}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          txn.type === "Invoice" ? "bg-primary/10 text-primary" :
                          txn.type === "Payment" ? "bg-success/10 text-success" :
                          "bg-amber-500/10 text-amber-600"
                        }`}>
                          {txn.type}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{txn.number}</TableCell>
                      <TableCell className="text-right text-sm">
                        {txn.amount > 0 ? fmt(txn.amount) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm text-success">
                        {txn.payment > 0 ? fmt(txn.payment) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm">{fmt(txn.balance)}</TableCell>
                    </TableRow>
                  ))}
                  {/* Closing Balance Row */}
                  <TableRow className="border-t-2 font-bold">
                    <TableCell colSpan={3} className="text-right">Closing Balance</TableCell>
                    <TableCell className="text-right">{fmt(totalInvoiced)}</TableCell>
                    <TableCell className="text-right text-success">{fmt(totalPayments + totalCredits)}</TableCell>
                    <TableCell className="text-right text-destructive text-base">{fmt(transactions.closingBalance)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              {/* Footer Note */}
              <div className="text-xs text-muted-foreground border-t pt-3 mt-4">
                <p>This statement was generated on {format(new Date(), "dd MMM yyyy")} by {org?.name}.</p>
                <p>If you have any questions regarding this statement, please contact us at {org?.email || "—"}.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
