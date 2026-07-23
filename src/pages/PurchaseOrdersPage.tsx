import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, Trash2, Download, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "@/lib/currency";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { ImportDialog, ImportField } from "@/components/shared/ImportDialog";

const poImportFields: ImportField[] = [
  { key: "po_number", label: "PO Number", required: true },
  { key: "vendor_name", label: "Vendor Name", required: true },
  { key: "po_date", label: "PO Date" },
  { key: "total", label: "Total Amount" },
  { key: "status", label: "Status" },
];

export default function PurchaseOrdersPage() {
  const org = useAppStore((s) => s.organization);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);

  const load = async () => {
    if (!org?.id) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("purchase_orders")
      .select("*, vendors(name)")
      .eq("org_id", org.id)
      .order("po_date", { ascending: false });
    setRows(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [org?.id]);

  const remove = async (id: string) => {
    if (!confirm("Delete this purchase order?")) return;
    await (supabase as any).from("purchase_order_lines").delete().eq("po_id", id);
    const { error } = await (supabase as any).from("purchase_orders").delete().eq("id", id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else load();
  };

  const convertToBill = async (e: React.MouseEvent, poId: string) => {
    e.stopPropagation();
    if (!confirm("Convert this PO into a Bill?")) return;
    setLoading(true);
    try {
      const { data: po } = await (supabase as any).from("purchase_orders").select("*").eq("id", poId).single();
      
      const { data: existingBill } = await (supabase as any)
        .from("bills")
        .select("id")
        .eq("vendor_bill_number", po.po_number)
        .eq("vendor_id", po.vendor_id)
        .maybeSingle();

      if (existingBill) {
        if (!confirm("This Purchase Order has already been converted to a Bill. Are you sure you want to convert it again?")) {
          setLoading(false);
          return;
        }
      }

      const { data: poLines } = await (supabase as any).from("purchase_order_lines").select("*").eq("po_id", poId);
      
      const { data: o } = await (supabase as any).from("organizations").select("next_bill_number, bill_prefix").eq("id", org?.id).single();
      const nextNum = o?.next_bill_number || 1;
      const prefix = o?.bill_prefix || "BILL-";
      const billNumber = `${prefix}${String(nextNum).padStart(4, "0")}`;

      const billPayload = {
        org_id: org?.id,
        vendor_id: po.vendor_id,
        branch_id: po.branch_id || null,
        bill_number: billNumber,
        vendor_bill_number: po.po_number,
        bill_date: format(new Date(), "yyyy-MM-dd"),
        subtotal: po.subtotal || 0,
        tax_total: po.tax_amount || 0,
        total: po.total || 0,
        balance_due: po.total || 0,
        status: "received",
        notes: `Converted from PO: ${po.po_number}`
      };
      
      const { data: newBill, error: billErr } = await (supabase as any).from("bills").insert(billPayload).select().single();
      if (billErr) throw billErr;

      await (supabase as any).from("organizations").update({ next_bill_number: nextNum + 1 }).eq("id", org?.id);

      if (poLines && poLines.length > 0) {
        const linePayloads = poLines.map((l: any) => {
          const q = Number(l.quantity) || 0;
          const r = Number(l.rate) || 0;
          const tr = Number(l.tax_rate) || 0;
          const taxAmt = q * r * (tr / 100);
          return {
            org_id: org?.id,
            bill_id: newBill.id,
            description: l.description,
            hsn: l.hsn,
            quantity: l.quantity,
            rate: l.rate,
            tax_rate: l.tax_rate,
            tax_amount: taxAmt,
            amount: l.amount,
            sort_order: l.sort_order,
            item_id: l.item_id || null,
          };
        });
        await (supabase as any).from("bill_lines").insert(linePayloads);
      }

      await (supabase as any).from("purchase_orders").update({ status: "received" }).eq("id", poId);

      toast({ title: "Converted to Bill", description: `Successfully created ${billNumber}. The PO has been marked as received.` });
      load();
    } catch (err: any) {
      toast({ title: "Conversion failed", description: err.message, variant: "destructive" });
      setLoading(false);
    }
  };

  const statusColor: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    sent: "bg-blue-100 text-blue-700",
    partial: "bg-amber-100 text-amber-700",
    received: "bg-emerald-100 text-emerald-700",
    closed: "bg-slate-200 text-slate-700",
    cancelled: "bg-red-100 text-red-700",
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Purchase Orders</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Download className="mr-2 h-4 w-4" /> Import
          </Button>
          <Button onClick={() => navigate("/purchase-orders/new")}><Plus className="h-4 w-4 mr-1" /> New PO</Button>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">All Purchase Orders</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="text-center py-8 text-muted-foreground">Loading…</div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>#</TableHead><TableHead>Vendor</TableHead><TableHead>Date</TableHead>
                <TableHead>Expected</TableHead><TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/purchase-orders/${r.id}`)}>
                    <TableCell className="font-medium">{r.po_number}</TableCell>
                    <TableCell>{r.vendors?.name || "—"}</TableCell>
                    <TableCell>{format(new Date(r.po_date), "dd MMM yyyy")}</TableCell>
                    <TableCell>{r.expected_date ? format(new Date(r.expected_date), "dd MMM yyyy") : "—"}</TableCell>
                    <TableCell><Badge className={statusColor[r.status] || ""}>{r.status}</Badge></TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(r.total), (org as any)?.currency || "INR")}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" title="Convert to Bill" onClick={(e) => convertToBill(e, r.id)}><FileText className="h-4 w-4 text-emerald-600" /></Button>
                      <Button size="icon" variant="ghost" title="View" onClick={() => navigate(`/purchase-orders/${r.id}`)}><Eye className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" title="Delete" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!rows.length && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No purchase orders yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        entityName="Purchase Orders"
        fields={poImportFields}
        onImport={async (rows) => {
          let s = 0, e = 0;
          for (const row of rows) {
            const { error } = await supabase.from("purchase_orders").insert({
              org_id: org?.id,
              po_number: row.po_number,
              total: Number(row.total) || 0,
              status: row.status || "draft",
              po_date: row.po_date || new Date().toISOString()
            });
            if (error) e++; else s++;
          }
          load();
          return { success: s, errors: e };
        }}
      />
    </div>
  );
}
