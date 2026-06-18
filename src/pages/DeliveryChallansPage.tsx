import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function DeliveryChallansPage() {
  const org = useAppStore((s) => s.organization);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!org?.id) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("delivery_challans")
      .select("*, clients(name), invoices(invoice_number)")
      .eq("org_id", org.id)
      .order("challan_date", { ascending: false });
    setRows(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [org?.id]);

  const remove = async (id: string) => {
    if (!confirm("Delete this challan?")) return;
    await (supabase as any).from("delivery_challan_lines").delete().eq("dc_id", id);
    const { error } = await (supabase as any).from("delivery_challans").delete().eq("id", id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Delivery Challans</h1>
        <Button onClick={() => navigate("/delivery-challans/new")}><Plus className="h-4 w-4 mr-1" /> New Challan</Button>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">All Challans</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="text-center py-8 text-muted-foreground">Loading…</div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Challan #</TableHead><TableHead>Client</TableHead>
                <TableHead>Date</TableHead><TableHead>Vehicle</TableHead>
                <TableHead>E-way Bill</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/delivery-challans/${r.id}/edit`)}>
                    <TableCell className="font-medium">{r.challan_number}</TableCell>
                    <TableCell>{r.clients?.name || "—"}</TableCell>
                    <TableCell>{format(new Date(r.challan_date), "dd MMM yyyy")}</TableCell>
                    <TableCell>{r.vehicle_number || "—"}</TableCell>
                    <TableCell>{r.eway_bill_number || "—"}</TableCell>
                    <TableCell><Badge>{r.status}</Badge></TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" onClick={() => navigate(`/delivery-challans/${r.id}/edit`)}><Eye className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!rows.length && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No challans yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
