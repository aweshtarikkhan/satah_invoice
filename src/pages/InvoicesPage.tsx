import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ImportDialog, ImportField } from "@/components/shared/ImportDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, FileText, Search, Upload, TrendingDown, Clock, AlertTriangle, CalendarClock, Trash2 } from "lucide-react";
import { differenceInDays, parseISO, isToday, isBefore, addDays } from "date-fns";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

const invoiceImportFields: ImportField[] = [
  { key: "invoice_number", label: "Invoice Number", required: true },
  { key: "client_name", label: "Customer Name", required: true },
  { key: "invoice_date", label: "Invoice Date" },
  { key: "issue_date", label: "Issued Date" },
  { key: "due_date", label: "Due Date" },
  { key: "total", label: "Total" },
  { key: "balance_due", label: "Balance" },
  { key: "status", label: "Status" },
  { key: "reference_number", label: "Reference Number" },
  { key: "currency_code", label: "Currency Code" },
  { key: "discount", label: "Discount" },
  { key: "shipping_charge", label: "Shipping Charge" },
  { key: "adjustment", label: "Adjustment" },
  { key: "notes", label: "Notes" },
  { key: "terms_conditions", label: "Terms & Conditions" },
  { key: "amount_paid", label: "Amount Paid" },
];

const statusTabs = ["all", "draft", "sent", "overdue", "partial", "paid", "void"] as const;

export default function InvoicesPage() {
  const navigate = useNavigate();
  const org = useAppStore((s) => s.organization);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<string>("all");
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!org?.id) return;
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("invoices")
        .select("*, clients(display_name)")
        .eq("org_id", org.id)
        .order("created_at", { ascending: false });
      setInvoices(data || []);
      setLoading(false);
    };
    fetch();
  }, [org?.id]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: org?.currency_code || "USD" }).format(n);

  const summary = useMemo(() => {
    const outstanding = invoices
      .filter(i => ["sent", "viewed", "partial", "overdue"].includes(i.status))
      .reduce((sum, i) => sum + Number(i.balance_due || 0), 0);

    const today = new Date();
    const dueToday = invoices
      .filter(i => ["sent", "viewed", "partial", "overdue"].includes(i.status) && i.due_date && isToday(parseISO(i.due_date)))
      .reduce((sum, i) => sum + Number(i.balance_due || 0), 0);

    const dueIn30 = invoices
      .filter(i => {
        if (!["sent", "viewed", "partial"].includes(i.status) || !i.due_date) return false;
        const due = parseISO(i.due_date);
        return !isToday(due) && isBefore(due, addDays(today, 31)) && !isBefore(due, today);
      })
      .reduce((sum, i) => sum + Number(i.balance_due || 0), 0);

    const overdue = invoices
      .filter(i => i.status === "overdue")
      .reduce((sum, i) => sum + Number(i.balance_due || 0), 0);

    // Average days to get paid
    const paidInvoices = invoices.filter(i => i.status === "paid" && i.paid_at && i.issue_date);
    const avgDays = paidInvoices.length > 0
      ? Math.round(paidInvoices.reduce((sum, i) => sum + differenceInDays(parseISO(i.paid_at), parseISO(i.issue_date)), 0) / paidInvoices.length)
      : 0;

    return { outstanding, dueToday, dueIn30, overdue, avgDays };
  }, [invoices]);

  const filtered = invoices
    .filter((i) => tab === "all" || i.status === tab)
    .filter((i) =>
      [i.invoice_number, (i.clients as any)?.display_name]
        .filter(Boolean)
        .some((f) => f.toLowerCase().includes(search.toLowerCase()))
    );

  const allSelected = filtered.length > 0 && filtered.every(i => selected.has(i.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map(i => i.id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const handleDeleteSelected = async () => {
    setDeleting(true);
    const ids = Array.from(selected);
    // Delete related data first
    for (const id of ids) {
      await supabase.from("invoice_lines").delete().eq("invoice_id", id);
      await supabase.from("payments").delete().eq("invoice_id", id);
      await supabase.from("portal_tokens").delete().eq("entity_id", id).eq("entity_type", "invoice");
    }
    const { error } = await supabase.from("invoices").delete().in("id", ids);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: `${ids.length} invoice(s) deleted.` });
      setInvoices(prev => prev.filter(i => !selected.has(i.id)));
      setSelected(new Set());
    }
    setDeleting(false);
    setDeleteOpen(false);
  };

  const summaryItems = [
    { label: "Total Outstanding Receivables", value: fmt(summary.outstanding), icon: TrendingDown, color: "text-primary" },
    { label: "Due Today", value: fmt(summary.dueToday), icon: Clock, color: "text-orange-500" },
    { label: "Due Within 30 Days", value: fmt(summary.dueIn30), icon: CalendarClock, color: "text-muted-foreground" },
    { label: "Overdue Invoice", value: fmt(summary.overdue), icon: AlertTriangle, color: "text-destructive" },
    { label: "Avg. Days to Get Paid", value: `${summary.avgDays} Days`, icon: CalendarClock, color: "text-muted-foreground" },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Invoices" description="Create and manage invoices">
        {selected.size > 0 && (
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="mr-1 h-4 w-4" /> Delete ({selected.size})
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
          <Upload className="mr-1 h-4 w-4" /> Import
        </Button>
        <Button onClick={() => navigate("/invoices/new")} size="sm">
          <Plus className="mr-1 h-4 w-4" /> New Invoice
        </Button>
      </PageHeader>

      {/* Payment Summary */}
      <Card>
        <CardContent className="py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Payment Summary</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {summaryItems.map((item) => (
              <div key={item.label} className="space-y-1">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            {statusTabs.map((s) => (
              <TabsTrigger key={s} value={s} className="capitalize">{s}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative max-w-sm w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search invoices..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No invoices found"
              description="Create your first invoice to get started."
              actionLabel="New Invoice"
              onAction={() => navigate("/invoices/new")}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"><Checkbox checked={allSelected} onCheckedChange={toggleAll} /></TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Order Number</TableHead>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inv) => (
                  <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { if (selected.size === 0) navigate(`/invoices/${inv.id}`); }}>
                    <TableCell onClick={(e) => e.stopPropagation()}><Checkbox checked={selected.has(inv.id)} onCheckedChange={() => toggleOne(inv.id)} /></TableCell>
                    <TableCell className="text-muted-foreground">{inv.issue_date ? format(parseISO(inv.issue_date), "d MMM yyyy") : "-"}</TableCell>
                    <TableCell className="font-medium text-primary">{inv.invoice_number}</TableCell>
                    <TableCell className="text-muted-foreground">{inv.reference_number || "-"}</TableCell>
                    <TableCell>{(inv.clients as any)?.display_name}</TableCell>
                    <TableCell><StatusBadge status={inv.status} /></TableCell>
                    <TableCell className="text-muted-foreground">{inv.due_date ? format(parseISO(inv.due_date), "d MMM yyyy") : "-"}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(Number(inv.total))}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(Number(inv.balance_due))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        fields={invoiceImportFields}
        entityName="Invoices"
        onImport={async (rows) => {
          let success = 0, errors = 0;
          const { data: existingClients } = await supabase.from("clients").select("id, display_name").eq("org_id", org!.id);
          const clientMap = new Map<string, string>();
          existingClients?.forEach(c => clientMap.set(c.display_name.toLowerCase(), c.id));

          const parseDate = (d: string) => {
            if (!d) return null;
            // Handle DD-MM-YYYY or DD/MM/YYYY
            const m = d.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
            if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
            // Handle YYYY-MM-DD
            if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
            return d;
          };

          for (const row of rows) {
            const name = (row.client_name || "").trim();
            if (!name) { errors++; continue; }
            let clientId = clientMap.get(name.toLowerCase());
            // Auto-create client if not found
            if (!clientId) {
              const { data: newClient, error: cErr } = await supabase.from("clients").insert({
                org_id: org!.id,
                display_name: name,
              }).select("id").single();
              if (cErr || !newClient) { errors++; continue; }
              clientId = newClient.id;
              clientMap.set(name.toLowerCase(), clientId);
            }
            const total = parseFloat(row.total) || 0;
            const amountPaid = parseFloat(row.amount_paid) || 0;
            const balanceDue = row.balance_due !== undefined && row.balance_due !== "" ? parseFloat(row.balance_due) : (total - amountPaid);
            const finalAmountPaid = amountPaid || (total - balanceDue);
            const status = balanceDue === 0 && total > 0 ? "paid" : (["draft","sent","paid","overdue","void","partial"].includes(row.status) ? row.status : "draft");
            const issueDate = parseDate(row.issue_date) || parseDate(row.invoice_date) || new Date().toISOString().split("T")[0];
            const { error } = await supabase.from("invoices").insert({
              org_id: org!.id,
              client_id: clientId,
              invoice_number: row.invoice_number,
              issue_date: issueDate,
              due_date: parseDate(row.due_date) || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
              total,
              subtotal: total,
              balance_due: balanceDue,
              amount_paid: finalAmountPaid,
              status,
              ...(status === "paid" ? { paid_at: new Date().toISOString() } : {}),
              status,
              reference_number: row.reference_number || null,
              currency_code: row.currency_code || org!.currency_code,
              discount: parseFloat(row.discount) || 0,
              shipping_charge: parseFloat(row.shipping_charge) || 0,
              adjustment: parseFloat(row.adjustment) || 0,
              notes: row.notes || null,
              terms_conditions: row.terms_conditions || null,
            });
            if (error) errors++; else success++;
          }
          // Update opening_balance for each client based on their total balance_due
          const uniqueClientIds = Array.from(new Set(clientMap.values()));
          for (const cid of uniqueClientIds) {
            const { data: cInvoices } = await supabase.from("invoices").select("balance_due").eq("client_id", cid);
            const totalDue = (cInvoices || []).reduce((s: number, inv: any) => s + Number(inv.balance_due), 0);
            await supabase.from("clients").update({ opening_balance: totalDue }).eq("id", cid);
          }
          window.location.reload();
          return { success, errors };
        }}
      />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} Invoice(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected invoices along with their line items, payments, and portal links. This action cannot be undone.
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
