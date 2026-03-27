import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Edit, ArrowRightLeft, Send, XCircle, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const statusVariants: Record<string, "default" | "info" | "success" | "warning" | "danger" | "muted"> = {
  draft: "muted", sent: "info", viewed: "default", accepted: "success",
  declined: "danger", expired: "warning", converted: "success",
};

export default function EstimateDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const org = useAppStore((s) => s.organization);
  const { toast } = useToast();
  const [estimate, setEstimate] = useState<any>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [client, setClient] = useState<any>(null);

  const fetchData = async () => {
    if (!id) return;
    const { data: est } = await supabase.from("estimates").select("*").eq("id", id).single();
    if (!est) return;
    setEstimate(est);
    const [{ data: lineData }, { data: cl }] = await Promise.all([
      supabase.from("estimate_lines").select("*").eq("estimate_id", id).order("sort_order"),
      supabase.from("clients").select("*").eq("id", est.client_id).single(),
    ]);
    setLines(lineData || []);
    setClient(cl);
  };

  useEffect(() => { fetchData(); }, [id]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: org?.currency_code || "USD" }).format(n);

  const updateStatus = async (status: any, extra: Record<string, any> = {}) => {
    await supabase.from("estimates").update({ status, ...extra }).eq("id", id);
    toast({ title: `Estimate marked as ${status}` });
    fetchData();
  };

  const handleConvertToInvoice = async () => {
    if (!estimate || !org) return;
    const prefix = org.invoice_prefix || "INV";
    const num = org.invoice_next_number || 1;
    const year = new Date().getFullYear();
    const invoiceNumber = `${prefix}-${year}-${String(num).padStart(4, "0")}`;

    const { data: inv, error } = await supabase.from("invoices").insert({
      org_id: org.id, client_id: estimate.client_id, invoice_number: invoiceNumber,
      status: "draft", issue_date: new Date().toISOString().split("T")[0],
      due_date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      currency_code: estimate.currency_code, discount: estimate.discount,
      discount_type: estimate.discount_type, shipping_charge: estimate.shipping_charge,
      adjustment: estimate.adjustment, adjustment_name: estimate.adjustment_name,
      subtotal: estimate.subtotal, total_tax: estimate.total_tax,
      total_discount: estimate.total_discount, total: estimate.total,
      balance_due: estimate.total, notes: estimate.notes, terms_conditions: estimate.terms_conditions,
    }).select().single();

    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }

    const linePayloads = lines.map((l, i) => ({
      invoice_id: inv.id, item_id: l.item_id, name: l.name, description: l.description,
      quantity: l.quantity, rate: l.rate, discount: l.discount, discount_type: l.discount_type,
      tax_id: l.tax_id, tax_amount: l.tax_amount, amount: l.amount, sort_order: i,
    }));
    await supabase.from("invoice_lines").insert(linePayloads);
    await supabase.from("estimates").update({ status: "converted", converted_invoice_id: inv.id }).eq("id", id);
    await supabase.from("organizations").update({ invoice_next_number: num + 1 }).eq("id", org.id);

    toast({ title: "Estimate converted to invoice!" });
    navigate(`/invoices/${inv.id}`);
  };

  if (!estimate) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/estimates")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{estimate.estimate_number}</h1>
            <StatusBadge variant={statusVariants[estimate.status] || "muted"}>
              {estimate.status.charAt(0).toUpperCase() + estimate.status.slice(1)}
            </StatusBadge>
          </div>
        </div>
        <div className="flex gap-2">
          {estimate.status === "draft" && (
            <>
              <Button variant="outline" onClick={() => navigate(`/estimates/${id}/edit`)}>
                <Edit className="mr-1 h-4 w-4" /> Edit
              </Button>
              <Button variant="outline" onClick={() => updateStatus("sent", { sent_at: new Date().toISOString() })}>
                <Send className="mr-1 h-4 w-4" /> Mark as Sent
              </Button>
            </>
          )}
          {(estimate.status === "sent" || estimate.status === "viewed") && (
            <>
              <Button variant="outline" onClick={() => updateStatus("accepted", { accepted_at: new Date().toISOString() })}>
                <CheckCircle className="mr-1 h-4 w-4" /> Accept
              </Button>
              <Button variant="outline" onClick={() => updateStatus("declined", { declined_at: new Date().toISOString() })}>
                <XCircle className="mr-1 h-4 w-4" /> Decline
              </Button>
            </>
          )}
          {estimate.status !== "converted" && estimate.status !== "declined" && (
            <Button onClick={handleConvertToInvoice}>
              <ArrowRightLeft className="mr-1 h-4 w-4" /> Convert to Invoice
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Client</CardTitle></CardHeader>
          <CardContent>
            <p className="font-medium">{client?.display_name}</p>
            {client?.email && <p className="text-sm text-muted-foreground">{client.email}</p>}
            {client?.company_name && <p className="text-sm text-muted-foreground">{client.company_name}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Details</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Issue Date</span><span>{format(new Date(estimate.issue_date), "MMM dd, yyyy")}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Expiry Date</span><span>{format(new Date(estimate.expiry_date), "MMM dd, yyyy")}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Currency</span><span>{estimate.currency_code}</span></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-center">Qty</TableHead>
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
                  <TableCell className="text-center">{line.quantity}</TableCell>
                  <TableCell className="text-right">{fmt(Number(line.rate))}</TableCell>
                  <TableCell className="text-right">{fmt(Number(line.tax_amount))}</TableCell>
                  <TableCell className="text-right font-medium">{fmt(Number(line.amount))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 border-t pt-4 space-y-2 max-w-xs ml-auto">
            <div className="flex justify-between text-sm"><span>Subtotal</span><span>{fmt(Number(estimate.subtotal))}</span></div>
            {Number(estimate.total_discount) > 0 && (
              <div className="flex justify-between text-sm"><span>Discount</span><span>-{fmt(Number(estimate.total_discount))}</span></div>
            )}
            {Number(estimate.total_tax) > 0 && (
              <div className="flex justify-between text-sm"><span>Tax</span><span>{fmt(Number(estimate.total_tax))}</span></div>
            )}
            {Number(estimate.shipping_charge) > 0 && (
              <div className="flex justify-between text-sm"><span>Shipping</span><span>{fmt(Number(estimate.shipping_charge))}</span></div>
            )}
            {Number(estimate.adjustment) !== 0 && (
              <div className="flex justify-between text-sm"><span>{estimate.adjustment_name || "Adjustment"}</span><span>{fmt(Number(estimate.adjustment))}</span></div>
            )}
            <div className="border-t pt-2 flex justify-between font-bold text-lg">
              <span>Total</span><span>{fmt(Number(estimate.total))}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {estimate.notes && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{estimate.notes}</p></CardContent>
        </Card>
      )}
    </div>
  );
}
