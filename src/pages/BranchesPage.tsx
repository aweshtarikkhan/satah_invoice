import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function BranchesPage() {
  const org = useAppStore((s) => s.organization);
  const { toast } = useToast();
  const [list, setList] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", code: "", gstin: "", is_default: false });

  const load = async () => {
    if (!org?.id) return;
    const { data } = await (supabase as any).from("branches").select("*").eq("org_id", org.id).order("name");
    setList(data || []);
  };
  useEffect(() => { load(); }, [org?.id]);

  const save = async () => {
    if (!org?.id || !form.name) { toast({ title: "Name required", variant: "destructive" }); return; }
    if (form.is_default) await (supabase as any).from("branches").update({ is_default: false }).eq("org_id", org.id);
    const payload = { ...form, org_id: org.id };
    const { error } = editId
      ? await (supabase as any).from("branches").update(payload).eq("id", editId)
      : await (supabase as any).from("branches").insert(payload);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    setOpen(false); setForm({ name: "", code: "", gstin: "", is_default: false }); setEditId(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete branch?")) return;
    await (supabase as any).from("branches").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Branches</h1>
        <Button onClick={() => { setEditId(null); setForm({ name: "", code: "", gstin: "", is_default: false }); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add Branch
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All Branches ({list.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>GSTIN</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {list.map(b => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name} {b.is_default && <Badge className="ml-2" variant="outline">Default</Badge>}</TableCell>
                  <TableCell>{b.code || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{b.gstin || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => { setEditId(b.id); setForm({ name: b.name, code: b.code || "", gstin: b.gstin || "", is_default: b.is_default }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    {!b.is_default && <Button size="icon" variant="ghost" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Edit Branch" : "Add Branch"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Code</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
            <div><Label>GSTIN</Label><Input value={form.gstin} onChange={e => setForm({ ...form, gstin: e.target.value.toUpperCase() })} /></div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_default} onChange={e => setForm({ ...form, is_default: e.target.checked })} /> Mark as default branch
            </label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>{editId ? "Update" : "Add"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
