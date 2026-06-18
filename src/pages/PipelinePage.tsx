import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Settings2, GripVertical } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { format, parseISO } from "date-fns";

const emptyOpp = { title: "", stage_id: "", client_id: "", amount: "0", expected_close_date: "", probability: "0", notes: "" };

export default function PipelinePage() {
  const org = useAppStore((s) => s.organization);
  const { toast } = useToast();
  const currency = (org as any)?.currency || "INR";
  const [stages, setStages] = useState<any[]>([]);
  const [opps, setOpps] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyOpp);
  const [stagesOpen, setStagesOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const load = async () => {
    if (!org?.id) return;
    setLoading(true);
    let { data: st } = await (supabase as any).from("pipeline_stages").select("*").eq("org_id", org.id).order("sort_order");
    if (!st || st.length === 0) {
      await (supabase as any).rpc("seed_default_pipeline", { p_org_id: org.id });
      ({ data: st } = await (supabase as any).from("pipeline_stages").select("*").eq("org_id", org.id).order("sort_order"));
    }
    const [{ data: op }, { data: cl }] = await Promise.all([
      (supabase as any).from("opportunities").select("*, clients(name)").eq("org_id", org.id).order("sort_order"),
      (supabase as any).from("clients").select("id,name").eq("org_id", org.id).order("name"),
    ]);
    setStages(st || []); setOpps(op || []); setClients(cl || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [org?.id]);

  const oppsByStage = useMemo(() => {
    const m: Record<string, any[]> = {};
    stages.forEach((s) => { m[s.id] = []; });
    opps.forEach((o) => { if (o.stage_id && m[o.stage_id]) m[o.stage_id].push(o); });
    return m;
  }, [stages, opps]);

  const openNew = (stageId?: string) => {
    setEditId(null);
    setForm({ ...emptyOpp, stage_id: stageId || stages[0]?.id || "" });
    setOpen(true);
  };
  const openEdit = (o: any) => {
    setEditId(o.id);
    setForm({
      title: o.title, stage_id: o.stage_id || "", client_id: o.client_id || "",
      amount: String(o.amount || 0), expected_close_date: o.expected_close_date || "",
      probability: String(o.probability || 0), notes: o.notes || "",
    });
    setOpen(true);
  };
  const save = async () => {
    if (!org?.id || !form.title.trim() || !form.stage_id) {
      toast({ title: "Title and stage required", variant: "destructive" }); return;
    }
    const stage = stages.find((s) => s.id === form.stage_id);
    const payload: any = {
      org_id: org.id,
      title: form.title.trim(),
      stage_id: form.stage_id,
      client_id: form.client_id || null,
      amount: Number(form.amount) || 0,
      currency,
      expected_close_date: form.expected_close_date || null,
      probability: Number(form.probability) || stage?.win_probability || 0,
      notes: form.notes || null,
    };
    const q = editId
      ? (supabase as any).from("opportunities").update(payload).eq("id", editId)
      : (supabase as any).from("opportunities").insert(payload);
    const { error } = await q;
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else { setOpen(false); load(); toast({ title: editId ? "Opportunity updated" : "Opportunity added" }); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete opportunity?")) return;
    await (supabase as any).from("opportunities").delete().eq("id", id);
    load();
  };

  const moveTo = async (oppId: string, stageId: string) => {
    const opp = opps.find((o) => o.id === oppId);
    if (!opp || opp.stage_id === stageId) return;
    const stage = stages.find((s) => s.id === stageId);
    const patch: any = { stage_id: stageId };
    if (stage) patch.probability = stage.win_probability;
    setOpps((prev) => prev.map((o) => (o.id === oppId ? { ...o, ...patch } : o)));
    const { error } = await (supabase as any).from("opportunities").update(patch).eq("id", oppId);
    if (error) { toast({ title: "Move failed", description: error.message, variant: "destructive" }); load(); }
  };

  const stageTotals = (stageId: string) => {
    const list = oppsByStage[stageId] || [];
    const total = list.reduce((s, o) => s + Number(o.amount || 0), 0);
    const weighted = list.reduce((s, o) => s + Number(o.amount || 0) * (Number(o.probability || 0) / 100), 0);
    return { count: list.length, total, weighted };
  };

  const grandTotals = useMemo(() => {
    const total = opps.reduce((s, o) => s + Number(o.amount || 0), 0);
    const weighted = opps.reduce((s, o) => s + Number(o.amount || 0) * (Number(o.probability || 0) / 100), 0);
    return { total, weighted, count: opps.length };
  }, [opps]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Sales Pipeline</h1>
          <p className="text-sm text-muted-foreground">Drag opportunities across stages. Weighted value uses each stage's win probability.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setStagesOpen(true)}><Settings2 className="h-4 w-4 mr-2" />Stages</Button>
          <Button onClick={() => openNew()}><Plus className="h-4 w-4 mr-2" />New Opportunity</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Open Opportunities</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{grandTotals.count}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pipeline Value</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{formatCurrency(grandTotals.total, currency)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Weighted Forecast</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-primary">{formatCurrency(grandTotals.weighted, currency)}</CardContent></Card>
      </div>

      {loading ? <div className="p-8 text-center text-muted-foreground">Loading…</div> : (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3 min-w-max">
            {stages.map((s) => {
              const t = stageTotals(s.id);
              return (
                <div
                  key={s.id}
                  className="w-72 shrink-0 rounded-lg bg-muted/30 border"
                  onDragOver={(e) => { e.preventDefault(); }}
                  onDrop={(e) => { e.preventDefault(); if (draggingId) { moveTo(draggingId, s.id); setDraggingId(null); } }}
                >
                  <div className="p-3 border-b flex items-center justify-between" style={{ borderTopColor: s.color || undefined, borderTopWidth: 3 }}>
                    <div>
                      <div className="font-semibold text-sm">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{t.count} · {formatCurrency(t.total, currency)}</div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => openNew(s.id)}><Plus className="h-4 w-4" /></Button>
                  </div>
                  <div className="p-2 space-y-2 min-h-[120px]">
                    {(oppsByStage[s.id] || []).map((o) => (
                      <div
                        key={o.id}
                        draggable
                        onDragStart={() => setDraggingId(o.id)}
                        onDragEnd={() => setDraggingId(null)}
                        className="bg-background border rounded-md p-2 shadow-sm cursor-grab active:cursor-grabbing hover:border-primary/40"
                        onDoubleClick={() => openEdit(o)}
                      >
                        <div className="flex items-start gap-1">
                          <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{o.title}</div>
                            <div className="text-xs text-muted-foreground truncate">{o.clients?.name || "—"}</div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-sm font-semibold">{formatCurrency(Number(o.amount || 0), currency)}</span>
                              <Badge variant="outline" className="text-[10px]">{o.probability || 0}%</Badge>
                            </div>
                            {o.expected_close_date && <div className="text-[10px] text-muted-foreground mt-1">Close: {format(parseISO(o.expected_close_date), "dd MMM")}</div>}
                          </div>
                          <div className="flex flex-col">
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(o)}><Pencil className="h-3 w-3" /></Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => remove(o.id)}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editId ? "Edit" : "New"} Opportunity</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div>
              <Label>Stage *</Label>
              <Select value={form.stage_id} onValueChange={(v) => setForm({ ...form, stage_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Client</Label>
              <Select value={form.client_id || "none"} onValueChange={(v) => setForm({ ...form, client_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div><Label>Probability %</Label><Input type="number" value={form.probability} onChange={(e) => setForm({ ...form, probability: e.target.value })} /></div>
            <div className="col-span-2"><Label>Expected Close Date</Label><Input type="date" value={form.expected_close_date} onChange={(e) => setForm({ ...form, expected_close_date: e.target.value })} /></div>
            <div className="col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>{editId ? "Save" : "Add"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <StagesDialog open={stagesOpen} onOpenChange={setStagesOpen} stages={stages} onChanged={load} />
    </div>
  );
}

function StagesDialog({ open, onOpenChange, stages, onChanged }: any) {
  const org = useAppStore((s) => s.organization);
  const { toast } = useToast();
  const [local, setLocal] = useState<any[]>([]);
  useEffect(() => { if (open) setLocal(stages.map((s: any) => ({ ...s }))); }, [open, stages]);

  const add = () => setLocal((p) => [...p, { id: `new_${Date.now()}`, name: "New Stage", sort_order: (p.at(-1)?.sort_order || 0) + 10, win_probability: 50, is_won: false, is_lost: false, color: "#94a3b8", _new: true }]);
  const update = (i: number, patch: any) => setLocal((p) => p.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const del = async (i: number) => {
    const s = local[i];
    if (!s._new && !confirm("Delete this stage? Opportunities in it will become unassigned.")) return;
    if (!s._new) await (supabase as any).from("pipeline_stages").delete().eq("id", s.id);
    setLocal((p) => p.filter((_, idx) => idx !== i));
  };
  const saveAll = async () => {
    if (!org?.id) return;
    for (const s of local) {
      const payload = { name: s.name, sort_order: Number(s.sort_order), win_probability: Number(s.win_probability), is_won: !!s.is_won, is_lost: !!s.is_lost, color: s.color };
      if (s._new) await (supabase as any).from("pipeline_stages").insert({ ...payload, org_id: org.id });
      else await (supabase as any).from("pipeline_stages").update(payload).eq("id", s.id);
    }
    toast({ title: "Stages saved" });
    onOpenChange(false); onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Pipeline Stages</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {local.map((s, i) => (
            <div key={s.id} className="grid grid-cols-12 gap-2 items-center">
              <Input className="col-span-4" value={s.name} onChange={(e) => update(i, { name: e.target.value })} />
              <Input className="col-span-2" type="number" value={s.sort_order} onChange={(e) => update(i, { sort_order: e.target.value })} placeholder="Order" />
              <Input className="col-span-2" type="number" value={s.win_probability} onChange={(e) => update(i, { win_probability: e.target.value })} placeholder="Win %" />
              <Input className="col-span-2" type="color" value={s.color || "#94a3b8"} onChange={(e) => update(i, { color: e.target.value })} />
              <Button variant="ghost" size="icon" className="col-span-1" onClick={() => del(i)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={add}><Plus className="h-4 w-4 mr-2" />Add Stage</Button>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={saveAll}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
