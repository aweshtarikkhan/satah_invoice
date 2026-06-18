import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Eye, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "@/lib/currency";

const blank = () => ({
  id: "", name: "", account_type: "bank", bank_name: "", account_number: "",
  ifsc: "", upi_id: "", opening_balance: "0", account_id: "", notes: "",
});

export default function BankAccountsPage() {
  const org = useAppStore((s) => s.organization);
  const cur = (org as any)?.currency || "INR";
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(blank());
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!org?.id) return;
    const [b, a] = await Promise.all([
      (supabase as any).from("bank_accounts").select("*").eq("org_id", org.id).order("created_at"),
      (supabase as any).from("accounts").select("id,code,name").eq("org_id", org.id).eq("type", "asset").order("code"),
    ]);
    setRows(b.data || []);
    setAccounts(a.data || []);
  };
  useEffect(() => { load(); }, [org?.id]);

  const edit = (r: any) => {
    setForm({
      id: r.id, name: r.name, account_type: r.account_type, bank_name: r.bank_name || "",
      account_number: r.account_number || "", ifsc: r.ifsc || "", upi_id: r.upi_id || "",
      opening_balance: String(r.opening_balance || 0), account_id: r.account_id || "",
      notes: r.notes || "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!org?.id || !form.name) { toast({ title: "Name required", variant: "destructive" }); return; }
    setSaving(true);
    const payload: any = {
      org_id: org.id, name: form.name, account_type: form.account_type,
      bank_name: form.bank_name || null, account_number: form.account_number || null,
      ifsc: form.ifsc || null, upi_id: form.upi_id || null,
      opening_balance: Number(form.opening_balance) || 0,
      current_balance: form.id ? undefined : Number(form.opening_balance) || 0,
      account_id: form.account_id || null, notes: form.notes || null, currency: cur,
    };
    if (form.id) {
      delete payload.current_balance;
      const { error } = await (supabase as any).from("bank_accounts").update(payload).eq("id", form.id);
      if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      const { error } = await (supabase as any).from("bank_accounts").insert(payload);
      if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    }
    setSaving(false); setOpen(false); setForm(blank()); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this account? All linked transactions will be removed.")) return;
    const { error } = await (supabase as any).from("bank_accounts").delete().eq("id", id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else load();
  };

  const typeLabel: Record<string, string> = { bank: "Bank", cash: "Cash", upi: "UPI", credit_card: "Credit Card", wallet: "Wallet" };
  const total = rows.reduce((s, r) => s + Number(r.current_balance || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Bank & Cash Accounts</h1>
        <Button onClick={() => { setForm(blank()); setOpen(true); }}><Plus className="h-4 w-4 mr-1" />New Account</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Accounts</div><div className="text-2xl font-semibold">{rows.length}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Total Balance</div><div className="text-2xl font-semibold">{formatCurrency(total, cur)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All Accounts</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>Type</TableHead>
              <TableHead>Bank / Identifier</TableHead><TableHead>A/C #</TableHead>
              <TableHead className="text-right">Opening</TableHead>
              <TableHead className="text-right">Current</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/bank-accounts/${r.id}`)}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell><Badge variant="secondary">{typeLabel[r.account_type] || r.account_type}</Badge></TableCell>
                  <TableCell>{r.bank_name || r.upi_id || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.account_number || "—"}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(r.opening_balance), cur)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(Number(r.current_balance), cur)}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button size="icon" variant="ghost" onClick={() => navigate(`/bank-accounts/${r.id}`)}><Eye className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => edit(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No accounts yet. Add your first bank or cash account.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{form.id ? "Edit" : "New"} Account</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="HDFC Current A/C" /></div>
            <div>
              <Label>Type</Label>
              <Select value={form.account_type} onValueChange={v => setForm({ ...form, account_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="wallet">Wallet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ledger Account</Label>
              <Select value={form.account_id} onValueChange={v => setForm({ ...form, account_id: v })}>
                <SelectTrigger><SelectValue placeholder="Link to COA" /></SelectTrigger>
                <SelectContent>{accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.code} {a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Bank Name</Label><Input value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} /></div>
            <div><Label>Account Number</Label><Input value={form.account_number} onChange={e => setForm({ ...form, account_number: e.target.value })} /></div>
            <div><Label>IFSC</Label><Input value={form.ifsc} onChange={e => setForm({ ...form, ifsc: e.target.value })} /></div>
            <div><Label>UPI ID</Label><Input value={form.upi_id} onChange={e => setForm({ ...form, upi_id: e.target.value })} placeholder="yourname@upi" /></div>
            <div className="col-span-2"><Label>Opening Balance</Label><Input type="number" value={form.opening_balance} onChange={e => setForm({ ...form, opening_balance: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
