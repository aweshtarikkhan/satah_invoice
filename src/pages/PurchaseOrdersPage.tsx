import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, Trash2, Download } from "lucide-react";
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
                      <Button size="icon" variant="ghost" onClick={() => navigate(`/purchase-orders/${r.id}`)}><Eye className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
