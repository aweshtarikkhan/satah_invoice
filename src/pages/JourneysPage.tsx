import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ArrowRight, Clock, MessageSquare } from "lucide-react";
import { toast } from "sonner";

const TRIGGER_LABELS: Record<string, string> = {
  invoice_sent: "When invoice is sent",
  invoice_overdue: "When invoice becomes overdue",
  invoice_paid: "When invoice is paid",
  estimate_sent: "When estimate is sent",
  client_created: "When new client is created",
  manual: "Manual enrollment",
};

export default function JourneysPage() {
  const org = useAppStore((s) => s.organization);
  const [journeys, setJourneys] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [steps, setSteps] = useState<any[]>([]);

  const load = async () => {
    if (!org) return;
    const [j, t] = await Promise.all([
      supabase.from("journeys").select("*, journey_steps(count)").eq("org_id", org.id).order("created_at", { ascending: false }),
      supabase.from("message_templates").select("id,name,channel").eq("org_id", org.id),
    ]);
    setJourneys(j.data || []);
    setTemplates(t.data || []);
  };
  useEffect(() => { load(); }, [org?.id]);

  const openNew = () => {
    setEditing({ name: "", trigger_type: "invoice_overdue", is_active: false, description: "" });
    setSteps([]);
    setOpen(true);
  };

  const openEdit = async (j: any) => {
    setEditing(j);
    const { data } = await supabase.from("journey_steps").select("*").eq("journey_id", j.id).order("sort_order");
    setSteps(data || []);
    setOpen(true);
  };

  const addStep = (type: "send_message" | "wait") => {
    setSteps([...steps, {
      sort_order: steps.length,
      step_type: type,
      channel: type === "send_message" ? "whatsapp" : null,
      template_id: null,
      wait_hours: type === "wait" ? 24 : 0,
      _new: true,
    }]);
  };

  const updateStep = (i: number, patch: any) => {
    const next = [...steps]; next[i] = { ...next[i], ...patch }; setSteps(next);
  };

  const removeStep = (i: number) => setSteps(steps.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!editing.name) return toast.error("Name required");
    let journeyId = editing.id;
    if (journeyId) {
      await supabase.from("journeys").update({
        name: editing.name, trigger_type: editing.trigger_type, is_active: editing.is_active, description: editing.description,
      }).eq("id", journeyId);
      await supabase.from("journey_steps").delete().eq("journey_id", journeyId);
    } else {
      const { data, error } = await supabase.from("journeys").insert({
        org_id: org!.id, name: editing.name, trigger_type: editing.trigger_type, is_active: editing.is_active, description: editing.description,
      }).select().single();
      if (error) return toast.error(error.message);
      journeyId = data.id;
    }
    if (steps.length) {
      const payload = steps.map((s, i) => ({
        journey_id: journeyId, org_id: org!.id, sort_order: i,
        step_type: s.step_type, channel: s.channel, template_id: s.template_id || null, wait_hours: s.wait_hours || 0,
      }));
      await supabase.from("journey_steps").insert(payload);
    }
    toast.success("Journey saved");
    setOpen(false); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete journey?")) return;
    await supabase.from("journeys").delete().eq("id", id);
    load();
  };

  const toggle = async (j: any) => {
    await supabase.from("journeys").update({ is_active: !j.is_active }).eq("id", j.id);
    load();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Automated Journeys</h1>
          <p className="text-sm text-muted-foreground">Multi-step automated workflows triggered by business events.</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New Journey</Button>
      </div>

      <div className="grid gap-4">
        {journeys.map((j) => (
          <Card key={j.id}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold">{j.name}</h3>
                  <Badge variant={j.is_active ? "default" : "secondary"}>{j.is_active ? "Active" : "Paused"}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{TRIGGER_LABELS[j.trigger_type]}</p>
                <p className="text-xs text-muted-foreground">{j.journey_steps?.[0]?.count || 0} steps</p>
              </div>
              <Switch checked={j.is_active} onCheckedChange={() => toggle(j)} />
              <Button variant="outline" size="sm" onClick={() => openEdit(j)}>Edit</Button>
              <Button variant="ghost" size="icon" onClick={() => remove(j.id)}><Trash2 className="h-4 w-4" /></Button>
            </CardContent>
          </Card>
        ))}
        {journeys.length === 0 && (
          <Card><CardContent className="p-8 text-center text-muted-foreground">No journeys yet. Create one to automate customer follow-ups.</CardContent></Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "New"} Journey</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Name</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
                <div>
                  <Label>Trigger</Label>
                  <Select value={editing.trigger_type} onValueChange={(v) => setEditing({ ...editing, trigger_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TRIGGER_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Description</Label><Textarea rows={2} value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div className="flex items-center gap-2"><Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /><Label>Active</Label></div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label className="text-base">Steps</Label>
                  <div className="space-x-2">
                    <Button size="sm" variant="outline" onClick={() => addStep("wait")}><Clock className="h-3 w-3 mr-1" />Add Wait</Button>
                    <Button size="sm" variant="outline" onClick={() => addStep("send_message")}><MessageSquare className="h-3 w-3 mr-1" />Add Message</Button>
                  </div>
                </div>
                <div className="space-y-2">
                  {steps.map((s, i) => (
                    <div key={i} className="border rounded p-3 bg-muted/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge>{i + 1}</Badge>
                        <span className="font-medium text-sm">{s.step_type === "wait" ? "Wait" : "Send Message"}</span>
                        <Button size="icon" variant="ghost" className="ml-auto h-7 w-7" onClick={() => removeStep(i)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                      {s.step_type === "wait" ? (
                        <div className="flex items-center gap-2">
                          <Input type="number" className="w-24" value={s.wait_hours} onChange={(e) => updateStep(i, { wait_hours: parseInt(e.target.value) || 0 })} />
                          <span className="text-sm text-muted-foreground">hours</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <Select value={s.channel} onValueChange={(v) => updateStep(i, { channel: v, template_id: null })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="whatsapp">WhatsApp</SelectItem>
                              <SelectItem value="sms">SMS</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select value={s.template_id || ""} onValueChange={(v) => updateStep(i, { template_id: v })}>
                            <SelectTrigger><SelectValue placeholder="Template" /></SelectTrigger>
                            <SelectContent>
                              {templates.filter((t) => t.channel === s.channel).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {i < steps.length - 1 && <div className="flex justify-center mt-2"><ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" /></div>}
                    </div>
                  ))}
                  {steps.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No steps yet</p>}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save Journey</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
