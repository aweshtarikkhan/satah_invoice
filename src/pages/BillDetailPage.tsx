import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, ArrowLeft, Plus } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { postBillPaymentJournal } from "@/lib/accounting";

export default function BillDetailPage() {
  const org = useAppStore((s) => s.organization);
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [bill, setBill] = useState<any>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [vendor, setVendor] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmt, setPayAmt] = useState("");
  const [payDate, setPayDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [payMethod, setPayMethod] = useState("bank_transfer");
  const [payRef, setPayRef] = useState("");

  const load = async () => {
    const { data: b } = await (supabase as any).from("bills").select("*").eq("id", id).maybeSingle();
    if (!b) return;
    setBill(b);
    setPayAmt(String(b.balance_due));
    const [{ data: l }, { data: v }, { data: p }] = await Promise.all([
      (supabase as any).from("bill_lines").select("*").eq("bill_id", id).order("sort_order"),
      (supabase as any).from("vendors").select("*").eq("id", b.vendor_id).maybeSingle(),
      (supabase as any).from("bill_payments").select("*").eq("bill_id", id).order("payment_date", { ascending: false }),
    ]);
    setLines(l || []); setVendor(v); setPayments(p || []);
  };
  useEffect(() => { load(); }, [id]);

  const recordPayment = async () => {
    const amt = Number(payAmt);
    if (!amt || amt <= 0) { toast({ title: "Enter amount", variant: "destructive" }); return; }
    if (!org?.id || !bill) return;
    const payload: any = {
      org_id: org.id, vendor_id: bill.vendor_id, bill_id: bill.id,
      payment_date: payDate, amount: amt, payment_method: payMethod, reference: payRef || null,
      branch_id: bill.branch_id,
    };
    const { data: pmt, error } = await (supabase as any).from("bill_payments").insert(payload).select().single();
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    const newPaid = Number(bill.amount_paid) + amt;
    const newDue = Math.max(0, Number(bill.total) - newPaid);
    const status = newDue <= 0 ? "paid" : "partial";
    await (supabase as any).from("bills").update({ amount_paid: newPaid, balance_due: newDue, status }).eq("id", bill.id);
    await postBillPaymentJournal(org.id, pmt.id, payDate, bill.bill_number, bill.vendor_id, amt, payMethod, bill.branch_id);
    toast({ title: "Payment recorded" });
    setPayOpen(false); setPayRef(""); load();
  };

  if (!bill) return <div className="p-6">Loading…</div>;

  const statusColor: Record<string, string> = {
    draft: "bg-muted", received: "bg-blue-100 text-blue-700",
    partial: "bg-amber-100 text-amber-700", paid: "bg-emerald-100 text-emerald-700",
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/bills")}><ArrowLeft className="h-4 w-4 mr-1" /> Bills</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/bills/${id}/edit`)}><Pencil className="h-4 w-4 mr-1" /> Edit</Button>
          {bill.balance_due > 0 && <Button onClick={() => setPayOpen(true)}><Plus className="h-4 w-4 mr-1" /> Record Payment</Button>}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Bill {bill.bill_number}</CardTitle>
              <div className="text-sm text-muted-foreground mt-1">{vendor?.name} • {format(new Date(bill.bill_date), "dd MMM yyyy")}</div>
            </div>
            <Badge className={statusColor[bill.status]}>{bill.status}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Description</TableHead><TableHead>HSN</TableHead><TableHead>Qty</TableHead><TableHead>Rate</TableHead><TableHead>Tax %</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>
              {lines.map(l => (
                <TableRow key={l.id}>
                  <TableCell>{l.description}</TableCell>
                  <TableCell>{l.hsn || "—"}</TableCell>
                  <TableCell>{l.quantity}</TableCell>
                  <TableCell>{formatCurrency(Number(l.rate), org?.currency || "INR")}</TableCell>
                  <TableCell>{l.tax_rate}%</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(l.amount), org?.currency || "INR")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 ml-auto w-72 space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(Number(bill.subtotal), org?.currency || "INR")}</span></div>
            <div className="flex justify-between"><span>Tax</span><span>{formatCurrency(Number(bill.tax_total), org?.currency || "INR")}</span></div>
            {Number(bill.tds_amount) > 0 && <div className="flex justify-between text-amber-600"><span>TDS</span><span>− {formatCurrency(Number(bill.tds_amount), org?.currency || "INR")}</span></div>}
            <div className="flex justify-between font-semibold border-t pt-2"><span>Total</span><span>{formatCurrency(Number(bill.total), org?.currency || "INR")}</span></div>
            <div className="flex justify-between text-emerald-600"><span>Paid</span><span>{formatCurrency(Number(bill.amount_paid), org?.currency || "INR")}</span></div>
            <div className="flex justify-between font-medium text-base"><span>Balance Due</span><span>{formatCurrency(Number(bill.balance_due), org?.currency || "INR")}</span></div>
          </div>
        </CardContent>
      </Card>

      {payments.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Payment History</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Method</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
              <TableBody>
                {payments.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>{format(new Date(p.payment_date), "dd MMM yyyy")}</TableCell>
                    <TableCell className="capitalize">{p.payment_method.replace("_", " ")}</TableCell>
                    <TableCell>{p.reference || "—"}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(Number(p.amount), org?.currency || "INR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Amount</Label><Input type="number" value={payAmt} onChange={e => setPayAmt(e.target.value)} /></div>
            <div><Label>Date</Label><Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} /></div>
            <div>
              <Label>Method</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Reference</Label><Input value={payRef} onChange={e => setPayRef(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={recordPayment}>Record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
