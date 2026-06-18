import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Check, X, Trash2 } from "lucide-react";
import { differenceInCalendarDays, parseISO, format } from "date-fns";

const TYPES = [
  { v: "casual", l: "Casual" },
  { v: "sick", l: "Sick" },
  { v: "paid", l: "Paid" },
  { v: "unpaid", l: "Unpaid (LOP)" },
  { v: "other", l: "Other" },
];

const statusBadge = (s: string) => {
  const map: any = {
    pending: "bg-amber-100 text-amber-800 border-amber-300",
    approved: "bg-green-100 text-green-800 border-green-300",
    rejected: "bg-red-100 text-red-800 border-red-300",
  };
  return <Badge variant="outline" className={map[s] || ""}>{s}</Badge>;
};

export default function LeavesPage() {
  const org = useAppStore((s) => s.organization);
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ employee_id: "", leave_type: "casual", start_date: "", end_date: "", reason: "" });

  const load = async () => {
    if (!org?.id) return;
    setLoading(true);
    const [lv, emps] = await Promise.all([
      (supabase as any).from("leaves").select("*, employees(name)").eq("org_id", org.id).order("created_at", { ascending: false }),
      (supabase as any).from("employees").select("id,name").eq("org_id", org.id).eq("is_active", true).order("name"),
    ]);
    if (lv.error) toast({ title: "Load failed", description: lv.error.message, variant: "destructive" });
    setRows(lv.data || []);
    setEmployees(emps.data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [org?.id]);

  const submit = async () => {
    if (!org?.id || !form.employee_id || !form.start_date || !form.end_date) {
      toast({ title: "Fill all required fields", variant: "destructive" }); return;
    }
    const days = Math.max(1, differenceInCalendarDays(parseISO(form.end_date), parseISO(form.start_date)) + 1);
    const { error } = await (supabase as any).from("leaves").insert({
      org_id: org.id, employee_id: form.employee_id, leave_type: form.leave_type,
      start_date: form.start_date, end_date: form.end_date, days, reason: form.reason, status: "pending",
    });
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else { setOpen(false); setForm({ employee_id: "", leave_type: "casual", start_date: "", end_date: "", reason: "" }); load(); toast({ title: "Leave request created" }); }
  };

  const setStatus = async (id: string, status: "approved" | "rejected") => {
    const { error } = await (supabase as any).from("leaves").update({ status, approved_at: new Date().toISOString() }).eq("id", id);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
    else load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete leave?")) return;
    const { error } = await (supabase as any).from("leaves").delete().eq("id", id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else load();
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Leaves</h1>
          <p className="text-sm text-muted-foreground">Track leave requests; approved leaves can be marked as Paid Leave in Attendance.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />New Request</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? <div className="p-8 text-center text-muted-foreground">Loading…</div>
          : rows.length === 0 ? <div className="p-8 text-center text-muted-foreground">No leave requests.</div>
          : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Employee</TableHead><TableHead>Type</TableHead><TableHead>From</TableHead>
                <TableHead>To</TableHead><TableHead>Days</TableHead><TableHead>Reason</TableHead>
                <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.employees?.name || "—"}</TableCell>
                    <TableCell className="capitalize">{r.leave_type}</TableCell>
                    <TableCell>{format(parseISO(r.start_date), "dd MMM yyyy")}</TableCell>
                    <TableCell>{format(parseISO(r.end_date), "dd MMM yyyy")}</TableCell>
                    <TableCell>{r.days}</TableCell>
                    <TableCell className="max-w-[240px] truncate">{r.reason || "—"}</TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="text-right">
                      {r.status === "pending" && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => setStatus(r.id, "approved")}><Check className="h-4 w-4 text-green-600" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setStatus(r.id, "rejected")}><X className="h-4 w-4 text-red-600" /></Button>
                        </>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Leave Request</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Employee</Label>
              <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.leave_type} onValueChange={(v) => setForm({ ...form, leave_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>From</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><Label>To</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div><Label>Reason</Label><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit}>Submit</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
