import { useEffect, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, Search, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const clientImportFields: ImportField[] = [
  { key: "display_name", label: "Display Name", required: true },
  { key: "company_name", label: "Company Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
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

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Clients" description="Manage your clients and contacts">
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
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((client) => (
                  <TableRow key={client.id} className="cursor-pointer" onClick={() => openEdit(client)}>
                    <TableCell className="font-medium">{client.display_name}</TableCell>
                    <TableCell>{client.company_name || "—"}</TableCell>
                    <TableCell>{client.email || "—"}</TableCell>
                    <TableCell>{client.phone || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={client.status === "active" ? "default" : "secondary"}>
                        {client.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
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
              email: row.email || null,
              phone: row.phone || null,
              notes: row.notes || null,
            });
            if (error) errors++; else success++;
          }
          fetchClients();
          return { success, errors };
        }}
      />
    </div>
  );
}
