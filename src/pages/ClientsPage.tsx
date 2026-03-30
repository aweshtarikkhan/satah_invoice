import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { EmptyState } from "@/components/shared/EmptyState";
import { ImportDialog, ImportField } from "@/components/shared/ImportDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Users, Search, Upload, Trash2, X, Phone, Mail, MapPin,
  FileText, CreditCard, ExternalLink, Edit, ChevronRight, Building2, Globe, Receipt, Download,
} from "lucide-react";
import { downloadCSV } from "@/lib/export-csv";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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
  const [activeClient, setActiveClient] = useState<any>(null);
  const [detailInvoices, setDetailInvoices] = useState<any[]>([]);
  const [detailPayments, setDetailPayments] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const { toast } = useToast();

  const loadClientDetail = async (client: any) => {
    setActiveClient(client);
    if (!org?.id) return;
    setDetailLoading(true);
    const [{ data: inv }, { data: pay }] = await Promise.all([
      supabase.from("invoices").select("*").eq("client_id", client.id).eq("org_id", org.id).neq("status", "void").order("issue_date", { ascending: false }),
      supabase.from("payments").select("*").eq("client_id", client.id).eq("org_id", org.id).order("payment_date", { ascending: false }),
    ]);
    setDetailInvoices(inv || []);
    setDetailPayments(pay || []);
    setDetailLoading(false);
  };

  const detailTotalBilled = detailInvoices.reduce((s, i) => s + Number(i.total), 0);
  const detailTotalPaid = detailPayments.reduce((s, p) => s + Number(p.amount), 0);
  const detailTotalDue = detailInvoices.reduce((s, i) => s + Number(i.balance_due), 0);
  const detailOverdue = detailInvoices.filter(i => i.status !== "paid" && new Date(i.due_date) < new Date()).reduce((s, i) => s + Number(i.balance_due), 0);

  // Monthly chart data
  const monthlyChart = useMemo(() => {
    const months: Record<string, { month: string; billed: number; paid: number }> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      months[key] = { month: label, billed: 0, paid: 0 };
    }
    detailInvoices.forEach((inv) => {
      const key = inv.issue_date?.slice(0, 7);
      if (months[key]) months[key].billed += Number(inv.total);
    });
    detailPayments.forEach((p) => {
      const key = p.payment_date?.slice(0, 7);
      if (months[key]) months[key].paid += Number(p.amount);
    });
    return Object.values(months);
  }, [detailInvoices, detailPayments]);

  const [form, setForm] = useState({
    display_name: "", company_name: "", email: "", phone: "",
    billing_address: { street: "", city: "", state: "", zip: "", country: "" },
    payment_terms: 30, notes: "",
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

  useEffect(() => { fetchClients(); }, [org?.id]);

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
    setForm({ display_name: "", company_name: "", email: "", phone: "", billing_address: { street: "", city: "", state: "", zip: "", country: "" }, payment_terms: 30, notes: "" });
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
    [c.display_name, c.company_name, c.email].filter(Boolean).some((f) => f.toLowerCase().includes(search.toLowerCase()))
  );

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: org?.currency_code || "USD" }).format(n);

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
    if (activeClient && ids.includes(activeClient.id)) setActiveClient(null);
    fetchClients();
  };

  const addr = activeClient?.billing_address;
  const addrStr = addr ? [addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(", ") : "";
  const shipAddr = activeClient?.shipping_address;
  const shipStr = shipAddr ? [shipAddr.street, shipAddr.city, shipAddr.state, shipAddr.zip].filter(Boolean).join(", ") : "";

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* LEFT - Client List */}
      <div className={`border-r bg-background flex flex-col ${activeClient ? "w-[360px] min-w-[360px]" : "flex-1"} transition-all`}>
        {/* Header */}
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">All Customers</h2>
            <div className="flex items-center gap-1">
              {selected.size > 0 && (
                <Button variant="destructive" size="icon" className="h-7 w-7" onClick={() => setDeleteConfirmOpen(true)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setImportOpen(true)}>
                <Upload className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" className="h-7 w-7" onClick={openCreate}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search in Customers" className="pl-8 h-8 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {/* List */}
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8">
              <EmptyState icon={Users} title="No clients" description="Add your first client." actionLabel="Add Client" onAction={openCreate} />
            </div>
          ) : (
            <div>
              {filtered.map((client) => {
                const summary = clientDueMap[client.id] || { billed: 0, due: 0 };
                const isActive = activeClient?.id === client.id;
                return (
                  <div
                    key={client.id}
                    className={`flex items-center gap-2 px-3 py-2.5 border-b cursor-pointer hover:bg-muted/50 transition-colors ${isActive ? "bg-primary/5 border-l-2 border-l-primary" : "border-l-2 border-l-transparent"}`}
                    onClick={() => loadClientDetail(client)}
                  >
                    <Checkbox
                      checked={selected.has(client.id)}
                      onCheckedChange={() => toggleSelect(client.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isActive ? "text-primary" : ""}`}>{client.display_name}</p>
                      <p className={`text-xs ${summary.due > 0 ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        {fmt(summary.due)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* RIGHT - Client Detail */}
      {activeClient && (
        <div className="flex-1 flex flex-col min-w-0 bg-background">
          {/* Detail Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h1 className="text-xl font-bold truncate">{activeClient.display_name}</h1>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => openEdit(activeClient)}>
                <Edit className="mr-1 h-3.5 w-3.5" /> Edit
              </Button>
              <Button size="sm" onClick={() => navigate(`/invoices/new`)}>
                <Plus className="mr-1 h-3.5 w-3.5" /> New Invoice
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setActiveClient(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-4 mt-2 w-fit">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="statement">Statement</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1">
              {detailLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading...</div>
              ) : (
                <>
                  {/* OVERVIEW TAB */}
                  <TabsContent value="overview" className="m-0 p-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Left Column - Contact Info */}
                      <div className="space-y-5">
                        {/* Contact Card */}
                        <div className="rounded-lg border p-4 space-y-3">
                          <h3 className="text-sm font-semibold uppercase text-muted-foreground">{activeClient.display_name}</h3>
                          <div className="flex items-start gap-3">
                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary text-lg font-bold shrink-0">
                              {activeClient.display_name?.[0]?.toUpperCase() || "C"}
                            </div>
                            <div className="space-y-1 text-sm min-w-0">
                              <p className="font-medium">{activeClient.display_name}</p>
                              {activeClient.phone && (
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <Phone className="h-3 w-3" /> {activeClient.phone}
                                </div>
                              )}
                              {activeClient.mobile && (
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <Phone className="h-3 w-3" /> {activeClient.mobile}
                                </div>
                              )}
                              {activeClient.email && (
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <Mail className="h-3 w-3" /> {activeClient.email}
                                </div>
                              )}
                              {activeClient.website && (
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <Globe className="h-3 w-3" /> {activeClient.website}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Address */}
                        <div className="rounded-lg border p-4 space-y-3">
                          <h3 className="text-sm font-semibold uppercase text-muted-foreground">Address</h3>
                          <div className="space-y-2 text-sm">
                            <div>
                              <p className="font-medium text-xs text-muted-foreground mb-0.5">Billing Address</p>
                              <p>{addrStr || <span className="text-muted-foreground italic">No Billing Address</span>}</p>
                            </div>
                            <div>
                              <p className="font-medium text-xs text-muted-foreground mb-0.5">Shipping Address</p>
                              <p>{shipStr || <span className="text-muted-foreground italic">No Shipping Address</span>}</p>
                            </div>
                          </div>
                        </div>

                        {/* Other Details */}
                        <div className="rounded-lg border p-4 space-y-2">
                          <h3 className="text-sm font-semibold uppercase text-muted-foreground">Other Details</h3>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">Default Currency</p>
                              <p className="font-medium">{activeClient.currency_code || org?.currency_code || "INR"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Payment Terms</p>
                              <p className="font-medium">{activeClient.payment_terms || org?.payment_terms || 30} days</p>
                            </div>
                            {activeClient.tax_number && (
                              <div>
                                <p className="text-xs text-muted-foreground">GST/Tax Number</p>
                                <p className="font-medium">{activeClient.tax_number}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-xs text-muted-foreground">Status</p>
                              <Badge variant={activeClient.status === "active" ? "default" : "secondary"}>{activeClient.status}</Badge>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Column - Receivables & Chart */}
                      <div className="space-y-5">
                        {/* Receivables */}
                        <div className="rounded-lg border p-4 space-y-3">
                          <h3 className="text-sm font-semibold">Receivables</h3>
                          <div className="overflow-hidden rounded-md border">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-muted/50">
                                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">CURRENCY</th>
                                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">OUTSTANDING</th>
                                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">OVERDUE</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="border-t">
                                  <td className="px-3 py-2">{org?.currency_code || "INR"}</td>
                                  <td className="px-3 py-2 text-right font-semibold text-orange-600 dark:text-orange-400">{fmt(detailTotalDue)}</td>
                                  <td className="px-3 py-2 text-right font-semibold text-destructive">{fmt(detailOverdue)}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Income Chart */}
                        <div className="rounded-lg border p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold">Income and Expense</h3>
                            <span className="text-xs text-muted-foreground">Last 6 Months</span>
                          </div>
                          <div className="h-48">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={monthlyChart}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip formatter={(v: number) => fmt(v)} />
                                <Bar dataKey="billed" name="Billed" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="paid" name="Received" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Total Income (Last 6 Months) - <span className="font-semibold text-foreground">{fmt(detailTotalBilled)}</span>
                          </p>
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-lg border p-3">
                            <p className="text-xs text-muted-foreground">Total Billed</p>
                            <p className="text-lg font-bold text-primary">{fmt(detailTotalBilled)}</p>
                          </div>
                          <div className="rounded-lg border p-3">
                            <p className="text-xs text-muted-foreground">Total Received</p>
                            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{fmt(detailTotalPaid)}</p>
                          </div>
                          <div className="rounded-lg border p-3 border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30">
                            <p className="text-xs text-muted-foreground">Outstanding</p>
                            <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{fmt(detailTotalDue)}</p>
                          </div>
                          <div className="rounded-lg border p-3 border-destructive/30 bg-destructive/5">
                            <p className="text-xs text-muted-foreground">Overdue</p>
                            <p className="text-lg font-bold text-destructive">{fmt(detailOverdue)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* TRANSACTIONS TAB */}
                  <TabsContent value="transactions" className="m-0 p-4 space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Invoices ({detailInvoices.length})</h4>
                      {detailInvoices.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">No invoices</p>
                      ) : (
                        <div className="rounded-md border overflow-hidden">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-muted/50 text-xs text-muted-foreground">
                                <th className="text-left px-3 py-2">Invoice #</th>
                                <th className="text-left px-3 py-2">Date</th>
                                <th className="text-left px-3 py-2">Status</th>
                                <th className="text-right px-3 py-2">Total</th>
                                <th className="text-right px-3 py-2">Balance</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detailInvoices.map((inv) => {
                                const isOverdue = inv.status !== "paid" && new Date(inv.due_date) < new Date();
                                return (
                                  <tr key={inv.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/invoices/${inv.id}`)}>
                                    <td className="px-3 py-2 font-medium text-primary">{inv.invoice_number}</td>
                                    <td className="px-3 py-2">{inv.issue_date}</td>
                                    <td className="px-3 py-2">
                                      <Badge variant={inv.status === "paid" ? "default" : isOverdue ? "destructive" : "secondary"} className="text-[10px]">{inv.status}</Badge>
                                    </td>
                                    <td className="px-3 py-2 text-right">{fmt(Number(inv.total))}</td>
                                    <td className={`px-3 py-2 text-right font-semibold ${Number(inv.balance_due) > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
                                      {fmt(Number(inv.balance_due))}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold mb-2">Payments ({detailPayments.length})</h4>
                      {detailPayments.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">No payments</p>
                      ) : (
                        <div className="rounded-md border overflow-hidden">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-muted/50 text-xs text-muted-foreground">
                                <th className="text-left px-3 py-2">Payment #</th>
                                <th className="text-left px-3 py-2">Date</th>
                                <th className="text-left px-3 py-2">Mode</th>
                                <th className="text-right px-3 py-2">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detailPayments.map((p) => (
                                <tr key={p.id} className="border-t hover:bg-muted/30">
                                  <td className="px-3 py-2 font-medium">{p.payment_number}</td>
                                  <td className="px-3 py-2">{p.payment_date}</td>
                                  <td className="px-3 py-2">{p.payment_mode}</td>
                                  <td className="px-3 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">{fmt(Number(p.amount))}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* STATEMENT TAB */}
                  <TabsContent value="statement" className="m-0 p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Button size="sm" onClick={() => navigate(`/statements/${activeClient.id}`)}>
                        <FileText className="mr-1 h-3.5 w-3.5" /> View Full Statement
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">Click above to view the full customer statement with running balance and PDF download.</p>
                  </TabsContent>
                </>
              )}
            </ScrollArea>
          </Tabs>
        </div>
      )}

      {/* No client selected placeholder */}
      {!activeClient && !loading && filtered.length > 0 && (
        <div className="hidden" />
      )}

      {/* Dialogs */}
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
              This will permanently delete the selected clients and all related data.
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
