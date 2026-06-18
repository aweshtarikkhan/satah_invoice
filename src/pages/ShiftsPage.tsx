import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Shift {
  id: string; name: string; start_time: string; end_time: string;
  working_days: number[]; is_default: boolean;
}

const empty = { name: "", start_time: "09:00", end_time: "18:00", working_days: [1,2,3,4,5,6], is_default: false };

export default function ShiftsPage() {
  const org = useAppStore((s) => s.organization);
  const { toast } = useToast();
  const [rows, setRows] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(empty);

  const load = async () => {
    if (!org?.id) return;
    setLoading(true);
    const { data, error } = await (supabase as any).from("shifts").select("*").eq("org_id", org.id).order("created_at");
    if (error) toast({ title: "Load failed", description: error.message, variant: "destructive" });
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [org?.id]);

  const openCreate = () => { setEditId(null); setForm(empty); setOpen(true); };
  const openEdit = (s: Shift) => {
    setEditId(s.id);
    setForm({ name: s.name, start_time: s.start_time?.slice(0,5), end_time: s.end_time?.slice(0,5), working_days: s.working_days || [], is_default: s.is_default });
    setOpen(true);
  };

  const toggleDay = (d: number) => {
    setForm((f: any) => ({ ...f, working_days: f.working_days.includes(d) ? f.working_days.filter((x: number) => x !== d) : [...f.working_days, d].sort() }));
  };

  const save = async () => {
    if (!org?.id || !form.name) return;
    const payload: any = { org_id: org.id, name: form.name, start_time: form.start_time, end_time: form.end_time, working_days: form.working_days, is_default: form.is_default };
    const { error } = editId
      ? await (supabase as any).from("shifts").update(payload).eq("id", editId)
      : await (supabase as any).from("shifts").insert(payload);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else { setOpen(false); load(); toast({ title: "Shift saved" }); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete shift?")) return;
    const { error } = await (supabase as any).from("shifts").delete().eq("id", id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else load();
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Shifts</h1>
          <p className="text-sm text-muted-foreground">Define work schedules and weekly off days.</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />New Shift</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? <div className="p-8 text-center text-muted-foreground">Loading…</div>
          : rows.length === 0 ? <div className="p-8 text-center text-muted-foreground">No shifts yet.</div>
          : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Timing</TableHead><TableHead>Working Days</TableHead>
                <TableHead>Default</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.start_time?.slice(0,5)} – {s.end_time?.slice(0,5)}</TableCell>
                    <TableCell>{(s.working_days||[]).map((d) => DAY_NAMES[d]).join(", ")}</TableCell>
                    <TableCell>{s.is_default ? "Yes" : "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4" /></Button>
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
          <DialogHeader><DialogTitle>{editId ? "Edit Shift" : "New Shift"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="General / Morning" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
              <div><Label>End</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
            </div>
            <div>
              <Label>Working Days</Label>
              <div className="flex gap-2 mt-2">
                {DAY_NAMES.map((d, i) => (
                  <button key={i} type="button" onClick={() => toggleDay(i)}
                    className={`h-9 w-12 rounded border text-sm font-medium ${form.working_days.includes(i) ? "bg-primary text-primary-foreground" : "bg-background"}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.is_default} onCheckedChange={(c) => setForm({ ...form, is_default: c })} /><Label>Set as default</Label></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
