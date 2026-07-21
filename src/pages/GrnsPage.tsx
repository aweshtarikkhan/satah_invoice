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

export default function GrnsPage() {
  const org = useAppStore((s) => s.organization);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!org?.id) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("grns")
      .select("*, vendors(name), purchase_orders(po_number)")
      .eq("org_id", org.id)
      .order("grn_date", { ascending: false });
    setRows(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [org?.id]);

  const remove = async (id: string) => {
    if (!confirm("Delete GRN? Stock movements created by this GRN will not be auto-reversed.")) return;
    await (supabase as any).from("grn_lines").delete().eq("grn_id", id);
    const { error } = await (supabase as any).from("grns").delete().eq("id", id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else load();
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Goods Receipt Notes</h1>
        <Button onClick={() => navigate("/grns/new")}><Plus className="h-4 w-4 mr-1" /> New GRN</Button>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">All GRNs</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="text-center py-8 text-muted-foreground">Loading…</div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>GRN #</TableHead><TableHead>PO #</TableHead><TableHead>Vendor</TableHead>
                <TableHead>Date</TableHead><TableHead>Vehicle</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/grns/${r.id}`)}>
                    <TableCell className="font-medium">{r.grn_number}</TableCell>
                    <TableCell>{r.purchase_orders?.po_number || "—"}</TableCell>
                    <TableCell>{r.vendors?.name || "—"}</TableCell>
                    <TableCell>{format(new Date(r.grn_date), "dd MMM yyyy")}</TableCell>
                    <TableCell>{r.vehicle_number || "—"}</TableCell>
                    <TableCell><Badge>{r.status}</Badge></TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" onClick={() => navigate(`/grns/${r.id}`)}><Eye className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!rows.length && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No GRNs yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
