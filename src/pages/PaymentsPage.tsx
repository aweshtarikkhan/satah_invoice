import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ImportDialog, ImportField } from "@/components/shared/ImportDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CreditCard, Search, Upload, DollarSign, TrendingUp, Hash, Plus, AlertTriangle, Clock, CheckCircle2, Filter } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const paymentImportFields: ImportField[] = [
  { key: "payment_number", label: "Payment #", required: true },
  { key: "client_name", label: "Client Name", required: true },
  { key: "amount", label: "Amount", required: true },
  { key: "payment_date", label: "Payment Date" },
  { key: "payment_mode", label: "Payment Mode" },
  { key: "reference_number", label: "Reference #" },
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

  const fetchData = async () => {
    if (!org?.id) return;
    setLoading(true);
    const [{ data: payData }, { data: invData }] = await Promise.all([
      supabase.from("payments").select("*, clients(display_name, id), invoices(invoice_number)").eq("org_id", org.id).order("payment_date", { ascending: false }),
      supabase.from("invoices").select("id, client_id, total, amount_paid, balance_due, due_date, status, clients(display_name, id)").eq("org_id", org.id),
    ]);
    setPayments(payData || []);
    setInvoices(invData || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [org?.id]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: org?.currency_code || "USD" }).format(n);

  // --- Client Summaries ---
  const clientSummaries = useMemo<ClientSummary[]>(() => {
    const map: Record<string, ClientSummary> = {};
    const today = new Date();

    invoices.forEach((inv) => {
      const clientId = inv.client_id;
      const clientName = (inv.clients as any)?.display_name || "Unknown";
      if (!map[clientId]) {
        map[clientId] = { id: clientId, name: clientName, totalBilled: 0, totalPaid: 0, pending: 0, oldestDueDays: 0, overdueInvoices: 0 };
      }
      map[clientId].totalBilled += Number(inv.total);
      map[clientId].totalPaid += Number(inv.amount_paid);
      map[clientId].pending += Number(inv.balance_due);

      if (Number(inv.balance_due) > 0 && inv.status !== "void") {
        const dueDate = new Date(inv.due_date);
        const daysPast = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / 86400000));
        if (daysPast > map[clientId].oldestDueDays) map[clientId].oldestDueDays = daysPast;
        if (daysPast > 0) map[clientId].overdueInvoices++;
      }
    });

    return Object.values(map);
  }, [invoices]);

  const filteredClients = useMemo(() => {
    let list = clientSummaries;

    // Client name search
    if (clientSearch) {
      list = list.filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase()));
    }

    // Aging filter
    if (agingFilter !== "all") {
      const days = parseInt(agingFilter);
      list = list.filter((c) => c.oldestDueDays > days);
    }

    // Amount sort
    if (amountSort === "asc") list = [...list].sort((a, b) => a.pending - b.pending);
    else if (amountSort === "desc") list = [...list].sort((a, b) => b.pending - a.pending);
    else list = [...list].sort((a, b) => b.pending - a.pending); // default: highest pending first

    return list;
  }, [clientSummaries, clientSearch, agingFilter, amountSort]);

  // Global totals
  const globalTotalBilled = clientSummaries.reduce((s, c) => s + c.totalBilled, 0);
  const globalTotalPaid = clientSummaries.reduce((s, c) => s + c.totalPaid, 0);
  const globalPending = clientSummaries.reduce((s, c) => s + c.pending, 0);
  const overdueCount = clientSummaries.filter((c) => c.oldestDueDays > 0 && c.pending > 0).length;

  // Payments table filter
  const filtered = payments.filter((p) =>
    [p.payment_number, (p.clients as any)?.display_name, p.reference_number]
      .filter(Boolean)
      .some((f) => f.toLowerCase().includes(search.toLowerCase()))
  );

  // --- Chart Data ---
  const totalCollected = payments.reduce((s, p) => s + Number(p.amount), 0);
  const avgPayment = payments.length > 0 ? totalCollected / payments.length : 0;

  const monthlyMap: Record<string, number> = {};
  payments.forEach((p) => {
    const m = (p.payment_date || "").slice(0, 7);
    if (m) monthlyMap[m] = (monthlyMap[m] || 0) + Number(p.amount);
  });
  const monthlyTrend: { month: string; amount: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toISOString().slice(0, 7);
    const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
    monthlyTrend.push({ month: label, amount: monthlyMap[key] || 0 });
  }

  const modeMap: Record<string, number> = {};
  payments.forEach((p) => {
    const mode = (p.payment_mode || "other").replace(/_/g, " ");
    modeMap[mode] = (modeMap[mode] || 0) + Number(p.amount);
  });
  const modeData = Object.entries(modeMap)
    .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
    .sort((a, b) => b.value - a.value);

  const PIE_COLORS = [
    "hsl(201, 96%, 32%)", "hsl(142, 71%, 45%)", "hsl(32, 95%, 44%)",
    "hsl(0, 72%, 51%)", "hsl(262, 83%, 58%)", "hsl(215, 16%, 47%)",
  ];

  const topClients = Object.entries(
    payments.reduce<Record<string, number>>((acc, p) => {
      const name = (p.clients as any)?.display_name || "Unknown";
      acc[name] = (acc[name] || 0) + Number(p.amount);
      return acc;
    }, {})
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Payments Received" description="Track all payments received from clients">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1 h-4 w-4" /> Import
          </Button>
          <Button size="sm" onClick={() => navigate("/payments/new")}>
            <Plus className="mr-1 h-4 w-4" /> Record Payment
          </Button>
        </div>
      </PageHeader>

      {/* ===== GLOBAL SUMMARY CARDS ===== */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Billed</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{fmt(globalTotalBilled)}</div></CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Received</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{fmt(globalTotalPaid)}</div></CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pending</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{fmt(globalPending)}</div></CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overdue Clients</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600 dark:text-red-400">{overdueCount}</div></CardContent>
        </Card>
      </div>

      {/* ===== CLIENT RECEIVABLES TABLE ===== */}
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
                <SelectTrigger className="w-[140px] h-8 text-sm">
                  <Filter className="mr-1 h-3.5 w-3.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGING_FILTERS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={amountSort} onValueChange={(v: any) => setAmountSort(v)}>
                <SelectTrigger className="w-[150px] h-8 text-sm">
                  <SelectValue placeholder="Sort by amount" />
                </SelectTrigger>
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
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Total Billed</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="text-center">Overdue Since</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/clients`)}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-right text-blue-600 dark:text-blue-400">{fmt(c.totalBilled)}</TableCell>
                    <TableCell className="text-right text-emerald-600 dark:text-emerald-400">{fmt(c.totalPaid)}</TableCell>
                    <TableCell className={`text-right font-semibold ${getPendingColor(c.oldestDueDays)}`}>
                      {fmt(c.pending)}
                    </TableCell>
                    <TableCell className="text-center">
                      {c.pending > 0 && c.oldestDueDays > 0 ? (
                        <span className={`text-sm font-medium ${getPendingColor(c.oldestDueDays)}`}>
                          {c.oldestDueDays} days
                        </span>
                      ) : c.pending > 0 ? (
                        <span className="text-sm text-muted-foreground">Not yet due</span>
                      ) : (
                        <span className="text-sm text-emerald-600">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {c.pending <= 0 ? (
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px]">Cleared</Badge>
                      ) : (
                        getPendingBadge(c.oldestDueDays)
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ===== CHARTS ===== */}
      {payments.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Monthly Collections</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                  <Tooltip contentStyle={{ borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--card-foreground))" }} formatter={(v: number) => fmt(v)} />
                  <Line type="monotone" dataKey="amount" name="Collected" stroke="hsl(142, 71%, 45%)" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Payment Mode Breakdown</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={modeData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {modeData.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--card-foreground))" }} formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Top Paying Clients</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topClients} layout="vertical" barSize={22}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tick={{ fontSize: 12 }} className="fill-muted-foreground" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} className="fill-muted-foreground" width={120} />
                  <Tooltip contentStyle={{ borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--card-foreground))" }} formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="value" name="Total Paid" fill="hsl(201, 96%, 32%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===== PAYMENTS TABLE ===== */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search payments..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={CreditCard} title="No payments yet" description="Payments will appear here when recorded against invoices." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.payment_number}</TableCell>
                    <TableCell>{p.payment_date}</TableCell>
                    <TableCell>{(p.clients as any)?.display_name}</TableCell>
                    <TableCell>{(p.invoices as any)?.invoice_number || "—"}</TableCell>
                    <TableCell className="capitalize">{p.payment_mode.replace("_", " ")}</TableCell>
                    <TableCell className="text-right">{fmt(Number(p.amount))}</TableCell>
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
        fields={paymentImportFields}
        entityName="Payments"
        onImport={async (rows) => {
          let success = 0, errors = 0;
          const { data: clients } = await supabase.from("clients").select("id, display_name").eq("org_id", org!.id);
          for (const row of rows) {
            const client = clients?.find((c) => c.display_name.toLowerCase() === (row.client_name || "").toLowerCase());
            if (!client) { errors++; continue; }
            const { error } = await supabase.from("payments").insert({
              org_id: org!.id,
              client_id: client.id,
              payment_number: row.payment_number,
              amount: parseFloat(row.amount) || 0,
              payment_date: row.payment_date || new Date().toISOString().split("T")[0],
              payment_mode: row.payment_mode || "bank_transfer",
              reference_number: row.reference_number || null,
              notes: row.notes || null,
              currency_code: org!.currency_code,
            });
            if (error) errors++; else success++;
          }
          fetchData();
          return { success, errors };
        }}
      />
    </div>
  );
}
