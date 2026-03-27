import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Edit, Send, FileDown, Copy, Ban, CreditCard, Share2 } from "lucide-react";

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const org = useAppStore((s) => s.organization);
  const { toast } = useToast();

  const [invoice, setInvoice] = useState<any>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: 0, payment_mode: "bank_transfer", reference_number: "", notes: "", payment_date: new Date().toISOString().split("T")[0],
  });

  const fetchInvoice = async () => {
    if (!id) return;
    const { data: inv } = await supabase
      .from("invoices")
      .select("*, clients(display_name, email)")
      .eq("id", id)
      .single();
    setInvoice(inv);
    if (inv) {
      setPaymentForm((f) => ({ ...f, amount: Number(inv.balance_due) }));
    }

    const { data: lineData } = await supabase
      .from("invoice_lines")
      .select("*")
      .eq("invoice_id", id)
      .order("sort_order");
    setLines(lineData || []);

    const { data: payData } = await supabase
      .from("payments")
      .select("*")
      .eq("invoice_id", id)
      .order("payment_date", { ascending: false });
    setPayments(payData || []);
  };

  useEffect(() => { fetchInvoice(); }, [id]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: org?.currency_code || "USD" }).format(n);

  const handleRecordPayment = async () => {
    if (!invoice || paymentForm.amount <= 0) return;

    // Generate payment number
    const payNum = `PAY-${Date.now()}`;

    const { error } = await supabase.from("payments").insert({
      org_id: org!.id,
      client_id: invoice.client_id,
      invoice_id: invoice.id,
      payment_number: payNum,
      payment_date: paymentForm.payment_date,
      amount: paymentForm.amount,
      currency_code: invoice.currency_code,
      payment_mode: paymentForm.payment_mode,
      reference_number: paymentForm.reference_number,
      notes: paymentForm.notes,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    // Update invoice
    const newPaid = Number(invoice.amount_paid) + paymentForm.amount;
    const newBalance = Number(invoice.total) - newPaid;
    const newStatus = newBalance <= 0 ? "paid" : "partial";

    await supabase.from("invoices").update({
      amount_paid: newPaid,
      balance_due: Math.max(0, newBalance),
      status: newStatus,
      ...(newBalance <= 0 ? { paid_at: new Date().toISOString() } : {}),
    }).eq("id", invoice.id);

    setPaymentDialogOpen(false);
    toast({ title: "Payment recorded!" });
    fetchInvoice();
  };

  const handleVoid = async () => {
    if (!invoice) return;
    await supabase.from("invoices").update({ status: "void" }).eq("id", invoice.id);
    toast({ title: "Invoice voided" });
    fetchInvoice();
  };

  const handleDuplicate = async () => {
    if (!invoice || !org) return;
    const prefix = org.invoice_prefix || "INV";
    const num = org.invoice_next_number || 1;
    const year = new Date().getFullYear();
    const newNum = `${prefix}-${year}-${String(num).padStart(4, "0")}`;

    const { data: newInv } = await supabase.from("invoices").insert({
      org_id: org.id,
      client_id: invoice.client_id,
      invoice_number: newNum,
      status: "draft",
      issue_date: new Date().toISOString().split("T")[0],
      due_date: new Date(Date.now() + (org.payment_terms || 30) * 86400000).toISOString().split("T")[0],
      currency_code: invoice.currency_code,
      discount: Number(invoice.discount),
      discount_type: invoice.discount_type,
      shipping_charge: Number(invoice.shipping_charge),
      subtotal: Number(invoice.subtotal),
      total_tax: Number(invoice.total_tax),
      total_discount: Number(invoice.total_discount),
      total: Number(invoice.total),
      balance_due: Number(invoice.total),
      notes: invoice.notes,
      terms_conditions: invoice.terms_conditions,
    }).select().single();

    if (newInv) {
      // Copy lines
      const newLines = lines.map((l) => ({
        invoice_id: newInv.id,
        item_id: l.item_id,
        name: l.name,
        description: l.description,
        quantity: Number(l.quantity),
        rate: Number(l.rate),
        discount: Number(l.discount),
        discount_type: l.discount_type,
        tax_id: l.tax_id,
        tax_amount: Number(l.tax_amount),
        amount: Number(l.amount),
        sort_order: l.sort_order,
      }));
      await supabase.from("invoice_lines").insert(newLines);
      await supabase.from("organizations").update({ invoice_next_number: num + 1 }).eq("id", org.id);
      toast({ title: "Invoice duplicated!" });
      navigate(`/invoices/${newInv.id}`);
    }
  };

  if (!invoice) {
    return <div className="p-6 text-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <PageHeader title={`Invoice ${invoice.invoice_number}`}>
        <Button variant="outline" size="sm" onClick={() => navigate(`/invoices/${id}/edit`)}>
          <Edit className="mr-1 h-4 w-4" /> Edit
        </Button>
        <Button variant="outline" size="sm" onClick={handleDuplicate}>
          <Copy className="mr-1 h-4 w-4" /> Duplicate
        </Button>
        {invoice.status !== "void" && invoice.status !== "paid" && (
          <Button variant="outline" size="sm" onClick={handleVoid}>
            <Ban className="mr-1 h-4 w-4" /> Void
          </Button>
        )}
        {invoice.status !== "void" && invoice.status !== "paid" && (
          <Button size="sm" onClick={() => setPaymentDialogOpen(true)}>
            <CreditCard className="mr-1 h-4 w-4" /> Record Payment
          </Button>
        )}
      </PageHeader>

      {/* Status + Summary */}
      <div className="flex items-center gap-4">
        <StatusBadge status={invoice.status} />
        <span className="text-sm text-muted-foreground">
          {(invoice.clients as any)?.display_name} • Due {invoice.due_date}
        </span>
      </div>

      {/* Invoice Preview */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg">{org?.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{org?.email}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{fmt(Number(invoice.total))}</p>
              <p className="text-sm text-muted-foreground">Balance: {fmt(Number(invoice.balance_due))}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>
                    <div className="font-medium">{line.name}</div>
                    {line.description && <div className="text-xs text-muted-foreground">{line.description}</div>}
                  </TableCell>
                  <TableCell className="text-right">{line.quantity}</TableCell>
                  <TableCell className="text-right">{fmt(Number(line.rate))}</TableCell>
                  <TableCell className="text-right">{fmt(Number(line.tax_amount))}</TableCell>
                  <TableCell className="text-right">{fmt(Number(line.amount))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmt(Number(invoice.subtotal))}</span></div>
            {Number(invoice.total_discount) > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="text-destructive">-{fmt(Number(invoice.total_discount))}</span></div>
            )}
            {Number(invoice.total_tax) > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>+{fmt(Number(invoice.total_tax))}</span></div>
            )}
            {Number(invoice.shipping_charge) > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>+{fmt(Number(invoice.shipping_charge))}</span></div>
            )}
            <div className="flex justify-between border-t pt-1 font-bold text-base">
              <span>Total</span><span>{fmt(Number(invoice.total))}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Amount Paid</span><span>{fmt(Number(invoice.amount_paid))}</span>
            </div>
            <div className="flex justify-between font-bold text-primary">
              <span>Balance Due</span><span>{fmt(Number(invoice.balance_due))}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payments */}
      {payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payments Received</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Payment #</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.payment_date}</TableCell>
                    <TableCell>{p.payment_number}</TableCell>
                    <TableCell className="capitalize">{p.payment_mode.replace("_", " ")}</TableCell>
                    <TableCell className="text-right">{fmt(Number(p.amount))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Record Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Payment Date</Label>
              <Input type="date" value={paymentForm.payment_date} onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" step="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <Select value={paymentForm.payment_mode} onValueChange={(v) => setPaymentForm({ ...paymentForm, payment_mode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reference Number</Label>
              <Input value={paymentForm.reference_number} onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRecordPayment}>Record Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
