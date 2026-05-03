import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { useAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
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
import { Edit, Send, FileDown, Copy, Ban, CreditCard, Share2, Download, Printer } from "lucide-react";
import { getDocumentPreviewClass, getPaperSizeLabel, getPrintPageCSS } from "@/lib/document-templates";
import { QRCodeSVG } from "qrcode.react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { CompactBillTemplate } from "@/components/invoice/CompactBillTemplate";
import { PosBillTemplate } from "@/components/invoice/PosBillTemplate";
import { StyledInvoiceTemplate } from "@/components/invoice/StyledInvoiceTemplate";

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const org = useAppStore((s) => s.organization);
  const { toast } = useToast();
  const { user } = useAuth();

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
      .select("*, clients(display_name, email, tax_number)")
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
    if (org && user) await logAudit({ orgId: org.id, userId: user.id, entityType: "payment", entityId: invoice.id, action: "payment_recorded", description: `Payment of ${paymentForm.amount} recorded for ${invoice.invoice_number}` });
    fetchInvoice();
  };

  const handleVoid = async () => {
    if (!invoice) return;
    await supabase.from("invoices").update({ status: "void" }).eq("id", invoice.id);
    toast({ title: "Invoice voided" });
    if (org && user) await logAudit({ orgId: org.id, userId: user.id, entityType: "invoice", entityId: invoice.id, action: "void", description: `Invoice ${invoice.invoice_number} voided` });
    fetchInvoice();
  };

  const handleMarkSent = async () => {
    if (!invoice) return;
    await supabase.from("invoices").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", invoice.id);
    toast({ title: "Invoice marked as sent" });
    if (org && user) await logAudit({ orgId: org.id, userId: user.id, entityType: "invoice", entityId: invoice.id, action: "mark_sent", description: `Invoice ${invoice.invoice_number} marked as sent` });
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

  const invoiceRef = useRef<HTMLDivElement>(null);

  const handleDownloadPDF = useCallback(async () => {
    if (!invoiceRef.current) return;
    const paperSizes: Record<string, [number, number]> = {
      a4: [210, 297], letter: [215.9, 279.4], legal: [215.9, 355.6], a5: [148, 210], a6: [105, 148], pos80: [80, 297],
    };
    const paperKey = org?.template_paper_size || "a4";
    const [pW, pH] = paperSizes[paperKey] || paperSizes.a4;
    const MARGIN = paperKey === "pos80" ? 2 : 8; // mm
    const contentWidth = pW - MARGIN * 2;
    const contentHeight = pH - MARGIN * 2;

    // Capture each "section" individually so rows are never cut mid-way.
    // Sections are <table>, top-level <div> children, and any [data-pdf-section].
    const root = invoiceRef.current;
    const explicit = Array.from(root.querySelectorAll<HTMLElement>("[data-pdf-section]"));
    const sections: HTMLElement[] = explicit.length
      ? explicit
      : (Array.from(root.children) as HTMLElement[]).flatMap((child) => {
          // For Card-based templates, dive one level into CardContent rows.
          const inner = child.querySelectorAll<HTMLElement>(":scope > *");
          return inner.length > 1 ? Array.from(inner) : [child];
        });

    const pdf = new jsPDF("p", "mm", [pW, pH]);
    let cursorY = MARGIN;
    const SECTION_GAP = 1.5; // mm

    for (const section of sections) {
      const canvas = await html2canvas(section, { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff" });
      const imgW = contentWidth;
      const imgH = (canvas.height * imgW) / canvas.width;
      const imgData = canvas.toDataURL("image/png");

      if (imgH > contentHeight) {
        // Section bigger than a page: slice it across pages.
        let remaining = imgH;
        let srcY = 0;
        while (remaining > 0) {
          const spaceLeft = pH - MARGIN - cursorY;
          if (spaceLeft < 10) {
            pdf.addPage([pW, pH]);
            cursorY = MARGIN;
          }
          const sliceMM = Math.min(remaining, pH - MARGIN - cursorY);
          const sliceRatio = sliceMM / imgH;
          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = canvas.height * sliceRatio;
          const ctx = sliceCanvas.getContext("2d")!;
          ctx.drawImage(canvas, 0, -srcY * (canvas.height / imgH));
          pdf.addImage(sliceCanvas.toDataURL("image/png"), "PNG", MARGIN, cursorY, imgW, sliceMM);
          cursorY += sliceMM;
          srcY += sliceMM;
          remaining -= sliceMM;
          if (remaining > 0) {
            pdf.addPage([pW, pH]);
            cursorY = MARGIN;
          }
        }
      } else {
        // Move to a new page if it doesn't fit.
        if (cursorY + imgH > pH - MARGIN && cursorY > MARGIN) {
          pdf.addPage([pW, pH]);
          cursorY = MARGIN;
        }
        pdf.addImage(imgData, "PNG", MARGIN, cursorY, imgW, imgH);
        cursorY += imgH + SECTION_GAP;
      }
    }

    pdf.save(`${invoice?.invoice_number || "invoice"}.pdf`);
  }, [invoice, org]);

  if (!invoice) {
    return <div className="p-6 text-center text-muted-foreground">Loading...</div>;
  }

  const printCSS = getPrintPageCSS(org?.template_paper_size);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Inject print styles for correct paper size */}
      <style dangerouslySetInnerHTML={{ __html: printCSS }} />

      <PageHeader title={`Invoice ${invoice.invoice_number}`}>
        <Button variant="outline" size="sm" onClick={() => navigate(`/invoices/${id}/edit`)}>
          <Edit className="mr-1 h-4 w-4" /> Edit
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="mr-1 h-4 w-4" /> Print
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
          <Download className="mr-1 h-4 w-4" /> Download PDF
        </Button>
        <Button variant="outline" size="sm" onClick={handleDuplicate}>
          <Copy className="mr-1 h-4 w-4" /> Duplicate
        </Button>
        {invoice.status === "draft" && (
          <Button variant="outline" size="sm" onClick={handleMarkSent}>
            <Send className="mr-1 h-4 w-4" /> Mark as Sent
          </Button>
        )}
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
        <Button variant="outline" size="sm" onClick={async () => {
          const { data: existing } = await supabase.from("portal_tokens").select("token").eq("entity_type", "invoice").eq("entity_id", id!).maybeSingle();
          let token = existing?.token;
          if (!token) {
            const { data } = await supabase.from("portal_tokens").insert({ org_id: org!.id, entity_type: "invoice", entity_id: id! }).select("token").single();
            token = data?.token;
          }
          if (token) {
            await navigator.clipboard.writeText(`${window.location.origin}/portal/${token}`);
            toast({ title: "Portal link copied!" });
          }
        }}>
          <Share2 className="mr-1 h-4 w-4" /> Share Link
        </Button>
      </PageHeader>

      {/* Status + Summary */}
      <div className="flex items-center gap-4">
        <StatusBadge status={invoice.status} />
        <span className="text-sm text-muted-foreground">
          {(invoice.clients as any)?.display_name} • Due {invoice.due_date}
        </span>
      </div>

      {/* Invoice Preview */}
      <div ref={invoiceRef}>
      {org?.template_style === "compact" ? (
        <div className={getDocumentPreviewClass("compact", org?.template_paper_size)}>
          <CompactBillTemplate org={org} invoice={invoice} lines={lines} fmt={fmt} type="invoice" />
        </div>
      ) : org?.template_style === "pos" ? (
        <div className={getDocumentPreviewClass("pos", org?.template_paper_size || "pos80")}>
          <PosBillTemplate org={org} invoice={invoice} lines={lines} fmt={fmt} type="invoice" />
        </div>
      ) : (
      <div className={getDocumentPreviewClass(org?.template_style, org?.template_paper_size)}>
        <StyledInvoiceTemplate org={org} invoice={invoice} lines={lines} fmt={fmt} type="invoice" />
      </div>
      )}
      </div>

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
