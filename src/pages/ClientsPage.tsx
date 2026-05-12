import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { EmptyState } from "@/components/shared/EmptyState";
import { ImportDialog, ImportField } from "@/components/shared/ImportDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Users, Search, Upload, Trash2, Eye, Edit, Download,
} from "lucide-react";
import { downloadCSV } from "@/lib/export-csv";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

const clientImportFields: ImportField[] = [
  { key: "display_name", label: "Display Name", required: true },
  { key: "company_name", label: "Company Name" },
  { key: "first_name", label: "First Name" },
  { key: "last_name", label: "Last Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "mobile", label: "Mobile Phone" },
  { key: "website", label: "Website" },
  { key: "tax_number", label: "Tax Number / GST" },
  { key: "currency_code", label: "Currency Code" },
  { key: "payment_terms", label: "Payment Terms (days)" },
  { key: "billing_address", label: "Billing Address" },
  { key: "shipping_address", label: "Shipping Address" },
  { key: "opening_balance", label: "Opening Balance" },
  { key: "notes", label: "Notes" },
];

// Stable color palette for avatar based on name
const avatarColors = [
  "bg-emerald-500", "bg-violet-500", "bg-blue-500", "bg-amber-500",
  "bg-rose-500", "bg-teal-500", "bg-indigo-500", "bg-orange-500",
];
const colorFor = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return avatarColors[h % avatarColors.length];
};
const initials = (name: string) =>
  name.split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";

export default function ClientsPage() {
  const navigate = useNavigate();
  const org = useAppStore((s) => s.organization);
  const [clients, setClients] = useState<any[]>([]);
  const [invoiceAgg, setInvoiceAgg] = useState<Record<string, { billed: number; received: number; due: number; lastActivity: string | null }>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editClient, setEditClient] = useState<any>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const [form, setForm] = useState({
    display_name: "", company_name: "", email: "", phone: "",
    billing_address: { street: "", city: "", state: "", zip: "", country: "" },
    payment_terms: 30, notes: "", tags: [] as string[], credit_limit: 0,
  });

  const fetchClients = async () => {
    if (!org?.id) return;
    setLoading(true);
    const [{ data: clientData }, { data: invData }, { data: payData }] = await Promise.all([
      supabase.from("clients").select("*").eq("org_id", org.id).order("display_name"),
      supabase.from("invoices").select("client_id, total, balance_due, amount_paid, status, issue_date, updated_at").eq("org_id", org.id),
      supabase.from("payments").select("client_id, payment_date").eq("org_id", org.id),
    ]);
    setClients(clientData || []);
    const agg: Record<string, { billed: number; received: number; due: number; lastActivity: string | null }> = {};
    (invData || []).filter((i: any) => i.status !== "void").forEach((inv: any) => {
      if (!agg[inv.client_id]) agg[inv.client_id] = { billed: 0, received: 0, due: 0, lastActivity: null };
      agg[inv.client_id].billed += Number(inv.total || 0);
      agg[inv.client_id].received += Number(inv.amount_paid || 0);
      agg[inv.client_id].due += Number(inv.balance_due || 0);
      const t = inv.updated_at || inv.issue_date;
      if (t && (!agg[inv.client_id].lastActivity || t > agg[inv.client_id].lastActivity!)) agg[inv.client_id].lastActivity = t;
    });
    (payData || []).forEach((p: any) => {
      if (!agg[p.client_id]) agg[p.client_id] = { billed: 0, received: 0, due: 0, lastActivity: null };
      if (p.payment_date && (!agg[p.client_id].lastActivity || p.payment_date > agg[p.client_id].lastActivity!)) agg[p.client_id].lastActivity = p.payment_date;
    });
    setInvoiceAgg(agg);
    setLoading(false);
  };

  useEffect(() => { fetchClients(); }, [org?.id]);

  const resetForm = () => {
    setForm({ display_name: "", company_name: "", email: "", phone: "", billing_address: { street: "", city: "", state: "", zip: "", country: "" }, payment_terms: 30, notes: "", tags: [], credit_limit: 0 });
    setEditClient(null);
  };
  const openCreate = () => { resetForm(); setDialogOpen(true); };
  const openEdit = (client: any) => {
    setEditClient(client);
    setForm({
      display_name: client.display_name || "", company_name: client.company_name || "",
      email: client.email || "", phone: client.phone || "",
      billing_address: client.billing_address || { street: "", city: "", state: "", zip: "", country: "" },
      payment_terms: client.payment_terms ?? 30, notes: client.notes || "",
      tags: client.tags || [], credit_limit: Number(client.credit_limit || 0),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.display_name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    const payload = { ...form, org_id: org!.id };
    if (editClient) {
      const { error } = await supabase.from("clients").update(payload).eq("id", editClient.id);
      if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Client updated" });
    } else {
      const { error } = await supabase.from("clients").insert(payload);
      if (error) { toast({ title: "Create failed", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Client created" });
    }
    setDialogOpen(false);
    resetForm();
    fetchClients();
  };

  const filtered = clients.filter((c) =>
    [c.display_name, c.company_name, c.email, c.phone].filter(Boolean).some((f) => f.toLowerCase().includes(search.toLowerCase()))
  );

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: org?.currency_code || "USD", maximumFractionDigits: 2 }).format(n);

  const toggleSelect = (id: string) => {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const toggleAll = () => {
    selected.size === filtered.length ? setSelected(new Set()) : setSelected(new Set(filtered.map((c) => c.id)));
  };

  const handleDeleteSelected = async () => {
    setDeleting(true);
    const ids = Array.from(selected);
    try {
      const { data: clientInvoices } = await supabase.from("invoices").select("id").in("client_id", ids);
      const invoiceIds = (clientInvoices || []).map((i: any) => i.id);
      if (invoiceIds.length > 0) {
        await supabase.from("invoice_lines").delete().in("invoice_id", invoiceIds);
        await supabase.from("payments").delete().in("invoice_id", invoiceIds);
        await supabase.from("portal_tokens").delete().eq("entity_type", "invoice").in("entity_id", invoiceIds);
        await supabase.from("invoices").delete().in("id", invoiceIds);
      }
      const { data: clientEstimates } = await supabase.from("estimates").select("id").in("client_id", ids);
      const estimateIds = (clientEstimates || []).map((e: any) => e.id);
      if (estimateIds.length > 0) {
        await supabase.from("estimate_lines").delete().in("estimate_id", estimateIds);
        await supabase.from("portal_tokens").delete().eq("entity_type", "estimate").in("entity_id", estimateIds);
        await supabase.from("estimates").delete().in("id", estimateIds);
      }
      const { data: clientCNs } = await supabase.from("credit_notes").select("id").in("client_id", ids);
      const cnIds = (clientCNs || []).map((c: any) => c.id);
      if (cnIds.length > 0) {
        await supabase.from("credit_note_lines").delete().in("credit_note_id", cnIds);
        await supabase.from("portal_tokens").delete().eq("entity_type", "credit_note").in("entity_id", cnIds);
        await supabase.from("credit_notes").delete().in("id", cnIds);
      }
      await supabase.from("payments").delete().in("client_id", ids);
      await supabase.from("contacts").delete().in("client_id", ids);
      const { error } = await supabase.from("clients").delete().in("id", ids);
      if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); }
      else { toast({ title: `${ids.length} client(s) deleted` }); setSelected(new Set()); }
    } catch (err: any) { toast({ title: "Delete failed", description: err.message, variant: "destructive" }); }
    setDeleting(false);
    setDeleteConfirmOpen(false);
    fetchClients();
  };

  const exportCSV = () => {
    downloadCSV(clients.map(c => ({
      display_name: c.display_name,
      company_name: c.company_name || "",
      email: c.email || "",
      phone: c.phone || "",
      opening_balance: c.opening_balance,
    })), "clients");
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">All Customers</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={exportCSV} title="Export">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={() => setImportOpen(true)} title="Import">
            <Upload className="h-4 w-4" />
          </Button>
          <Button size="icon" className="h-9 w-9 rounded-full" onClick={openCreate} title="Add Customer">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search Card */}
      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardContent className="p-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search in Customers"
              className="pl-10 h-11 border-0 bg-transparent focus-visible:ring-0 text-sm shadow-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Table Card */}
      <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {/* Sub-header */}
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <div className="text-sm">
              <span className="font-semibold">Total:</span>{" "}
              <span className="text-muted-foreground">{filtered.length} Customers</span>
            </div>
            <div className="flex items-center gap-3">
              {selected.size > 0 && (
                <span className="text-sm">
                  <span className="font-semibold">Selected:</span>{" "}
                  <span className="text-muted-foreground">{selected.size}</span>
                </span>
              )}
              <Select value={bulkAction} onValueChange={(v) => {
                setBulkAction("");
                if (v === "delete" && selected.size > 0) setDeleteConfirmOpen(true);
                else if (v === "export") exportCSV();
              }}>
                <SelectTrigger className="h-9 w-[160px] rounded-lg">
                  <SelectValue placeholder="Bulk Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="export">Export Selected</SelectItem>
                  <SelectItem value="delete" disabled={selected.size === 0}>Delete Selected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-muted-foreground text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8">
              <EmptyState icon={Users} title="No clients" description="Add your first client." actionLabel="Add Client" onAction={openCreate} />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-transparent hover:bg-transparent">
                  <TableHead className="w-10 pl-5">
                    <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead className="text-[11px] uppercase font-semibold tracking-wider text-muted-foreground">Status</TableHead>
                  <TableHead className="text-[11px] uppercase font-semibold tracking-wider text-muted-foreground">Profile</TableHead>
                  <TableHead className="text-[11px] uppercase font-semibold tracking-wider text-muted-foreground">Customer Name</TableHead>
                  <TableHead className="text-[11px] uppercase font-semibold tracking-wider text-muted-foreground">Contact Info</TableHead>
                  <TableHead className="text-[11px] uppercase font-semibold tracking-wider text-muted-foreground">Total Invoiced</TableHead>
                  <TableHead className="text-[11px] uppercase font-semibold tracking-wider text-muted-foreground">Total Received</TableHead>
                  <TableHead className="text-[11px] uppercase font-semibold tracking-wider text-muted-foreground">Outstanding Balance</TableHead>
                  <TableHead className="text-[11px] uppercase font-semibold tracking-wider text-muted-foreground">Last Activity</TableHead>
                  <TableHead className="text-[11px] uppercase font-semibold tracking-wider text-muted-foreground text-right pr-5">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((client) => {
                  const a = invoiceAgg[client.id] || { billed: 0, received: 0, due: 0, lastActivity: null };
                  const dueColor = a.due > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400";
                  const isActive = client.status !== "inactive";
                  return (
                    <TableRow key={client.id} className="cursor-pointer hover:bg-muted/40 group" onClick={() => navigate(`/clients/${client.id}`)}>
                      <TableCell className="pl-5" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selected.has(client.id)} onCheckedChange={() => toggleSelect(client.id)} />
                      </TableCell>
                      <TableCell>
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                      </TableCell>
                      <TableCell>
                        <div className={`h-9 w-9 rounded-full ${colorFor(client.display_name || "?")} flex items-center justify-center text-white text-xs font-semibold`}>
                          {initials(client.display_name || "?")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{client.display_name}</div>
                        {client.tags?.length > 0 && (
                          <div className="flex gap-1 mt-0.5">
                            {client.tags.slice(0, 2).map((t: string) => (
                              <Badge key={t} variant="outline" className="text-[9px] px-1 py-0 h-4">{t}</Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {client.phone || client.email || "—"}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{fmt(a.billed)}</TableCell>
                      <TableCell className="text-sm font-medium">{fmt(a.received)}</TableCell>
                      <TableCell className={`text-sm font-semibold ${dueColor}`}>{fmt(a.due)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {a.lastActivity ? formatDistanceToNow(new Date(a.lastActivity), { addSuffix: true }) : "—"}
                      </TableCell>
                      <TableCell className="text-right pr-5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="outline" size="sm" className="h-8 px-2.5 rounded-md" onClick={() => navigate(`/clients/${client.id}`)}>
                            <Eye className="h-3.5 w-3.5 mr-1" /> View
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(client)}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editClient ? "Edit Client" : "Add Client"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Display Name *</Label>
              <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Street Address</Label>
              <Input value={form.billing_address.street} onChange={(e) => setForm({ ...form, billing_address: { ...form.billing_address, street: e.target.value } })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={form.billing_address.city} onChange={(e) => setForm({ ...form, billing_address: { ...form.billing_address, city: e.target.value } })} />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input value={form.billing_address.state} onChange={(e) => setForm({ ...form, billing_address: { ...form.billing_address, state: e.target.value } })} />
              </div>
              <div className="space-y-2">
                <Label>ZIP</Label>
                <Input value={form.billing_address.zip} onChange={(e) => setForm({ ...form, billing_address: { ...form.billing_address, zip: e.target.value } })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Payment Terms (days)</Label>
                <Input type="number" value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: parseInt(e.target.value) || 30 })} />
              </div>
              <div className="space-y-2">
                <Label>Credit Limit</Label>
                <Input type="number" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tags (comma-separated)</Label>
              <Input
                value={form.tags.join(", ")}
                onChange={(e) => setForm({ ...form, tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean) })}
                placeholder="e.g. VIP, Regular, Priority"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editClient ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import */}
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        fields={clientImportFields}
        entityName="Clients"
        onImport={async (rows) => {
          let success = 0, errors = 0;
          for (const row of rows) {
            const { error } = await supabase.from("clients").insert({
              org_id: org!.id,
              display_name: row.display_name,
              company_name: row.company_name || null,
              email: row.email || null,
              phone: row.phone || null,
              mobile: row.mobile || null,
              website: row.website || null,
              tax_number: row.tax_number || null,
              currency_code: row.currency_code || org!.currency_code,
              payment_terms: parseInt(row.payment_terms) || 30,
              billing_address: row.billing_address ? { street: row.billing_address } : null,
              shipping_address: row.shipping_address ? { street: row.shipping_address } : null,
              opening_balance: parseFloat(row.opening_balance) || 0,
              notes: row.notes || null,
            });
            if (error) errors++; else success++;
          }
          fetchClients();
          return { success, errors };
        }}
      />

      {/* Delete confirm */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} Client(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected clients along with their invoices, estimates, payments, and credit notes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSelected} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
