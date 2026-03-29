import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
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
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, Search, Upload, Trash2, X, Phone, Mail, MapPin, FileText, CreditCard, ExternalLink, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

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

export default function ClientsPage() {
  const navigate = useNavigate();
  const org = useAppStore((s) => s.organization);
  const [clients, setClients] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editClient, setEditClient] = useState<any>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const [form, setForm] = useState({
    display_name: "",
    company_name: "",
    email: "",
    phone: "",
    billing_address: { street: "", city: "", state: "", zip: "", country: "" },
    payment_terms: 30,
    notes: "",
  });

  const fetchClients = async () => {
    if (!org?.id) return;
    setLoading(true);
    const [{ data: clientData }, { data: invData }] = await Promise.all([
      supabase.from("clients").select("*").eq("org_id", org.id).order("display_name"),
      supabase.from("invoices").select("client_id, total, balance_due, status").eq("org_id", org.id),
    ]);
    setClients(clientData || []);
    setInvoices(invData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchClients();
  }, [org?.id]);

  // Build client due map
  const clientDueMap = useMemo(() => {
    const map: Record<string, { billed: number; due: number }> = {};
    invoices.filter(i => i.status !== "void").forEach((inv) => {
      if (!map[inv.client_id]) map[inv.client_id] = { billed: 0, due: 0 };
      map[inv.client_id].billed += Number(inv.total);
      map[inv.client_id].due += Number(inv.balance_due);
    });
    return map;
  }, [invoices]);

  const resetForm = () => {
    setForm({
      display_name: "", company_name: "", email: "", phone: "",
      billing_address: { street: "", city: "", state: "", zip: "", country: "" },
      payment_terms: 30, notes: "",
    });
    setEditClient(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (client: any) => {
    setEditClient(client);
    setForm({
      display_name: client.display_name || "",
      company_name: client.company_name || "",
      email: client.email || "",
      phone: client.phone || "",
      billing_address: client.billing_address || { street: "", city: "", state: "", zip: "", country: "" },
      payment_terms: client.payment_terms ?? 30,
      notes: client.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.display_name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }

    const payload = {
      ...form,
      org_id: org!.id,
    };

    if (editClient) {
      const { error } = await supabase
        .from("clients")
        .update(payload)
        .eq("id", editClient.id);
      if (error) {
        toast({ title: "Update failed", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Client updated" });
    } else {
      const { error } = await supabase
        .from("clients")
        .insert(payload);
      if (error) {
        toast({ title: "Create failed", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Client created" });
    }

    setDialogOpen(false);
    resetForm();
    fetchClients();
  };

  const filtered = clients.filter((c) =>
    [c.display_name, c.company_name, c.email]
      .filter(Boolean)
      .some((f) => f.toLowerCase().includes(search.toLowerCase()))
  );

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: org?.currency_code || "USD" }).format(n);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
    }
  };

  const handleDeleteSelected = async () => {
    setDeleting(true);
    const ids = Array.from(selected);
    try {
      // Delete related records first to avoid foreign key constraint errors
      // Get invoice IDs for these clients
      const { data: clientInvoices } = await supabase.from("invoices").select("id").in("client_id", ids);
      const invoiceIds = (clientInvoices || []).map((i: any) => i.id);
      if (invoiceIds.length > 0) {
        await supabase.from("invoice_lines").delete().in("invoice_id", invoiceIds);
        await supabase.from("payments").delete().in("invoice_id", invoiceIds);
        await supabase.from("portal_tokens").delete().eq("entity_type", "invoice").in("entity_id", invoiceIds);
        await supabase.from("invoices").delete().in("id", invoiceIds);
      }
      // Get estimate IDs
      const { data: clientEstimates } = await supabase.from("estimates").select("id").in("client_id", ids);
      const estimateIds = (clientEstimates || []).map((e: any) => e.id);
      if (estimateIds.length > 0) {
        await supabase.from("estimate_lines").delete().in("estimate_id", estimateIds);
        await supabase.from("portal_tokens").delete().eq("entity_type", "estimate").in("entity_id", estimateIds);
        await supabase.from("estimates").delete().in("id", estimateIds);
      }
      // Get credit note IDs
      const { data: clientCNs } = await supabase.from("credit_notes").select("id").in("client_id", ids);
      const cnIds = (clientCNs || []).map((c: any) => c.id);
      if (cnIds.length > 0) {
        await supabase.from("credit_note_lines").delete().in("credit_note_id", cnIds);
        await supabase.from("portal_tokens").delete().eq("entity_type", "credit_note").in("entity_id", cnIds);
        await supabase.from("credit_notes").delete().in("id", cnIds);
      }
      // Delete remaining payments linked to client (not tied to invoices)
      await supabase.from("payments").delete().in("client_id", ids);
      // Delete contacts
      await supabase.from("contacts").delete().in("client_id", ids);
      // Finally delete clients
      const { error } = await supabase.from("clients").delete().in("id", ids);
      if (error) {
        toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      } else {
        toast({ title: `${ids.length} client(s) deleted with all related data` });
        setSelected(new Set());
      }
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
    setDeleting(false);
    setDeleteConfirmOpen(false);
    fetchClients();
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Clients" description="Manage your clients and contacts">
        {selected.size > 0 && (
          <Button variant="destructive" size="sm" onClick={() => setDeleteConfirmOpen(true)}>
            <Trash2 className="mr-1 h-4 w-4" /> Delete ({selected.size})
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
          <Upload className="mr-1 h-4 w-4" /> Import
        </Button>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1 h-4 w-4" /> Add Client
        </Button>
      </PageHeader>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search clients..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No clients yet"
              description="Add your first client to start creating invoices."
              actionLabel="Add Client"
              onAction={openCreate}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filtered.length > 0 && selected.size === filtered.length}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Total Billed</TableHead>
                  <TableHead className="text-right">Amount Due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((client) => {
                  const summary = clientDueMap[client.id] || { billed: 0, due: 0 };
                  return (
                    <TableRow key={client.id} className="cursor-pointer">
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(client.id)}
                          onCheckedChange={() => toggleSelect(client.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium" onClick={() => navigate(`/clients/${client.id}`)}>{client.display_name}</TableCell>
                      <TableCell onClick={() => navigate(`/clients/${client.id}`)}>{client.company_name || "—"}</TableCell>
                      <TableCell onClick={() => navigate(`/clients/${client.id}`)}>{client.email || "—"}</TableCell>
                      <TableCell className="text-right text-blue-600 dark:text-blue-400" onClick={() => navigate(`/clients/${client.id}`)}>{fmt(summary.billed)}</TableCell>
                      <TableCell className={`text-right font-semibold ${summary.due > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`} onClick={() => navigate(`/clients/${client.id}`)}>
                        {fmt(summary.due)}
                      </TableCell>
                      <TableCell onClick={() => navigate(`/clients/${client.id}`)}>
                        <Badge variant={client.status === "active" ? "default" : "secondary"}>
                          {client.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
            <div className="space-y-2">
              <Label>Payment Terms (days)</Label>
              <Input type="number" value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: parseInt(e.target.value) || 30 })} />
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
              display_name: row.display_name || "Unnamed",
              company_name: row.company_name || null,
              first_name: row.first_name || null,
              last_name: row.last_name || null,
              email: row.email || null,
              phone: row.phone || null,
              mobile: row.mobile || null,
              website: row.website || null,
              tax_number: row.tax_number || null,
              currency_code: row.currency_code || null,
              payment_terms: parseInt(row.payment_terms) || null,
              billing_address: row.billing_address ? { street: row.billing_address, city: "", state: "", zip: "", country: "" } : {},
              shipping_address: row.shipping_address ? { street: row.shipping_address, city: "", state: "", zip: "", country: "" } : null,
              opening_balance: parseFloat(row.opening_balance) || 0,
              notes: row.notes || null,
            });
            if (error) errors++; else success++;
          }
          fetchClients();
          return { success, errors };
        }}
      />
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} Client(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected clients and cannot be undone. Related invoices, payments, and other data may be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelected}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
