import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/audit";
import { ArrowLeft, CreditCard, DollarSign, AlertCircle, CheckCircle2 } from "lucide-react";

const PAYMENT_MODES = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "credit_card", label: "Credit Card" },
  { value: "upi", label: "UPI" },
  { value: "paypal", label: "PayPal" },
  { value: "other", label: "Other" },
];

interface OutstandingInvoice {
  id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  total: number;
  balance_due: number;
  status: string;
  selected: boolean;
  payment: number;
}

export default function RecordPaymentPage() {
  const org = useAppStore((s) => s.organization);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [clients, setClients] = useState<any[]>([]);
  const [clientId, setClientId] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMode, setPaymentMode] = useState("bank_transfer");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [amountReceived, setAmountReceived] = useState("");
  const [invoices, setInvoices] = useState<OutstandingInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [saving, setSaving] = useState(false);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: org?.currency_code || "USD" }).format(n);

  // Load clients
  useEffect(() => {
    if (!org?.id) return;
    supabase.from("clients").select("id, display_name").eq("org_id", org.id).eq("status", "active").order("display_name").then(({ data }) => {
      setClients(data || []);
    });
  }, [org?.id]);

  // Load outstanding invoices when client changes
  useEffect(() => {
    if (!clientId) { setInvoices([]); return; }
    setLoadingInvoices(true);
    supabase
      .from("invoices")
      .select("id, invoice_number, issue_date, due_date, total, balance_due, status")
      .eq("client_id", clientId)
      .gt("balance_due", 0)
      .in("status", ["sent", "viewed", "partial", "overdue"])
      .order("due_date", { ascending: true })
      .then(({ data }) => {
        setInvoices(
          (data || []).map((inv) => ({
            ...inv,
            total: Number(inv.total),
            balance_due: Number(inv.balance_due),
            selected: false,
            payment: 0,
          }))
        );
        setLoadingInvoices(false);
      });
  }, [clientId]);

  // Auto-generate payment number
  const paymentNumber = useMemo(() => {
    if (!org) return "";
    const prefix = org.payment_prefix || "PAY";
    // Will be set on save to get latest number
    return `${prefix}-XXXX`;
  }, [org]);

  const totalOutstanding = invoices.reduce((s, i) => s + i.balance_due, 0);
  const totalApplied = invoices.reduce((s, i) => s + (i.selected ? i.payment : 0), 0);
  const amountNum = parseFloat(amountReceived) || 0;
  const excessAmount = amountNum - totalApplied;

  // Auto-distribute amount across selected invoices
  const handleAmountChange = (value: string) => {
    setAmountReceived(value);
    const amt = parseFloat(value) || 0;
    let remaining = amt;
    setInvoices((prev) =>
      prev.map((inv) => {
        if (!inv.selected) return { ...inv, payment: 0 };
        const pay = Math.min(remaining, inv.balance_due);
        remaining -= pay;
        return { ...inv, payment: pay };
      })
    );
  };

  const handleSelectInvoice = (id: string, checked: boolean) => {
    setInvoices((prev) => {
      const updated = prev.map((inv) =>
        inv.id === id ? { ...inv, selected: checked } : inv
      );
      // Redistribute amount
      let remaining = parseFloat(amountReceived) || 0;
      return updated.map((inv) => {
        if (!inv.selected) return { ...inv, payment: 0 };
        const pay = Math.min(remaining, inv.balance_due);
        remaining -= pay;
        return { ...inv, payment: pay };
      });
    });
  };

  const handleSelectAll = (checked: boolean) => {
    setInvoices((prev) => {
      const updated = prev.map((inv) => ({ ...inv, selected: checked }));
      let remaining = parseFloat(amountReceived) || 0;
      return updated.map((inv) => {
        if (!inv.selected) return { ...inv, payment: 0 };
        const pay = Math.min(remaining, inv.balance_due);
        remaining -= pay;
        return { ...inv, payment: pay };
      });
    });
  };

  const handlePaymentEdit = (id: string, value: number) => {
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === id ? { ...inv, payment: Math.min(value, inv.balance_due), selected: value > 0 } : inv
      )
    );
  };

  const handleSave = async () => {
    if (!org || !clientId) return;
    if (amountNum <= 0) {
      toast({ title: "Enter amount", description: "Payment amount must be greater than zero.", variant: "destructive" });
      return;
    }
    const selectedInvoices = invoices.filter((i) => i.selected && i.payment > 0);
    if (selectedInvoices.length === 0) {
      toast({ title: "Select invoices", description: "Select at least one invoice to apply payment to.", variant: "destructive" });
      return;
    }

    setSaving(true);

    // Get next payment number
    const nextNum = (org as any).invoice_next_number || 1;
    // Use a dedicated counter — we'll read current payment count
    const { count } = await supabase.from("payments").select("id", { count: "exact", head: true }).eq("org_id", org.id);
    const payNum = `${org.payment_prefix || "PAY"}-${String((count || 0) + 1).padStart(4, "0")}`;

    // Insert payments for each selected invoice
    let hasError = false;
    for (const inv of selectedInvoices) {
      const { error } = await supabase.from("payments").insert({
        org_id: org.id,
        client_id: clientId,
        invoice_id: inv.id,
        payment_number: payNum,
        amount: inv.payment,
        payment_date: paymentDate,
        payment_mode: paymentMode,
        reference_number: referenceNumber || null,
        notes: notes || null,
        currency_code: org.currency_code,
      });
      if (error) { hasError = true; continue; }

      // Update invoice balance
      const newBalance = inv.balance_due - inv.payment;
      const newPaid = inv.total - newBalance;
      const newStatus = newBalance <= 0 ? "paid" : "partial";
      await supabase.from("invoices").update({
        balance_due: newBalance,
        amount_paid: newPaid,
        status: newStatus,
        ...(newBalance <= 0 ? { paid_at: new Date().toISOString() } : {}),
      }).eq("id", inv.id);

      await logAudit({
        orgId: org.id,
        userId: user?.id || "",
        action: "payment_received",
        entityType: "payment",
        entityId: inv.id,
        description: `Payment of ${fmt(inv.payment)} received for ${inv.invoice_number}`,
      });
    }

    setSaving(false);
    if (hasError) {
      toast({ title: "Partial error", description: "Some payments could not be recorded.", variant: "destructive" });
    } else {
      toast({ title: "Payment recorded!", description: `${payNum} — ${fmt(amountNum)} received.` });
      navigate("/payments");
    }
  };

  const selectedClient = clients.find((c) => c.id === clientId);

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <PageHeader title="Record Payment Received" description="Record a payment from a client against outstanding invoices">
        <Button variant="outline" size="sm" onClick={() => navigate("/payments")}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
      </PageHeader>

      {/* Payment Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Payment Details
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Client *</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="Select a client" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>
                ))}
                <SelectItem value="__add_new" className="text-primary font-medium border-t mt-1 pt-1">+ Add New Client</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Amount Received *</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="pl-9"
                value={amountReceived}
                onChange={(e) => handleAmountChange(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Payment Date</Label>
            <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Payment Mode</Label>
            <Select value={paymentMode} onValueChange={setPaymentMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reference #</Label>
            <Input placeholder="e.g. Transaction ID" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Notes</Label>
            <Textarea placeholder="Internal notes..." rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Outstanding Invoices */}
      {clientId && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Outstanding Invoices</CardTitle>
              {invoices.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  Total Outstanding: <span className="font-semibold text-foreground">{fmt(totalOutstanding)}</span>
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingInvoices ? (
              <div className="p-8 text-center text-muted-foreground">Loading invoices...</div>
            ) : invoices.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                <CheckCircle2 className="h-8 w-8 text-success" />
                <p>No outstanding invoices for this client.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={invoices.length > 0 && invoices.every((i) => i.selected)}
                        onCheckedChange={(v) => handleSelectAll(!!v)}
                      />
                    </TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Invoice Amount</TableHead>
                    <TableHead className="text-right">Balance Due</TableHead>
                    <TableHead className="text-right w-36">Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id} className={inv.selected ? "bg-primary/5" : ""}>
                      <TableCell>
                        <Checkbox checked={inv.selected} onCheckedChange={(v) => handleSelectInvoice(inv.id, !!v)} />
                      </TableCell>
                      <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                      <TableCell>{inv.issue_date}</TableCell>
                      <TableCell>{inv.due_date}</TableCell>
                      <TableCell>
                        <Badge variant={inv.status === "overdue" ? "destructive" : "outline"} className="capitalize text-xs">
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{fmt(inv.total)}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(inv.balance_due)}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max={inv.balance_due}
                          className="w-28 ml-auto text-right h-8"
                          value={inv.payment || ""}
                          onChange={(e) => handlePaymentEdit(inv.id, parseFloat(e.target.value) || 0)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary Footer */}
      {clientId && invoices.length > 0 && amountNum > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1 text-sm">
                <div className="flex gap-6">
                  <span className="text-muted-foreground">Amount Received: <span className="font-semibold text-foreground">{fmt(amountNum)}</span></span>
                  <span className="text-muted-foreground">Applied: <span className="font-semibold text-foreground">{fmt(totalApplied)}</span></span>
                  {excessAmount > 0.01 && (
                    <span className="text-warning flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Excess: {fmt(excessAmount)}
                    </span>
                  )}
                </div>
              </div>
              <Button onClick={handleSave} disabled={saving || amountNum <= 0} size="lg">
                {saving ? "Saving..." : "Record Payment"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Simple save for no invoices */}
      {clientId && invoices.length === 0 && !loadingInvoices && (
        <div className="flex justify-end">
          <Button onClick={() => navigate("/payments")} variant="outline">Cancel</Button>
        </div>
      )}
    </div>
  );
}
