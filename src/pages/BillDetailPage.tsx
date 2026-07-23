import { useEffect, useState, useMemo, useRef } from "react";
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
import { CompactBillTemplate } from "@/components/invoice/CompactBillTemplate";
import { PosBillTemplate } from "@/components/invoice/PosBillTemplate";
import { StyledInvoiceTemplate } from "@/components/invoice/StyledInvoiceTemplate";
import { A6Template } from "@/components/invoice/A6Templates";
import { calculateTaxBreakdown, stateCodeFromGstin } from "@/lib/gst";
import { getDocumentPreviewClass } from "@/lib/document-templates";
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

  const statusColor: Record<string, string> = {
    draft: "bg-muted", received: "bg-blue-100 text-blue-700",
    partial: "bg-amber-100 text-amber-700", paid: "bg-emerald-100 text-emerald-700",
  };
  const invoiceRef = useRef<HTMLDivElement>(null);

  const mappedBillForTemplate = useMemo(() => {
    if (!bill || !vendor) return null;
    return {
      ...bill,
      invoice_number: bill.vendor_bill_number || bill.bill_number,
      issue_date: bill.bill_date,
      total_tax: bill.tax_total || 0,
      total_discount: bill.discount_total || 0,
      adjustment: 0,
      shipping_charge: 0,
      clients: {
        display_name: vendor.name,
        tax_number: vendor.gstin,
        billing_address: vendor.billing_address,
        email: vendor.email,
        phone: vendor.phone
      }
    };
  }, [bill, vendor]);

  const taxBreakdown = useMemo(() => {
    if (!bill || !org || !lines.length) return [];
    const orgState = org.gst_number ? stateCodeFromGstin(org.gst_number) : null;
    let clientState = null;
    if (vendor?.gstin) clientState = stateCodeFromGstin(vendor.gstin);
    
    const isInterstate = Boolean(orgState && clientState && orgState !== clientState);
    
    const enhancedLines = (lines || []).map(l => {
      const q = Number(l.quantity) || 0;
      const r = Number(l.rate) || 0;
      const tr = Number(l.tax_rate) || 0;
      const tax_amount = l.tax_amount || (q * r * (tr / 100));
      return { ...l, tax_amount, tax_rate: tr };
    });
    
    let breakdown = calculateTaxBreakdown(enhancedLines, [], isInterstate);
    
    // Fallback if breakdown is empty but total tax > 0
    if (breakdown.length === 0 && bill.tax_total > 0) {
      const totalTax = Number(bill.tax_total || 0);
      const subtotal = Number(bill.subtotal || 0);
      const assumedRate = subtotal > 0 ? Math.round((totalTax / subtotal) * 100) : 0;
      
      if (isInterstate) {
        breakdown = [{ id: `IGST_${assumedRate}`, name: assumedRate > 0 ? `IGST @ ${assumedRate}%` : 'IGST', rate: assumedRate, amount: totalTax }];
      } else {
        const halfRate = assumedRate / 2;
        breakdown = [
          { id: `CGST_${halfRate}`, name: halfRate > 0 ? `CGST @ ${halfRate}%` : 'CGST', rate: halfRate, amount: totalTax / 2 },
          { id: `SGST_${halfRate}`, name: halfRate > 0 ? `SGST @ ${halfRate}%` : 'SGST', rate: halfRate, amount: totalTax / 2 }
        ];
      }
    }
    
    return breakdown;
  }, [bill, lines, org, vendor]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: (org as any)?.currency || "INR" }).format(n);

  if (!bill) return <div className="p-6">Loading...</div>;

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/bills")}><ArrowLeft className="h-4 w-4 mr-1" /> Bills</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/bills/${id}/edit`)}><Pencil className="h-4 w-4 mr-1" /> Edit</Button>
          {bill.balance_due > 0 && <Button onClick={() => setPayOpen(true)}><Plus className="h-4 w-4 mr-1" /> Record Payment</Button>}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Badge className={statusColor[bill.status]}>{bill.status}</Badge>
        <span className="text-sm text-muted-foreground">
          {vendor?.name} • Bill Date {format(new Date(bill.bill_date), "dd MMM yyyy")}
        </span>
      </div>

      <div ref={invoiceRef}>
        {mappedBillForTemplate && (
          org?.template_style === "compact" ? (
            <div className={getDocumentPreviewClass("compact", org?.template_paper_size)}>
              <CompactBillTemplate org={org} invoice={mappedBillForTemplate} lines={lines} fmt={fmt} type="bill" taxBreakdown={taxBreakdown} />
            </div>
          ) : org?.template_style === "pos" ? (
            <div className={getDocumentPreviewClass("pos", org?.template_paper_size || "pos80")}>
              <PosBillTemplate org={org} invoice={mappedBillForTemplate} lines={lines} fmt={fmt} type="bill" taxBreakdown={taxBreakdown} />
            </div>
          ) : ["alpha_blue", "monochrome", "amanda_cream", "redblue_modern"].includes(org?.template_style) ? (
            <div className={getDocumentPreviewClass(org?.template_style, org?.template_paper_size)}>
              <A6Template org={org} invoice={mappedBillForTemplate} lines={lines} fmt={fmt} type="bill" variant={org.template_style as any} taxBreakdown={taxBreakdown} />
            </div>
          ) : (
            <div className={getDocumentPreviewClass(org?.template_style, org?.template_paper_size)}>
              <StyledInvoiceTemplate org={org} invoice={mappedBillForTemplate} lines={lines} fmt={fmt} type="bill" taxBreakdown={taxBreakdown} />
            </div>
          )
        )}
      </div>

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
                    <TableCell className="text-right font-medium">{formatCurrency(Number(p.amount), (org as any)?.currency || "INR")}</TableCell>
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
