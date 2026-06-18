import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "@/lib/currency";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function BillsPage() {
  const org = useAppStore((s) => s.organization);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!org?.id) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("bills")
      .select("*, vendors(name)")
      .eq("org_id", org.id)
      .order("bill_date", { ascending: false });
    setBills(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [org?.id]);

  const remove = async (id: string) => {
    if (!confirm("Delete this bill?")) return;
    await (supabase as any).from("bill_lines").delete().eq("bill_id", id);
    await (supabase as any).from("bill_payments").delete().eq("bill_id", id);
    const { error } = await (supabase as any).from("bills").delete().eq("id", id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else load();
  };

  const statusColor: Record<string, string> = {
    draft: "bg-muted text-muted-foreground", received: "bg-blue-100 text-blue-700",
    partial: "bg-amber-100 text-amber-700", paid: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-red-100 text-red-700",
  };

  const totalDue = bills.reduce((s, b) => s + (Number(b.balance_due) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Bills (Accounts Payable)</h1>
        <Button onClick={() => navigate("/bills/new")}><Plus className="h-4 w-4 mr-1" /> New Bill</Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Total Bills</div><div className="text-2xl font-semibold">{bills.length}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Outstanding</div><div className="text-2xl font-semibold text-amber-600">{formatCurrency(totalDue)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Unpaid Bills</div><div className="text-2xl font-semibold">{bills.filter(b => b.balance_due > 0).length}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All Bills</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="text-center py-8 text-muted-foreground">Loading…</div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills.map(b => (
                  <TableRow key={b.id} className="cursor-pointer" onClick={() => navigate(`/bills/${b.id}`)}>
                    <TableCell className="font-medium">{b.bill_number}</TableCell>
                    <TableCell>{b.vendors?.name || "—"}</TableCell>
                    <TableCell>{format(new Date(b.bill_date), "dd MMM yyyy")}</TableCell>
                    <TableCell>{b.due_date ? format(new Date(b.due_date), "dd MMM yyyy") : "—"}</TableCell>
                    <TableCell><Badge className={statusColor[b.status] || ""}>{b.status}</Badge></TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(b.total))}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(Number(b.balance_due))}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" onClick={() => navigate(`/bills/${b.id}`)}><Eye className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!bills.length && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No bills yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
