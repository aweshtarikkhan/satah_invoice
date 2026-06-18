import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TYPES = ["asset", "liability", "equity", "income", "expense"];
const typeColors: Record<string, string> = {
  asset: "bg-blue-100 text-blue-700", liability: "bg-amber-100 text-amber-700",
  equity: "bg-purple-100 text-purple-700", income: "bg-emerald-100 text-emerald-700",
  expense: "bg-rose-100 text-rose-700",
};

export default function ChartOfAccountsPage() {
  const org = useAppStore((s) => s.organization);
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", name: "", type: "expense", description: "" });

  const load = async () => {
    if (!org?.id) return;
    const { data } = await (supabase as any).from("accounts").select("*").eq("org_id", org.id).order("code");
    setAccounts(data || []);
  };
  useEffect(() => { load(); }, [org?.id]);

  const save = async () => {
    if (!org?.id || !form.code || !form.name) { toast({ title: "Code and name required", variant: "destructive" }); return; }
    const payload = { ...form, org_id: org.id };
    const { error } = editId
      ? await (supabase as any).from("accounts").update(payload).eq("id", editId)
      : await (supabase as any).from("accounts").insert(payload);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: editId ? "Updated" : "Added" });
    setOpen(false); setForm({ code: "", name: "", type: "expense", description: "" }); setEditId(null); load();
  };

  const grouped = TYPES.map(t => ({ type: t, items: accounts.filter(a => a.type === t) }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Chart of Accounts</h1>
        <Button onClick={() => { setEditId(null); setForm({ code: "", name: "", type: "expense", description: "" }); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add Account
        </Button>
      </div>

      {grouped.map(g => g.items.length > 0 && (
        <Card key={g.type}>
          <CardHeader className="pb-2"><CardTitle className="text-base capitalize flex items-center gap-2"><Badge className={typeColors[g.type]}>{g.type}</Badge> ({g.items.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead className="w-24">Code</TableHead><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead>System</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {g.items.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono">{a.code}</TableCell>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.description || "—"}</TableCell>
                    <TableCell>{a.is_system && <Badge variant="outline" className="text-xs">System</Badge>}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => { setEditId(a.id); setForm({ code: a.code, name: a.name, type: a.type, description: a.description || "" }); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Edit Account" : "Add Account"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Code *</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
            <div>
              <Label>Type *</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="col-span-2"><Label>Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>{editId ? "Update" : "Add"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
