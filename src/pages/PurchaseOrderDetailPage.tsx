import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, ArrowLeft, PackageCheck } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { format } from "date-fns";

export default function PurchaseOrderDetailPage() {
  const org = useAppStore((s) => s.organization);
  const { id } = useParams();
  const navigate = useNavigate();
  const [po, setPo] = useState<any>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [grns, setGrns] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: p } = await (supabase as any).from("purchase_orders").select("*, vendors(name), branches(name), warehouses(name)").eq("id", id).maybeSingle();
      const { data: l } = await (supabase as any).from("purchase_order_lines").select("*").eq("po_id", id).order("sort_order");
      const { data: g } = await (supabase as any).from("grns").select("id,grn_number,grn_date,status").eq("po_id", id).order("grn_date", { ascending: false });
      setPo(p); setLines(l || []); setGrns(g || []);
    })();
  }, [id]);

  if (!po) return <div className="p-6 text-muted-foreground">Loading…</div>;
  const cur = (org as any)?.currency || "INR";

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button size="icon" variant="ghost" onClick={() => navigate("/purchase-orders")}><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-2xl font-semibold">{po.po_number}</h1>
          <Badge>{po.status}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/purchase-orders/${id}/edit`)}><Pencil className="h-4 w-4 mr-1" />Edit</Button>
          <Button onClick={() => navigate(`/grns/new?po=${id}`)}><PackageCheck className="h-4 w-4 mr-1" />Receive (GRN)</Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><div className="text-muted-foreground">Vendor</div><div className="font-medium">{po.vendors?.name || "—"}</div></div>
          <div><div className="text-muted-foreground">PO Date</div><div>{format(new Date(po.po_date), "dd MMM yyyy")}</div></div>
          <div><div className="text-muted-foreground">Expected</div><div>{po.expected_date ? format(new Date(po.expected_date), "dd MMM yyyy") : "—"}</div></div>
          <div><div className="text-muted-foreground">Warehouse</div><div>{po.warehouses?.name || "—"}</div></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Line Items</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Description</TableHead><TableHead>HSN</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Received</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {lines.map(l => (
                <TableRow key={l.id}>
                  <TableCell>{l.description}</TableCell>
                  <TableCell>{l.hsn || "—"}</TableCell>
                  <TableCell className="text-right">{l.quantity} {l.unit || ""}</TableCell>
                  <TableCell className="text-right">{l.received_quantity || 0}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(l.rate), cur)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(l.amount), cur)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 ml-auto w-72 space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(Number(po.subtotal), cur)}</span></div>
            <div className="flex justify-between"><span>Tax</span><span>{formatCurrency(Number(po.tax_amount), cur)}</span></div>
            <div className="flex justify-between font-semibold border-t pt-2"><span>Total</span><span>{formatCurrency(Number(po.total), cur)}</span></div>
          </div>
        </CardContent>
      </Card>

      {grns.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Goods Receipt Notes</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>GRN #</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {grns.map(g => (
                  <TableRow key={g.id} className="cursor-pointer" onClick={() => navigate(`/grns/${g.id}`)}>
                    <TableCell className="font-medium">{g.grn_number}</TableCell>
                    <TableCell>{format(new Date(g.grn_date), "dd MMM yyyy")}</TableCell>
                    <TableCell><Badge>{g.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {po.notes && <Card><CardContent className="pt-5 text-sm"><div className="text-muted-foreground mb-1">Notes</div><div>{po.notes}</div></CardContent></Card>}
    </div>
  );
}
