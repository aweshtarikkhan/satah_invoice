import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ImportDialog, ImportField } from "@/components/shared/ImportDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CreditCard, Search, Upload, DollarSign, TrendingUp, Hash } from "lucide-react";
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

export default function PaymentsPage() {
  const org = useAppStore((s) => s.organization);
  const [payments, setPayments] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);

  const fetchPayments = async () => {
    if (!org?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("payments")
      .select("*, clients(display_name), invoices(invoice_number)")
      .eq("org_id", org.id)
      .order("payment_date", { ascending: false });
    setPayments(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchPayments(); }, [org?.id]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: org?.currency_code || "USD" }).format(n);

  const filtered = payments.filter((p) =>
    [p.payment_number, (p.clients as any)?.display_name, p.reference_number]
      .filter(Boolean)
      .some((f) => f.toLowerCase().includes(search.toLowerCase()))
  );

  // --- Chart Data ---
  const totalCollected = payments.reduce((s, p) => s + Number(p.amount), 0);
  const avgPayment = payments.length > 0 ? totalCollected / payments.length : 0;

  // Monthly trend (last 6 months)
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

  // Payment mode pie
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

  // Top clients bar
  const clientMap: Record<string, number> = {};
  payments.forEach((p) => {
    const name = (p.clients as any)?.display_name || "Unknown";
    clientMap[name] = (clientMap[name] || 0) + Number(p.amount);
  });
  const topClients = Object.entries(clientMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Payments" description="Payment history">
        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
          <Upload className="mr-1 h-4 w-4" /> Import
        </Button>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Collected</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{fmt(totalCollected)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Payments</CardTitle>
            <Hash className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{payments.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Payment</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{fmt(avgPayment)}</div></CardContent>
        </Card>
      </div>

      {/* Charts */}
      {payments.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Monthly Payment Trend */}
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

          {/* Payment Mode Pie */}
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

          {/* Top Clients */}
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
          fetchPayments();
          return { success, errors };
        }}
      />
    </div>
  );
}
