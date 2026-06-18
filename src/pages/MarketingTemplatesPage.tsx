import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

type Template = {
  id: string;
  name: string;
  channel: "whatsapp" | "sms" | "email";
  category: string;
  subject: string | null;
  body: string;
  wa_template_name: string | null;
  wa_language: string | null;
  wa_approved: boolean;
};

const EMPTY: Partial<Template> = {
  name: "",
  channel: "whatsapp",
  category: "marketing",
  body: "Hi {{name}}, ...",
  wa_template_name: "",
  wa_language: "en",
};

export default function MarketingTemplatesPage() {
  const org = useAppStore((s) => s.organization);
  const [items, setItems] = useState<Template[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Template>>(EMPTY);

  const load = async () => {
    if (!org) return;
    const { data } = await supabase.from("message_templates").select("*").eq("org_id", org.id).order("created_at", { ascending: false });
    setItems((data as Template[]) || []);
  };
  useEffect(() => { load(); }, [org?.id]);

  const save = async () => {
    if (!org || !form.name || !form.body) return toast.error("Name & body required");
    const payload = { ...form, org_id: org.id };
    const { error } = form.id
      ? await supabase.from("message_templates").update(payload).eq("id", form.id)
      : await supabase.from("message_templates").insert(payload as any);
    if (error) return toast.error(error.message);
    toast.success("Template saved");
    setOpen(false); setForm(EMPTY); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete template?")) return;
    await supabase.from("message_templates").delete().eq("id", id);
    load();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Message Templates</h1>
          <p className="text-sm text-muted-foreground">Reusable templates for WhatsApp, SMS & Email. Use {`{{name}}`} or {`{{1}}`} for variables.</p>
        </div>
        <Button onClick={() => { setForm(EMPTY); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />New Template</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>All Templates</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>WA Template</TableHead>
                <TableHead>Body Preview</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell><Badge variant="outline">{t.channel}</Badge></TableCell>
                  <TableCell>{t.category}</TableCell>
                  <TableCell className="text-xs">{t.wa_template_name || "—"}</TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">{t.body}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => { setForm(t); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No templates yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{form.id ? "Edit" : "New"} Template</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name</Label><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div>
                <Label>Channel</Label>
                <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Category</Label><Input value={form.category || ""} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="marketing / utility / transactional" /></div>
              {form.channel === "email" && (
                <div><Label>Subject</Label><Input value={form.subject || ""} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
              )}
            </div>
            {form.channel === "whatsapp" && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded">
                <div><Label>WA Template Name</Label><Input value={form.wa_template_name || ""} onChange={(e) => setForm({ ...form, wa_template_name: e.target.value })} placeholder="Leave blank for free-form" /></div>
                <div><Label>Language</Label><Input value={form.wa_language || "en"} onChange={(e) => setForm({ ...form, wa_language: e.target.value })} /></div>
                <p className="col-span-2 text-xs text-muted-foreground">Use approved WhatsApp template name for promotional / out-of-session messages. Leave blank to send free-form text (24h customer service window only).</p>
              </div>
            )}
            <div>
              <Label>Body</Label>
              <Textarea rows={6} value={form.body || ""} onChange={(e) => setForm({ ...form, body: e.target.value })} />
              <p className="text-xs text-muted-foreground mt-1">Variables: {`{{name}}`}, {`{{1}}`}, {`{{2}}`}…</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
