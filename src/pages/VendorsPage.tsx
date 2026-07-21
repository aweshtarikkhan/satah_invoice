import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, Download } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { useNavigate } from "react-router-dom";
import { ImportDialog, ImportField } from "@/components/shared/ImportDialog";

interface Vendor {
  id: string;
  name: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  gstin: string | null;
  pan: string | null;
  payment_terms: number;
  opening_balance: number;
  balance_due: number;
  is_active: boolean;
}

const vendorImportFields: ImportField[] = [
  { key: "name", label: "Vendor Name", required: true },
  { key: "gstin", label: "GSTIN" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "address", label: "Address" },
  { key: "opening_balance", label: "Opening Balance" },
];

const empty = {
  name: "", display_name: "", email: "", phone: "", gstin: "", pan: "",
  payment_terms: "30", opening_balance: "0", notes: "",
};

export default function VendorsPage() {
  const org = useAppStore((s) => s.organization);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [list, setList] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [q, setQ] = useState("");
  const [importOpen, setImportOpen] = useState(false);

  const load = async () => {
    if (!org?.id) return;
    setLoading(true);
    const { data } = await (supabase as any).from("vendors").select("*").eq("org_id", org.id).order("name");
    setList(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [org?.id]);

  const save = async () => {
    if (!org?.id || !form.name.trim()) {
      toast({ title: "Vendor name is required", variant: "destructive" });
      return;
    }
    const payload: any = {
      org_id: org.id,
      name: form.name.trim(),
      display_name: form.display_name || null,
      email: form.email || null,
      phone: form.phone || null,
      gstin: form.gstin || null,
      pan: form.pan || null,
      payment_terms: Number(form.payment_terms) || 30,
      opening_balance: Number(form.opening_balance) || 0,
      notes: form.notes || null,
    };
    const { error } = editId
      ? await (supabase as any).from("vendors").update(payload).eq("id", editId)
      : await (supabase as any).from("vendors").insert(payload);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: editId ? "Vendor updated" : "Vendor added" });
    setOpen(false); setForm(empty); setEditId(null); load();
  };

  const edit = (v: Vendor) => {
    setEditId(v.id);
    setForm({
      name: v.name, display_name: v.display_name || "", email: v.email || "",
      phone: v.phone || "", gstin: v.gstin || "", pan: v.pan || "",
      payment_terms: String(v.payment_terms || 30), opening_balance: String(v.opening_balance || 0), notes: "",
    });
    setOpen(true);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this vendor?")) return;
    const { error } = await (supabase as any).from("vendors").delete().eq("id", id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    load();
  };

  const filtered = list.filter(v =>
    !q || v.name.toLowerCase().includes(q.toLowerCase()) ||
    (v.email || "").toLowerCase().includes(q.toLowerCase()) ||
    (v.gstin || "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Vendors</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Download className="mr-2 h-4 w-4" /> Import
          </Button>
          <Button variant="outline" onClick={() => navigate("/bills/new")}>New Bill</Button>
          <Button onClick={() => { setEditId(null); setForm(empty); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add Vendor
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">All Vendors ({filtered.length})</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vendors..." className="pl-8 h-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="text-muted-foreground text-sm py-8 text-center">Loading…</div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Terms</TableHead>
                  <TableHead className="text-right">Balance Due</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(v => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.name}</TableCell>
                    <TableCell className="font-mono text-xs">{v.gstin || "—"}</TableCell>
                    <TableCell className="text-sm">{v.email || v.phone || "—"}</TableCell>
                    <TableCell>Net {v.payment_terms}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(Number(v.balance_due) || 0, (org as any)?.currency || "INR")}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => edit(v)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(v.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!filtered.length && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No vendors yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editId ? "Edit Vendor" : "Add Vendor"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Display Name</Label><Input value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>GSTIN</Label><Input value={form.gstin} onChange={e => setForm({ ...form, gstin: e.target.value.toUpperCase() })} /></div>
            <div><Label>PAN</Label><Input value={form.pan} onChange={e => setForm({ ...form, pan: e.target.value.toUpperCase() })} /></div>
            <div><Label>Payment Terms (days)</Label><Input type="number" value={form.payment_terms} onChange={e => setForm({ ...form, payment_terms: e.target.value })} /></div>
            <div><Label>Opening Balance</Label><Input type="number" value={form.opening_balance} onChange={e => setForm({ ...form, opening_balance: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editId ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        entityName="Vendors"
        fields={vendorImportFields}
        onImport={async (rows) => {
          let s = 0, e = 0;
          for (const row of rows) {
            const { error } = await supabase.from("vendors").insert({
              org_id: org?.id,
              name: row.name,
              gstin: row.gstin || null,
              email: row.email || null,
              phone: row.phone || null,
              address: row.address || null,
              opening_balance: Number(row.opening_balance) || 0
            });
            if (error) e++; else s++;
          }
          load();
          return { success: s, errors: e };
        }}
      />
    </div>
  );
}
