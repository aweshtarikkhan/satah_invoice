import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  scheduled: "bg-blue-100 text-blue-700",
  sending: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export default function CampaignsPage() {
  const org = useAppStore((s) => s.organization);
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ name: "", channel: "whatsapp", template_id: "", audience_type: "all" });

  const load = async () => {
    if (!org) return;
    const [c, t] = await Promise.all([
      supabase.from("campaigns").select("*, template:message_templates(name)").eq("org_id", org.id).order("created_at", { ascending: false }),
      supabase.from("message_templates").select("id,name,channel").eq("org_id", org.id),
    ]);
    setCampaigns(c.data || []);
    setTemplates(t.data || []);
  };
  useEffect(() => { load(); }, [org?.id]);

  const buildAudience = async (channel: string, audience_type: string) => {
    const { data: clients } = await supabase.from("clients").select("id,display_name,phone,email").eq("org_id", org!.id);
    let list: any[] = clients || [];
    if (audience_type === "overdue") {
      const { data: ovd } = await supabase.from("invoices").select("client_id").eq("org_id", org!.id).gt("balance_due", 0).lt("due_date", new Date().toISOString().split("T")[0]);
      const ids = new Set((ovd || []).map((i: any) => i.client_id));
      list = list.filter((c) => ids.has(c.id));
    }
    const addrKey = channel === "email" ? "email" : "phone";
    return list
      .filter((c) => c[addrKey])
      .map((c) => ({
        client_id: c.id,
        name: c.display_name,
        to_address: c[addrKey] as string,
        vars: { name: c.display_name },
        org_id: org!.id,
      }));
  };

  const create = async () => {
    if (!form.name || !form.template_id) return toast.error("Name & template required");
    const audience = await buildAudience(form.channel, form.audience_type);
    if (audience.length === 0) return toast.error("No recipients match this audience");

    const { data: campaign, error } = await supabase.from("campaigns").insert({
      org_id: org!.id,
      name: form.name,
      channel: form.channel,
      template_id: form.template_id,
      audience_type: form.audience_type,
      total_count: audience.length,
    }).select().single();
    if (error || !campaign) return toast.error(error?.message || "Failed");

    const recipients = audience.map((r) => ({ ...r, campaign_id: campaign.id }));
    await supabase.from("campaign_recipients").insert(recipients);

    toast.success(`Campaign created with ${audience.length} recipients`);
    setOpen(false);
    setForm({ name: "", channel: "whatsapp", template_id: "", audience_type: "all" });
    load();
  };

  const sendNow = async (id: string) => {
    if (!confirm("Send this campaign now to all pending recipients?")) return;
    const t = toast.loading("Sending...");
    const { data, error } = await supabase.functions.invoke("send-campaign", { body: { campaign_id: id } });
    toast.dismiss(t);
    if (error) return toast.error(error.message || "Failed");
    toast.success(`Sent: ${data?.sent}, Failed: ${data?.failed}`);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete campaign?")) return;
    await supabase.from("campaigns").delete().eq("id", id);
    load();
  };

  const filteredTpls = templates.filter((t) => t.channel === form.channel);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Marketing Campaigns</h1>
          <p className="text-sm text-muted-foreground">Bulk WhatsApp & SMS broadcasts to your contacts.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />New Campaign</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>All Campaigns</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent / Total</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/campaigns/${c.id}`)}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell><Badge variant="outline">{c.channel}</Badge></TableCell>
                  <TableCell>{c.template?.name || "—"}</TableCell>
                  <TableCell className="text-xs">{c.audience_type}</TableCell>
                  <TableCell><Badge className={STATUS_COLOR[c.status]}>{c.status}</Badge></TableCell>
                  <TableCell>{c.sent_count} / {c.total_count} {c.failed_count > 0 && <span className="text-red-600 text-xs">({c.failed_count} failed)</span>}</TableCell>
                  <TableCell className="text-xs">{format(new Date(c.created_at), "dd MMM HH:mm")}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()} className="space-x-1">
                    {c.status === "draft" && <Button size="sm" onClick={() => sendNow(c.id)}><Send className="h-3 w-3 mr-1" />Send</Button>}
                    <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {campaigns.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No campaigns yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Campaign</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <Label>Channel</Label>
              <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v, template_id: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Template</Label>
              <Select value={form.template_id} onValueChange={(v) => setForm({ ...form, template_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choose template" /></SelectTrigger>
                <SelectContent>
                  {filteredTpls.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Audience</Label>
              <Select value={form.audience_type} onValueChange={(v) => setForm({ ...form, audience_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  <SelectItem value="overdue">Clients with Overdue Invoices</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create}>Create Campaign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
