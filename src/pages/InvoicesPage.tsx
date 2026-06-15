import { useEffect, useState, useMemo } from "react";
import { usePagination } from "@/hooks/use-pagination";
import { TablePagination } from "@/components/shared/TablePagination";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
import { SEO } from "@/components/shared/SEO";
import { SummaryRibbon } from "@/components/shared/SummaryRibbon";
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
import { Plus, FileText, Search, Upload, Trash2, Send, Download, ArrowUp, ArrowDown, MessageCircle } from "lucide-react";
import { downloadCSV } from "@/lib/export-csv";
import { differenceInDays, parseISO, isToday, isBefore, addDays } from "date-fns";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { BulkReminderDialog } from "@/components/shared/BulkReminderDialog";

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
  const [reminderOpen, setReminderOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  type SortKey = "issue_date" | "due_date" | "total" | "balance_due" | "invoice_number" | "client" | "status";
  const [sortKey, setSortKey] = useState<SortKey>("issue_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };
  const SortArrow = ({ k }: { k: SortKey }) =>
    sortKey === k ? (
      sortDir === "asc" ? <ArrowUp className="inline h-3 w-3 ml-1" /> : <ArrowDown className="inline h-3 w-3 ml-1" />
    ) : null;

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
    const today = new Date();
    
    // Outstanding = ALL invoices with balance_due > 0 (except void)
    const outstanding = invoices
      .filter(i => i.status !== "void" && Number(i.balance_due || 0) > 0)
      .reduce((sum, i) => sum + Number(i.balance_due || 0), 0);

    // Due today
    const dueToday = invoices
      .filter(i => i.status !== "void" && i.status !== "paid" && Number(i.balance_due || 0) > 0 && i.due_date && isToday(parseISO(i.due_date)))
      .reduce((sum, i) => sum + Number(i.balance_due || 0), 0);

    // Due within 30 days (future, not overdue)
    const dueIn30 = invoices
      .filter(i => {
        if (i.status === "void" || i.status === "paid" || Number(i.balance_due || 0) <= 0 || !i.due_date) return false;
        const due = parseISO(i.due_date);
        return !isToday(due) && isBefore(due, addDays(today, 31)) && !isBefore(due, today);
      })
      .reduce((sum, i) => sum + Number(i.balance_due || 0), 0);

    // Overdue = balance_due > 0 AND due_date < today (dynamic check, not just status)
    const overdue = invoices
      .filter(i => {
        if (i.status === "void" || i.status === "paid" || Number(i.balance_due || 0) <= 0 || !i.due_date) return false;
        return isBefore(parseISO(i.due_date), today) && !isToday(parseISO(i.due_date));
      })
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

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av: any, bv: any;
      switch (sortKey) {
        case "issue_date":
        case "due_date":
          av = a[sortKey] ? new Date(a[sortKey]).getTime() : 0;
          bv = b[sortKey] ? new Date(b[sortKey]).getTime() : 0;
          break;
        case "total":
        case "balance_due":
          av = Number(a[sortKey] || 0); bv = Number(b[sortKey] || 0); break;
        case "invoice_number":
          av = a.invoice_number || ""; bv = b.invoice_number || ""; break;
        case "client":
          av = (a.clients as any)?.display_name || ""; bv = (b.clients as any)?.display_name || ""; break;
        case "status":
          av = a.status || ""; bv = b.status || ""; break;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const { paginatedItems, page, totalPages, totalItems, pageSize, setPage, setPageSize } = usePagination(sorted, 25);

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

  const handleMarkSent = async () => {
    const ids = Array.from(selected).filter(id => {
      const inv = invoices.find(i => i.id === id);
      return inv && inv.status === "draft";
    });
    if (ids.length === 0) {
      toast({ title: "No draft invoices", description: "Only draft invoices can be marked as sent.", variant: "destructive" });
      return;
    }
    const now = new Date().toISOString();
    const { error } = await supabase.from("invoices").update({ status: "sent", sent_at: now }).in("id", ids);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Updated", description: `${ids.length} invoice(s) marked as sent.` });
      setInvoices(prev => prev.map(i => ids.includes(i.id) ? { ...i, status: "sent", sent_at: now } : i));
      setSelected(new Set());
    }
  };

  const selectedHasDrafts = Array.from(selected).some(id => {
    const inv = invoices.find(i => i.id === id);
    return inv && inv.status === "draft";
  });

  const getOverdueDays = (inv: any) => {
    if (inv.status === "paid" || inv.status === "void" || inv.status === "draft") return 0;
    if (!inv.due_date) return 0;
    const days = differenceInDays(new Date(), parseISO(inv.due_date));
    return days > 0 ? days : 0;
  };

  const getStatusDisplay = (inv: any) => {
    if (inv.status === "paid") return <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-xs uppercase">PAID</span>;
    const overdueDays = getOverdueDays(inv);
    if (overdueDays > 0) return <span className="text-destructive font-semibold text-xs uppercase">OVERDUE BY {overdueDays} DAYS</span>;
    if (inv.status === "partial") return <span className="text-orange-500 font-semibold text-xs uppercase">PARTIAL</span>;
    if (inv.status === "sent" || inv.status === "viewed") return <span className="text-primary font-semibold text-xs uppercase">{inv.status.toUpperCase()}</span>;
    if (inv.status === "void") return <span className="text-muted-foreground font-semibold text-xs uppercase line-through">VOID</span>;
    return <span className="text-muted-foreground font-semibold text-xs uppercase">DRAFT</span>;
  };

  return (
    <div className="p-6 space-y-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold">All Invoices</h1>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && selectedHasDrafts && (
            <Button variant="outline" size="sm" onClick={handleMarkSent}>
              <Send className="mr-1 h-4 w-4" /> Mark as Sent
            </Button>
          )}
          {selected.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"
              onClick={() => setReminderOpen(true)}
            >
              <MessageCircle className="mr-1 h-4 w-4" /> Send Reminders ({selected.size})
            </Button>
          )}
          {selected.size > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-1 h-4 w-4" /> Delete ({selected.size})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => {
            downloadCSV(filtered.map(i => ({
              invoice_number: i.invoice_number,
              customer: (i.clients as any)?.display_name,
              issue_date: i.issue_date,
              due_date: i.due_date,
              total: i.total,
              amount_paid: i.amount_paid,
              balance_due: i.balance_due,
              status: i.status,
              reference_number: i.reference_number || "",
            })), "invoices");
          }}>
            <Download className="mr-1 h-4 w-4" /> Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1 h-4 w-4" /> Import
          </Button>
          <Button onClick={() => navigate("/invoices/new")} size="sm">
            <Plus className="mr-1 h-4 w-4" /> + New
          </Button>
        </div>
      </div>

      {/* Payment Summary */}
      <SummaryRibbon
        label="Payment Summary"
        items={[
          { label: "Total Outstanding", value: fmt(summary.outstanding), accent: "warning" },
          { label: "Due Today", value: fmt(summary.dueToday), accent: "warning" },
          { label: "Due Within 30 Days", value: fmt(summary.dueIn30), accent: "default" },
          { label: "Overdue", value: fmt(summary.overdue), accent: "danger" },
          { label: "Avg. Days to Get Paid", value: `${summary.avgDays} Days`, accent: "info" },
        ]}
      />

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            {statusTabs.map((s) => (
              <TabsTrigger key={s} value={s} className="capitalize text-xs">{s}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative max-w-sm w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search invoices..." className="pl-9 h-8 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Invoice Table */}
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
          ) : (<>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-10"><Checkbox checked={allSelected} onCheckedChange={toggleAll} /></TableHead>
                  <TableHead onClick={() => toggleSort("issue_date")} className="text-xs uppercase font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground">Date<SortArrow k="issue_date" /></TableHead>
                  <TableHead onClick={() => toggleSort("invoice_number")} className="text-xs uppercase font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground">Invoice#<SortArrow k="invoice_number" /></TableHead>
                  <TableHead className="text-xs uppercase font-semibold text-muted-foreground">Order Number</TableHead>
                  <TableHead onClick={() => toggleSort("client")} className="text-xs uppercase font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground">Customer Name<SortArrow k="client" /></TableHead>
                  <TableHead onClick={() => toggleSort("status")} className="text-xs uppercase font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground">Status<SortArrow k="status" /></TableHead>
                  <TableHead onClick={() => toggleSort("due_date")} className="text-xs uppercase font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground">Due Date<SortArrow k="due_date" /></TableHead>
                  <TableHead onClick={() => toggleSort("total")} className="text-xs uppercase font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground text-right">Amount<SortArrow k="total" /></TableHead>
                  <TableHead onClick={() => toggleSort("balance_due")} className="text-xs uppercase font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground text-right">Balance Due<SortArrow k="balance_due" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((inv) => (
                  <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { if (selected.size === 0) navigate(`/invoices/${inv.id}`); }}>
                    <TableCell onClick={(e) => e.stopPropagation()}><Checkbox checked={selected.has(inv.id)} onCheckedChange={() => toggleOne(inv.id)} /></TableCell>
                    <TableCell className="text-muted-foreground text-sm">{inv.issue_date ? format(parseISO(inv.issue_date), "dd/MM/yyyy") : "-"}</TableCell>
                    <TableCell className="font-medium text-primary text-sm">{inv.invoice_number}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{inv.reference_number || "-"}</TableCell>
                    <TableCell className="text-sm">{(inv.clients as any)?.display_name}</TableCell>
                    <TableCell>{getStatusDisplay(inv)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{inv.due_date ? format(parseISO(inv.due_date), "dd/MM/yyyy") : "-"}</TableCell>
                    <TableCell className="text-right font-medium text-sm">{fmt(Number(inv.total))}</TableCell>
                    <TableCell className="text-right font-medium text-sm">{fmt(Number(inv.balance_due))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination page={page} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
            </>
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
      <BulkReminderDialog
        open={reminderOpen}
        onOpenChange={setReminderOpen}
        invoiceIds={Array.from(selected)}
        orgId={org?.id || ""}
        orgName={org?.name}
        currencyCode={org?.currency_code}
        onSent={(invId) => {
          setInvoices((prev) => prev.map((i) =>
            i.id === invId
              ? { ...i, last_reminder_at: new Date().toISOString(), reminder_count: (i.reminder_count || 0) + 1 }
              : i
          ));
        }}
      />
    </div>
  );
}
