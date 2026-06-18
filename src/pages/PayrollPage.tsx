import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, ArrowRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { formatCurrency } from "@/lib/currency";

const statusBadge = (s: string) => {
  const map: any = {
    draft: "bg-amber-100 text-amber-800 border-amber-300",
    approved: "bg-blue-100 text-blue-800 border-blue-300",
    paid: "bg-green-100 text-green-800 border-green-300",
  };
  return <Badge variant="outline" className={map[s] || ""}>{s}</Badge>;
};

export default function PayrollPage() {
  const org = useAppStore((s) => s.organization);
  const navigate = useNavigate();
  const { toast } = useToast();
  const currency = (org as any)?.currency || "INR";
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));

  const load = async () => {
    if (!org?.id) return;
    setLoading(true);
    const { data, error } = await (supabase as any).from("payroll_runs").select("*").eq("org_id", org.id).order("period_month", { ascending: false });
    if (error) toast({ title: "Load failed", description: error.message, variant: "destructive" });
    setRows(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [org?.id]);

  const create = async () => {
    if (!org?.id) return;
    const period = `${month}-01`;
    const { data, error } = await (supabase as any).from("payroll_runs")
      .insert({ org_id: org.id, period_month: period, status: "draft" })
      .select("*").single();
    if (error) { toast({ title: "Create failed", description: error.message, variant: "destructive" }); return; }
    setOpen(false);
    navigate(`/payroll/${data.id}`);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Payroll</h1>
          <p className="text-sm text-muted-foreground">Run monthly payroll, generate payslips and mark salaries paid.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />New Payroll Run</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? <div className="p-8 text-center text-muted-foreground">Loading…</div>
          : rows.length === 0 ? <div className="p-8 text-center text-muted-foreground">No payroll runs yet.</div>
          : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Period</TableHead><TableHead>Status</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Net Payable</TableHead>
                <TableHead className="text-right">Open</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/payroll/${r.id}`)}>
                    <TableCell className="font-medium">{format(parseISO(r.period_month), "MMMM yyyy")}</TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(r.total_gross || 0), currency)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(r.total_deductions || 0), currency)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(Number(r.total_net || 0), currency)}</TableCell>
                    <TableCell className="text-right"><ArrowRight className="h-4 w-4 inline" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Payroll Run</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Period (Month)</Label><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
            <p className="text-xs text-muted-foreground">Payslips will be generated from attendance and salary structure.</p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={create}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
