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
import { Plus, Pencil, Trash2, ArrowRightCircle, Search } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { format, parseISO } from "date-fns";

const STATUSES = [
  { v: "new", l: "New", cls: "bg-slate-100 text-slate-800 border-slate-300" },
  { v: "contacted", l: "Contacted", cls: "bg-blue-100 text-blue-800 border-blue-300" },
  { v: "qualified", l: "Qualified", cls: "bg-purple-100 text-purple-800 border-purple-300" },
  { v: "converted", l: "Converted", cls: "bg-green-100 text-green-800 border-green-300" },
  { v: "lost", l: "Lost", cls: "bg-red-100 text-red-800 border-red-300" },
];

const emptyForm = { name: "", company: "", email: "", phone: "", source: "", status: "new", estimated_value: "0", notes: "", tags: "" };

export default function LeadsPage() {
  const org = useAppStore((s) => s.organization);
  const { toast } = useToast();
  const currency = (org as any)?.currency || "INR";
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyForm);

  const load = async () => {
    if (!org?.id) return;
    setLoading(true);
    const { data, error } = await (supabase as any).from("leads").select("*").eq("org_id", org.id).order("created_at", { ascending: false });
    if (error) toast({ title: "Load failed", description: error.message, variant: "destructive" });
    setRows(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [org?.id]);

  const openNew = () => { setEditId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (l: any) => {
    setEditId(l.id);
    setForm({
      name: l.name, company: l.company || "", email: l.email || "", phone: l.phone || "",
      source: l.source || "", status: l.status, estimated_value: String(l.estimated_value || 0),
      notes: l.notes || "", tags: (l.tags || []).join(", "),
    });
    setOpen(true);
  };

  const save = async () => {
    if (!org?.id || !form.name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    const payload: any = {
      org_id: org.id,
      name: form.name.trim(), company: form.company || null, email: form.email || null, phone: form.phone || null,
      source: form.source || null, status: form.status,
      estimated_value: Number(form.estimated_value) || 0, notes: form.notes || null,
      tags: form.tags ? form.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
    };
    const q = editId
      ? (supabase as any).from("leads").update(payload).eq("id", editId)
      : (supabase as any).from("leads").insert(payload);
    const { error } = await q;
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else { setOpen(false); load(); toast({ title: editId ? "Lead updated" : "Lead added" }); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this lead? Linked activities will also be removed.")) return;
    const { error } = await (supabase as any).from("leads").delete().eq("id", id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else load();
  };

  const convertToClient = async (l: any) => {
    if (!org?.id) return;
    if (!confirm(`Convert "${l.name}" into a Client?`)) return;
    const { data: client, error } = await (supabase as any).from("clients").insert({
      org_id: org.id,
      display_name: l.company || l.name,
      company_name: l.company || null,
      email: l.email || null,
      phone: l.phone || null,
      notes: `Converted from lead. Contact: ${l.name}`,
    }).select("*").single();
    if (error) { toast({ title: "Convert failed", description: error.message, variant: "destructive" }); return; }
    await (supabase as any).from("leads").update({ status: "converted", converted_client_id: client.id }).eq("id", l.id);
    toast({ title: "Converted to Client", description: client.name });
    load();
  };

  const filtered = rows.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (r.name?.toLowerCase().includes(s) || r.company?.toLowerCase().includes(s) || r.email?.toLowerCase().includes(s) || r.phone?.toLowerCase().includes(s));
  });

  const statusBadge = (s: string) => {
    const o = STATUSES.find((x) => x.v === s) || STATUSES[0];
    return <Badge variant="outline" className={o.cls}>{o.l}</Badge>;
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-sm text-muted-foreground">Capture prospects and qualify them before promoting to Opportunities.</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New Lead</Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? <div className="p-8 text-center text-muted-foreground">Loading…</div>
          : filtered.length === 0 ? <div className="p-8 text-center text-muted-foreground">No leads found.</div>
          : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Company</TableHead><TableHead>Contact</TableHead>
                <TableHead>Source</TableHead><TableHead>Status</TableHead>
                <TableHead className="text-right">Est. Value</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.name}<div className="text-xs text-muted-foreground">{format(parseISO(l.created_at), "dd MMM yyyy")}</div></TableCell>
                    <TableCell>{l.company || "—"}</TableCell>
                    <TableCell><div className="text-sm">{l.email || "—"}</div><div className="text-xs text-muted-foreground">{l.phone || ""}</div></TableCell>
                    <TableCell>{l.source || "—"}</TableCell>
                    <TableCell>{statusBadge(l.status)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(l.estimated_value || 0), currency)}</TableCell>
                    <TableCell className="text-right">
                      {l.status !== "converted" && (
                        <Button variant="ghost" size="icon" title="Convert to Client" onClick={() => convertToClient(l)}><ArrowRightCircle className="h-4 w-4 text-green-600" /></Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => openEdit(l)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(l.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit" : "New"} Lead</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Company</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
            <div><Label>Source</Label><Input placeholder="Website, Referral…" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Estimated Value</Label><Input type="number" value={form.estimated_value} onChange={(e) => setForm({ ...form, estimated_value: e.target.value })} /></div>
            <div className="col-span-2"><Label>Tags (comma separated)</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></div>
            <div className="col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>{editId ? "Save" : "Add Lead"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
