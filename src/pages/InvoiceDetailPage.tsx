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
import { Edit, Send, FileDown, Copy, Ban, CreditCard, Share2, Download, Printer, MessageCircle } from "lucide-react";
import { getOrCreatePortalToken, portalUrl, openWhatsappShare, buildInvoiceWhatsappMessage } from "@/lib/share";
import { getDocumentPreviewClass, getPaperSizeLabel, getPrintPageCSS } from "@/lib/document-templates";
import { QRCodeSVG } from "qrcode.react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { CompactBillTemplate } from "@/components/invoice/CompactBillTemplate";
import { PosBillTemplate } from "@/components/invoice/PosBillTemplate";
import { StyledInvoiceTemplate } from "@/components/invoice/StyledInvoiceTemplate";
import { A6Template } from "@/components/invoice/A6Templates";

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
      .select("*, clients(display_name, email, tax_number, phone)")
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
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);

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
    const [pW, pHFixed] = paperSizes[paperKey] || paperSizes.a4;
    const MARGIN = paperKey === "pos80" ? 2 : 8; // mm
    const contentWidth = pW - MARGIN * 2;

    // Capture the actual styled template wrapper (.invoice-printable) so the
    // template's borders, header background, and full layout are preserved.
    const target = (invoiceRef.current.querySelector(".invoice-printable") as HTMLElement) || invoiceRef.current;
    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: target.scrollWidth,
    });

    const imgData = canvas.toDataURL("image/png");
    const imgWmm = contentWidth;
    const imgHmm = (canvas.height * imgWmm) / canvas.width;

    if (paperKey === "pos80") {
      // POS receipt: single continuous page sized to content height
      const pageH = imgHmm + MARGIN * 2;
      const pdf = new jsPDF("p", "mm", [pW, pageH]);
      pdf.addImage(imgData, "PNG", MARGIN, MARGIN, imgWmm, imgHmm);
      pdf.save(`${invoice?.invoice_number || "invoice"}.pdf`);
      return;
    }

    const pH = pHFixed;
    const contentHeight = pH - MARGIN * 2;
    const pdf = new jsPDF("p", "mm", [pW, pH]);

    if (imgHmm <= contentHeight) {
      pdf.addImage(imgData, "PNG", MARGIN, MARGIN, imgWmm, imgHmm);
    } else {
      // Slice the canvas into page-sized chunks
      const pxPerMM = canvas.height / imgHmm;
      const sliceHeightPx = contentHeight * pxPerMM;
      let renderedPx = 0;
      let pageIdx = 0;
      while (renderedPx < canvas.height) {
        const remainingPx = canvas.height - renderedPx;
        const thisSlicePx = Math.min(sliceHeightPx, remainingPx);
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = thisSlicePx;
        const ctx = slice.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, -renderedPx);
        const sliceMM = thisSlicePx / pxPerMM;
        if (pageIdx > 0) pdf.addPage([pW, pH]);
        pdf.addImage(slice.toDataURL("image/png"), "PNG", MARGIN, MARGIN, imgWmm, sliceMM);
        renderedPx += thisSlicePx;
        pageIdx += 1;
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
          const token = await getOrCreatePortalToken(org!.id, "invoice", id!);
          if (token) {
            await navigator.clipboard.writeText(portalUrl(token));
            toast({ title: "Portal link copied!" });
          }
        }}>
          <Share2 className="mr-1 h-4 w-4" /> Share Link
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"
          onClick={async () => {
            const token = await getOrCreatePortalToken(org!.id, "invoice", id!);
            const client: any = (invoice as any)?.clients;
            const msg = buildInvoiceWhatsappMessage({
              orgName: org?.name,
              clientName: client?.display_name,
              invoiceNumber: invoice.invoice_number,
              amountFormatted: fmt(Number(invoice.total)),
              dueDate: invoice.due_date,
              portalLink: token ? portalUrl(token) : null,
            });
            openWhatsappShare({ phone: client?.phone, message: msg });
            await supabase
              .from("invoices")
              .update({
                last_reminder_at: new Date().toISOString(),
                reminder_count: ((invoice as any).reminder_count || 0) + 1,
              })
              .eq("id", id!);
          }}
        >
          <MessageCircle className="mr-1 h-4 w-4" /> WhatsApp
        </Button>
      </PageHeader>

      {/* Status + Summary */}
      <div className="flex items-center gap-4">
        <StatusBadge status={invoice.status} />
        <span className="text-sm text-muted-foreground">
          {(invoice.clients as any)?.display_name} • Due {invoice.due_date}
        </span>
      </div>

      {/* Phase 5 — compliance badges */}
      {((invoice as any).irn || (invoice as any).eway_bill_no) && (
        <div className="flex flex-wrap gap-2 text-xs">
          {(invoice as any).irn && (
            <div className="rounded-md border bg-muted/40 px-3 py-2">
              <div className="font-medium">IRN</div>
              <div className="font-mono break-all">{(invoice as any).irn}</div>
              {(invoice as any).ack_no && (
                <div className="text-muted-foreground">Ack {(invoice as any).ack_no} · {(invoice as any).ack_date ? new Date((invoice as any).ack_date).toLocaleDateString() : ""}</div>
              )}
            </div>
          )}
          {(invoice as any).eway_bill_no && (
            <div className="rounded-md border bg-muted/40 px-3 py-2">
              <div className="font-medium">E-way Bill</div>
              <div className="font-mono">{(invoice as any).eway_bill_no}</div>
              <div className="text-muted-foreground">
                {(invoice as any).eway_vehicle_no && `Vehicle ${(invoice as any).eway_vehicle_no} · `}
                {(invoice as any).eway_transport_mode || ""}
                {(invoice as any).eway_distance_km && ` · ${(invoice as any).eway_distance_km} km`}
                {(invoice as any).eway_valid_until && ` · valid till ${new Date((invoice as any).eway_valid_until).toLocaleDateString()}`}
              </div>
            </div>
          )}
        </div>
      )}

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
      ) : ["alpha_blue", "monochrome", "amanda_cream", "redblue_modern"].includes(org?.template_style) ? (
        <div className={getDocumentPreviewClass(org?.template_style, org?.template_paper_size)}>
          <A6Template org={org} invoice={invoice} lines={lines} fmt={fmt} type="invoice" variant={org.template_style as any} />
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
