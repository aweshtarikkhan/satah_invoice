import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, CalendarCheck } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { NavLink } from "@/components/NavLink";

interface Employee {
  id: string;
  org_id: string;
  name: string;
  employee_code: string | null;
  designation: string | null;
  phone: string | null;
  email: string | null;
  joining_date: string | null;
  monthly_salary: number;
  paid_leaves_per_month: number;
  is_active: boolean;
  notes: string | null;
}

const empty = {
  name: "", employee_code: "", designation: "", phone: "", email: "",
  joining_date: "", monthly_salary: "0", paid_leaves_per_month: "2",
  is_active: true, notes: "",
  pan: "", bank_account: "", bank_ifsc: "", address: "",
  basic_percent: "50", hra_percent: "20",
  pf_applicable: false, esic_applicable: false,
};

export default function EmployeesPage() {
  const org = useAppStore((s) => s.organization);
  const { toast } = useToast();
  const [rows, setRows] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(empty);

  const load = async () => {
    if (!org?.id) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("employees").select("*").eq("org_id", org.id).order("created_at", { ascending: false });
    if (error) toast({ title: "Failed to load", description: error.message, variant: "destructive" });
    else setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [org?.id]);

  const openNew = () => { setEditId(null); setForm(empty); setOpen(true); };
  const openEdit = (e: Employee) => {
    setEditId(e.id);
    setForm({
      name: e.name, employee_code: e.employee_code || "", designation: e.designation || "",
      phone: e.phone || "", email: e.email || "", joining_date: e.joining_date || "",
      monthly_salary: String(e.monthly_salary), paid_leaves_per_month: String(e.paid_leaves_per_month),
      is_active: e.is_active, notes: e.notes || "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!org?.id) return;
    if (!form.name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    const payload: any = {
      org_id: org.id,
      name: form.name.trim(),
      employee_code: form.employee_code || null,
      designation: form.designation || null,
      phone: form.phone || null,
      email: form.email || null,
      joining_date: form.joining_date || null,
      monthly_salary: Number(form.monthly_salary) || 0,
      paid_leaves_per_month: Number(form.paid_leaves_per_month) || 0,
      is_active: !!form.is_active,
      notes: form.notes || null,
    };
    const q = editId
      ? (supabase as any).from("employees").update(payload).eq("id", editId)
      : (supabase as any).from("employees").insert(payload);
    const { error } = await q;
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: editId ? "Employee updated" : "Employee added" });
    setOpen(false); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this employee? Their attendance records will also be removed.")) return;
    const { error } = await (supabase as any).from("employees").delete().eq("id", id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Deleted" }); load(); }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Employees</h1>
          <p className="text-sm text-muted-foreground">Manage your staff and their monthly salaries.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <NavLink to="/attendance"><CalendarCheck className="h-4 w-4 mr-2" />Attendance</NavLink>
          </Button>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New Employee</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Monthly Salary</TableHead>
                <TableHead className="text-right">Paid Leaves/mo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No employees yet. Click "New Employee" to add one.</TableCell></TableRow>
              ) : rows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell>{e.employee_code || "—"}</TableCell>
                  <TableCell>{e.designation || "—"}</TableCell>
                  <TableCell>{e.phone || "—"}</TableCell>
                  <TableCell className="text-right">{formatCurrency(e.monthly_salary, (org as any)?.currency || "INR")}</TableCell>
                  <TableCell className="text-right">{e.paid_leaves_per_month}</TableCell>
                  <TableCell>{e.is_active ? <span className="text-green-600 text-xs font-medium">Active</span> : <span className="text-muted-foreground text-xs">Inactive</span>}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(e.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editId ? "Edit" : "New"} Employee</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Employee Code</Label><Input value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} /></div>
            <div><Label>Designation</Label><Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Joining Date</Label><Input type="date" value={form.joining_date} onChange={(e) => setForm({ ...form, joining_date: e.target.value })} /></div>
            <div><Label>Monthly Salary</Label><Input type="number" value={form.monthly_salary} onChange={(e) => setForm({ ...form, monthly_salary: e.target.value })} /></div>
            <div><Label>Paid Leaves / Month</Label><Input type="number" step="0.5" value={form.paid_leaves_per_month} onChange={(e) => setForm({ ...form, paid_leaves_per_month: e.target.value })} /></div>
            <div className="flex items-center gap-2 mt-6"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>Active</Label></div>
            <div className="col-span-2"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editId ? "Save Changes" : "Add Employee"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
