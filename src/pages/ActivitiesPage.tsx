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
import { Plus, Check, Trash2, Phone, Mail, MessageSquare, Users, ClipboardList, StickyNote } from "lucide-react";
import { format, parseISO } from "date-fns";

const TYPES = [
  { v: "call", l: "Call", icon: Phone },
  { v: "meeting", l: "Meeting", icon: Users },
  { v: "email", l: "Email", icon: Mail },
  { v: "whatsapp", l: "WhatsApp", icon: MessageSquare },
  { v: "task", l: "Task", icon: ClipboardList },
  { v: "note", l: "Note", icon: StickyNote },
];

const empty = { activity_type: "call", subject: "", body: "", due_at: "", lead_id: "", opportunity_id: "", client_id: "" };

export default function ActivitiesPage() {
  const org = useAppStore((s) => s.organization);
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [opps, setOpps] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [filter, setFilter] = useState<string>("all");

  const load = async () => {
    if (!org?.id) return;
    setLoading(true);
    const [{ data: act }, { data: ld }, { data: op }, { data: cl }] = await Promise.all([
      (supabase as any).from("activities").select("*, leads(name), opportunities(title), clients(name)").eq("org_id", org.id).order("due_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
      (supabase as any).from("leads").select("id,name").eq("org_id", org.id).order("name"),
      (supabase as any).from("opportunities").select("id,title").eq("org_id", org.id).order("title"),
      (supabase as any).from("clients").select("id,name").eq("org_id", org.id).order("name"),
    ]);
    setRows(act || []); setLeads(ld || []); setOpps(op || []); setClients(cl || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [org?.id]);

  const save = async () => {
    if (!org?.id || !form.subject.trim()) { toast({ title: "Subject required", variant: "destructive" }); return; }
    const payload: any = {
      org_id: org.id,
      activity_type: form.activity_type,
      subject: form.subject.trim(), body: form.body || null,
      due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
      lead_id: form.lead_id || null,
      opportunity_id: form.opportunity_id || null,
      client_id: form.client_id || null,
    };
    const { error } = await (supabase as any).from("activities").insert(payload);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else { setOpen(false); setForm(empty); load(); toast({ title: "Activity logged" }); }
  };

  const complete = async (id: string) => {
    await (supabase as any).from("activities").update({ completed_at: new Date().toISOString() }).eq("id", id);
    load();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete activity?")) return;
    await (supabase as any).from("activities").delete().eq("id", id);
    load();
  };

  const filtered = filter === "all" ? rows : rows.filter((r) => r.activity_type === filter);

  const typeIcon = (t: string) => {
    const T = TYPES.find((x) => x.v === t) || TYPES[0];
    const Icon = T.icon;
    return <Icon className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Activities</h1>
          <p className="text-sm text-muted-foreground">Calls, meetings, notes and tasks across leads, opportunities and clients.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Log Activity</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? <div className="p-8 text-center text-muted-foreground">Loading…</div>
          : filtered.length === 0 ? <div className="p-8 text-center text-muted-foreground">No activities.</div>
          : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Type</TableHead><TableHead>Subject</TableHead><TableHead>Linked To</TableHead>
                <TableHead>Due</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell><div className="flex items-center gap-2">{typeIcon(r.activity_type)}<span className="capitalize text-sm">{r.activity_type}</span></div></TableCell>
                    <TableCell className="font-medium">{r.subject}{r.body && <div className="text-xs text-muted-foreground truncate max-w-[280px]">{r.body}</div>}</TableCell>
                    <TableCell className="text-sm">
                      {r.leads?.name && <div>Lead: {r.leads.name}</div>}
                      {r.opportunities?.title && <div>Opp: {r.opportunities.title}</div>}
                      {r.clients?.name && <div>Client: {r.clients.name}</div>}
                      {!r.leads && !r.opportunities && !r.clients && <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm">{r.due_at ? format(parseISO(r.due_at), "dd MMM yyyy, HH:mm") : "—"}</TableCell>
                    <TableCell>{r.completed_at ? <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">Done</Badge> : <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">Open</Badge>}</TableCell>
                    <TableCell className="text-right">
                      {!r.completed_at && <Button variant="ghost" size="icon" onClick={() => complete(r.id)} title="Mark done"><Check className="h-4 w-4 text-green-600" /></Button>}
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
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Log Activity</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={form.activity_type} onValueChange={(v) => setForm({ ...form, activity_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Due Date/Time</Label><Input type="datetime-local" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} /></div>
            <div className="col-span-2"><Label>Subject *</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
            <div>
              <Label>Linked Lead</Label>
              <Select value={form.lead_id || "none"} onValueChange={(v) => setForm({ ...form, lead_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">—</SelectItem>{leads.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Linked Opportunity</Label>
              <Select value={form.opportunity_id || "none"} onValueChange={(v) => setForm({ ...form, opportunity_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">—</SelectItem>{opps.map((o) => <SelectItem key={o.id} value={o.id}>{o.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Linked Client</Label>
              <Select value={form.client_id || "none"} onValueChange={(v) => setForm({ ...form, client_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">—</SelectItem>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Notes</Label><Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
