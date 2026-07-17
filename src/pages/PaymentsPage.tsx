import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { EmptyState } from "@/components/shared/EmptyState";
import { ImportDialog, ImportField } from "@/components/shared/ImportDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CreditCard, Search, Upload, Plus, Filter, Trash2, Download } from "lucide-react";
import { downloadCSV } from "@/lib/export-csv";
import { SummaryRibbon } from "@/components/shared/SummaryRibbon";
import { AnalyticsGrid } from "@/components/shared/AnalyticsGrid";
import { PageActionBar } from "@/components/shared/PageActionBar";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { toast } from "@/hooks/use-toast";

const paymentImportFields: ImportField[] = [
  { key: "payment_number", label: "Payment #", required: true },
  { key: "client_name", label: "Customer Name", required: true },
  { key: "amount", label: "Amount", required: true },
  { key: "payment_date", label: "Date" },
  { key: "payment_mode", label: "Payment Mode" },
  { key: "reference_number", label: "Reference Number" },
  { key: "invoice_number", label: "Invoice#" },
  { key: "notes", label: "Notes" },
];

interface ClientSummary {
  id: string;
  name: string;
  totalBilled: number;
  totalPaid: number;
  pending: number;
  oldestDueDays: number;
  overdueInvoices: number;
}

const AGING_FILTERS = [
  { value: "all", label: "All Clients" },
  { value: "15", label: "> 15 Days" },
  { value: "30", label: "> 30 Days" },
  { value: "60", label: "> 60 Days" },
  { value: "90", label: "> 90 Days" },
];

function getPendingColor(days: number): string {
  if (days <= 0) return "text-emerald-600 dark:text-emerald-400";
  if (days <= 15) return "text-amber-600 dark:text-amber-400";
  if (days <= 30) return "text-orange-600 dark:text-orange-400";
  if (days <= 60) return "text-red-500 dark:text-red-400";
  return "text-red-700 dark:text-red-300";
}

function getPendingBadge(days: number) {
  if (days <= 0) return <Badge variant="outline" className="border-emerald-500 text-emerald-600 text-[10px]">Cleared</Badge>;
  if (days <= 15) return <Badge variant="outline" className="border-amber-500 text-amber-600 text-[10px]">1-15 days</Badge>;
  if (days <= 30) return <Badge variant="outline" className="border-orange-500 text-orange-600 text-[10px]">16-30 days</Badge>;
  if (days <= 60) return <Badge variant="outline" className="border-red-400 text-red-500 text-[10px]">31-60 days</Badge>;
  return <Badge variant="outline" className="border-red-700 text-red-700 text-[10px]">60+ days</Badge>;
}

export default function PaymentsPage() {
  const org = useAppStore((s) => s.organization);
  const navigate = useNavigate();
  const [payments, setPayments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [agingFilter, setAgingFilter] = useState("all");
  const [amountSort, setAmountSort] = useState<"asc" | "desc" | "none">("none");
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchData = async () => {
    if (!org?.id) return;
    setLoading(true);
    const [{ data: payData }, { data: invData }] = await Promise.all([
      supabase.from("payments").select("*, clients(display_name, id), invoices(invoice_number)").eq("org_id", org.id).order("payment_date", { ascending: false }),
      supabase.from("invoices").select("id, client_id, total, amount_paid, balance_due, due_date, status, invoice_number, clients(display_name, id)").eq("org_id", org.id),
    ]);
    setPayments(payData || []);
    setInvoices(invData || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [org?.id]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: org?.currency_code || "INR" }).format(n);

  // Client Summaries
  const clientSummaries = useMemo<ClientSummary[]>(() => {
    const map: Record<string, ClientSummary> = {};
    const today = new Date();
    invoices.forEach((inv) => {
      const clientId = inv.client_id;
      const clientName = (inv.clients as any)?.display_name || "Unknown";
      if (!map[clientId]) map[clientId] = { id: clientId, name: clientName, totalBilled: 0, totalPaid: 0, pending: 0, oldestDueDays: 0, overdueInvoices: 0 };
      map[clientId].totalBilled += Number(inv.total);
      map[clientId].totalPaid += Number(inv.amount_paid);
      map[clientId].pending += Number(inv.balance_due);
      if (Number(inv.balance_due) > 0 && inv.status !== "void") {
        const daysPast = Math.max(0, Math.floor((today.getTime() - new Date(inv.due_date).getTime()) / 86400000));
        if (daysPast > map[clientId].oldestDueDays) map[clientId].oldestDueDays = daysPast;
        if (daysPast > 0) map[clientId].overdueInvoices++;
      }
    });
    return Object.values(map);
  }, [invoices]);

  const filteredClients = useMemo(() => {
    let list = clientSummaries;
    if (clientSearch) list = list.filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase()));
    if (agingFilter !== "all") list = list.filter((c) => c.oldestDueDays > parseInt(agingFilter));
    if (amountSort === "asc") list = [...list].sort((a, b) => a.pending - b.pending);
    else list = [...list].sort((a, b) => b.pending - a.pending);
    return list;
  }, [clientSummaries, clientSearch, agingFilter, amountSort]);

  const globalTotalBilled = clientSummaries.reduce((s, c) => s + c.totalBilled, 0);
  const globalTotalPaid = clientSummaries.reduce((s, c) => s + c.totalPaid, 0);
  const globalPending = clientSummaries.reduce((s, c) => s + c.pending, 0);
  const overdueCount = clientSummaries.filter((c) => c.oldestDueDays > 0 && c.pending > 0).length;

  // Payments table
  const filtered = payments.filter((p) =>
    [p.payment_number, (p.clients as any)?.display_name, p.reference_number, (p.invoices as any)?.invoice_number]
      .filter(Boolean).some((f) => f.toLowerCase().includes(search.toLowerCase()))
  );

  const allSelected = filtered.length > 0 && filtered.every(p => selected.has(p.id));
  const toggleAll = () => {
    allSelected ? setSelected(new Set()) : setSelected(new Set(filtered.map(p => p.id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const handleDeleteSelected = async () => {
    setDeleting(true);
    const ids = Array.from(selected);

    // Get payment details before deleting (to reverse invoice balances)
    const toDelete = payments.filter(p => selected.has(p.id));
    
    const { error } = await supabase.from("payments").delete().in("id", ids);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      // Reverse invoice balances for deleted payments
      const invoiceAdjustments: Record<string, number> = {};
      const affectedClientIds = new Set<string>();
      toDelete.forEach(p => {
        if (p.invoice_id) invoiceAdjustments[p.invoice_id] = (invoiceAdjustments[p.invoice_id] || 0) + Number(p.amount);
        affectedClientIds.add(p.client_id);
      });

      for (const [invId, reversed] of Object.entries(invoiceAdjustments)) {
        const { data: inv } = await supabase.from("invoices").select("total, balance_due, amount_paid, status").eq("id", invId).single();
        if (inv) {
          const newPaid = Math.max(0, Number(inv.amount_paid) - reversed);
          const newBalance = Number(inv.total) - newPaid;
          const newStatus = newPaid <= 0 ? (inv.status === "paid" || inv.status === "partial" ? "sent" : inv.status) : "partial";
          await supabase.from("invoices").update({ balance_due: newBalance, amount_paid: newPaid, status: newStatus, paid_at: null }).eq("id", invId);
        }
      }

      // Sync client opening_balance
      for (const cId of affectedClientIds) {
        const { data: cInvs } = await supabase.from("invoices").select("balance_due").eq("client_id", cId).neq("status", "void");
        const totalDue = (cInvs || []).reduce((s, i) => s + Number(i.balance_due || 0), 0);
        await supabase.from("clients").update({ opening_balance: totalDue }).eq("id", cId);
      }

      toast({ title: `${ids.length} payment(s) deleted`, description: "Invoice balances have been updated." });
      setSelected(new Set());
    }
    setDeleting(false);
    setDeleteOpen(false);
    fetchData();
  };

  // Charts
  const monthlyMap: Record<string, number> = {};
  payments.forEach((p) => {
    const m = (p.payment_date || "").slice(0, 7);
    if (m) monthlyMap[m] = (monthlyMap[m] || 0) + Number(p.amount);
  });
  const monthlyTrend: { month: string; amount: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const key = d.toISOString().slice(0, 7);
    const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
    monthlyTrend.push({ month: label, amount: monthlyMap[key] || 0 });
  }

  const modeMap: Record<string, number> = {};
  payments.forEach((p) => { const mode = (p.payment_mode || "other").replace(/_/g, " "); modeMap[mode] = (modeMap[mode] || 0) + Number(p.amount); });
  const modeData = Object.entries(modeMap).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value })).sort((a, b) => b.value - a.value);
  const PIE_COLORS = ["hsl(201, 96%, 32%)", "hsl(142, 71%, 45%)", "hsl(32, 95%, 44%)", "hsl(0, 72%, 51%)", "hsl(262, 83%, 58%)", "hsl(215, 16%, 47%)"];

  const topClients = Object.entries(
    payments.reduce<Record<string, number>>((acc, p) => { const name = (p.clients as any)?.display_name || "Unknown"; acc[name] = (acc[name] || 0) + Number(p.amount); return acc; }, {})
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);

  // Aging buckets
  const agingBuckets = (() => {
    const buckets: Record<string, number> = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    clientSummaries.forEach((c) => {
      if (c.pending <= 0) return;
      if (c.oldestDueDays <= 30) buckets["0-30"] += c.pending;
      else if (c.oldestDueDays <= 60) buckets["31-60"] += c.pending;
      else if (c.oldestDueDays <= 90) buckets["61-90"] += c.pending;
      else buckets["90+"] += c.pending;
    });
    return Object.entries(buckets).map(([range, amount]) => ({ range, amount }));
  })();

  const parseDate = (d: string) => {
    if (!d) return null;
    const m = d.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    return d;
  };

  return (
    <div className="p-6 space-y-4">
      {/* Top Bar */}
      <PageActionBar title="Payments Received">
        {selected.size > 0 && (
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="mr-1 h-4 w-4" /> Delete ({selected.size})
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => {
          downloadCSV(payments.map(p => ({
            payment_number: p.payment_number,
            customer: (p.clients as any)?.display_name,
            amount: p.amount,
            payment_date: p.payment_date,
            payment_mode: p.payment_mode,
            reference_number: p.reference_number || "",
            invoice: (p.invoices as any)?.invoice_number || "",
            notes: p.notes || "",
          })), "payments");
        }}>
          <Download className="mr-1 h-4 w-4" /> Export
        </Button>
        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
          <Upload className="mr-1 h-4 w-4" /> Import
        </Button>
        <Button size="sm" onClick={() => navigate("/payments/new")}>
          <Plus className="mr-1 h-4 w-4" /> New Payment
        </Button>
      </PageActionBar>

      {/* Payment Summary */}
      <SummaryRibbon
        label="Payment Summary"
        items={[
          { label: "Total Billed", value: fmt(globalTotalBilled), accent: "info" },
          { label: "Total Received", value: fmt(globalTotalPaid), accent: "success" },
          { label: "Total Pending", value: fmt(globalPending), accent: "warning" },
          { label: "Overdue Clients", value: overdueCount, accent: "danger" },
        ]}
      />

      {/* Client Receivables */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base">Client Receivables</CardTitle>
            <div className="flex gap-2 flex-wrap items-center">
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Search client..." className="pl-8 h-8 text-sm" value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} />
              </div>
              <Select value={agingFilter} onValueChange={setAgingFilter}>
                <SelectTrigger className="w-[140px] h-8 text-sm"><Filter className="mr-1 h-3.5 w-3.5" /><SelectValue /></SelectTrigger>
                <SelectContent>{AGING_FILTERS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={amountSort} onValueChange={(v: any) => setAmountSort(v)}>
                <SelectTrigger className="w-[150px] h-8 text-sm"><SelectValue placeholder="Sort by amount" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Default</SelectItem>
                  <SelectItem value="desc">Highest Pending</SelectItem>
                  <SelectItem value="asc">Lowest Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredClients.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No clients match your filters.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs uppercase font-semibold text-muted-foreground">Client</TableHead>
                  <TableHead className="text-xs uppercase font-semibold text-muted-foreground text-right">Total Billed</TableHead>
                  <TableHead className="text-xs uppercase font-semibold text-muted-foreground text-right">Paid</TableHead>
                  <TableHead className="text-xs uppercase font-semibold text-muted-foreground text-right">Pending</TableHead>
                  <TableHead className="text-xs uppercase font-semibold text-muted-foreground text-center">Overdue Since</TableHead>
                  <TableHead className="text-xs uppercase font-semibold text-muted-foreground text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/clients`)}>
                    <TableCell className="font-medium text-sm">{c.name}</TableCell>
                    <TableCell className="text-right text-sm text-blue-600 dark:text-blue-400">{fmt(c.totalBilled)}</TableCell>
                    <TableCell className="text-right text-sm text-emerald-600 dark:text-emerald-400">{fmt(c.totalPaid)}</TableCell>
                    <TableCell className={`text-right font-semibold text-sm ${getPendingColor(c.oldestDueDays)}`}>{fmt(c.pending)}</TableCell>
                    <TableCell className="text-center text-sm">
                      {c.pending > 0 && c.oldestDueDays > 0 ? (
                        <span className={`font-medium ${getPendingColor(c.oldestDueDays)}`}>{c.oldestDueDays} days</span>
                      ) : c.pending > 0 ? (
                        <span className="text-muted-foreground">Not yet due</span>
                      ) : <span className="text-emerald-600">—</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      {c.pending <= 0 ? <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px]">Cleared</Badge> : getPendingBadge(c.oldestDueDays)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Financial Dashboard Analysis */}
      {payments.length > 0 && (
        <AnalyticsGrid
          cards={[
            {
              title: "Monthly Collections",
              body: (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={monthlyTrend} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                    <Tooltip contentStyle={{ borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} formatter={(v: number) => fmt(v)} />
                    <Line type="monotone" dataKey="amount" name="Collected" stroke="hsl(142, 71%, 45%)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ),
            },
            {
              title: "Payment Mode Split",
              body: (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={modeData} cx="50%" cy="50%" innerRadius={42} outerRadius={75} paddingAngle={3} dataKey="value">
                      {modeData.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} formatter={(v: number) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              ),
            },
            {
              title: "Top Paying Clients",
              body: (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={topClients} layout="vertical" barSize={14} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" width={70} />
                    <Tooltip contentStyle={{ borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="value" fill="hsl(201, 96%, 42%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ),
            },
            {
              title: "Outstanding Aging",
              body: (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={agingBuckets} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="range" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                    <Tooltip contentStyle={{ borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="amount" fill="hsl(32, 95%, 50%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ),
            },
          ]}
        />
      )}

      {/* All Received Payments Table */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <h2 className="text-base font-semibold">All Received Payments</h2>
        <div className="relative max-w-sm w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search payments..." className="pl-9 h-8 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={CreditCard} title="No payments yet" description="Payments will appear here when recorded." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-10"><Checkbox checked={allSelected} onCheckedChange={toggleAll} /></TableHead>
                  <TableHead className="text-xs uppercase font-semibold text-muted-foreground">Date</TableHead>
                  <TableHead className="text-xs uppercase font-semibold text-muted-foreground">Payment #</TableHead>
                  <TableHead className="text-xs uppercase font-semibold text-muted-foreground">Reference Number</TableHead>
                  <TableHead className="text-xs uppercase font-semibold text-muted-foreground">Customer Name</TableHead>
                  <TableHead className="text-xs uppercase font-semibold text-muted-foreground">Invoice#</TableHead>
                  <TableHead className="text-xs uppercase font-semibold text-muted-foreground">Mode</TableHead>
                  <TableHead className="text-xs uppercase font-semibold text-muted-foreground text-right">Amount</TableHead>
                  <TableHead className="text-xs uppercase font-semibold text-muted-foreground text-right">Unused Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id} className="hover:bg-muted/50">
                    <TableCell onClick={(e) => e.stopPropagation()}><Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleOne(p.id)} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.payment_date ? format(parseISO(p.payment_date), "dd/MM/yyyy") : "-"}</TableCell>
                    <TableCell className="text-sm font-medium text-primary">{p.payment_number}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.reference_number || "-"}</TableCell>
                    <TableCell className="text-sm">{(p.clients as any)?.display_name}</TableCell>
                    <TableCell className="text-sm">{(p.invoices as any)?.invoice_number || "-"}</TableCell>
                    <TableCell className="text-sm capitalize">{(p.payment_mode || "").replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-sm text-right font-medium">{fmt(Number(p.amount))}</TableCell>
                    <TableCell className="text-sm text-right text-muted-foreground">{fmt(0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        fields={paymentImportFields}
        entityName="Payments"
        onImport={async (rows) => {
          let success = 0, errors = 0;
          const { data: clients } = await supabase.from("clients").select("id, display_name").eq("org_id", org!.id);
          const clientMap = new Map<string, string>();
          clients?.forEach(c => clientMap.set(c.display_name.toLowerCase(), c.id));

          const { data: allInvoices } = await supabase.from("invoices").select("id, invoice_number").eq("org_id", org!.id);
          const invMap = new Map<string, string>();
          allInvoices?.forEach(i => invMap.set(i.invoice_number.toLowerCase(), i.id));

          for (const row of rows) {
            const name = (row.client_name || "").trim();
            if (!name) { errors++; continue; }

            let clientId = clientMap.get(name.toLowerCase());
            // Auto-create client if not found
            if (!clientId) {
              const { data: newClient, error: cErr } = await supabase.from("clients").insert({
                org_id: org!.id, display_name: name,
              }).select("id").single();
              if (cErr || !newClient) { errors++; continue; }
              clientId = newClient.id;
              clientMap.set(name.toLowerCase(), clientId);
            }

            // Resolve invoice
            let invoiceId: string | null = null;
            if (row.invoice_number) {
              const invNum = row.invoice_number.trim().toLowerCase();
              invoiceId = invMap.get(invNum) || null;
            }

            const payAmount = parseFloat(row.amount) || 0;
            const { error } = await supabase.from("payments").insert({
              org_id: org!.id,
              client_id: clientId,
              payment_number: row.payment_number,
              amount: payAmount,
              payment_date: parseDate(row.payment_date) || new Date().toISOString().split("T")[0],
              payment_mode: row.payment_mode || "cash",
              reference_number: row.reference_number || null,
              invoice_id: invoiceId,
              notes: row.notes || null,
              currency_code: org!.currency_code,
            });
            if (error) { errors++; continue; }
            success++;

            // Update linked invoice balance
            if (invoiceId) {
              const { data: inv } = await supabase.from("invoices").select("total, balance_due, amount_paid").eq("id", invoiceId).single();
              if (inv) {
                const newBalance = Math.max(0, Number(inv.balance_due) - payAmount);
                const newPaid = Number(inv.amount_paid) + payAmount;
                const newStatus = newBalance <= 0 ? "paid" : "partial";
                await supabase.from("invoices").update({
                  balance_due: newBalance,
                  amount_paid: newPaid,
                  status: newStatus,
                  ...(newBalance <= 0 ? { paid_at: new Date().toISOString() } : {}),
                }).eq("id", invoiceId);
              }
            }
          }

          // Sync client opening_balance for all affected clients
          const affectedClients = new Set<string>();
          rows.forEach(r => {
            const cId = clientMap.get((r.client_name || "").trim().toLowerCase());
            if (cId) affectedClients.add(cId);
          });
          for (const cId of affectedClients) {
            const { data: cInvs } = await supabase.from("invoices").select("balance_due, status").eq("client_id", cId).neq("status", "void");
            const totalDue = (cInvs || []).reduce((s, i) => s + Number(i.balance_due || 0), 0);
            await supabase.from("clients").update({ opening_balance: totalDue }).eq("id", cId);
          }

          fetchData();
          return { success, errors };
        }}
      />

      {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} Payment(s)?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the selected payments. This action cannot be undone.</AlertDialogDescription>
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
