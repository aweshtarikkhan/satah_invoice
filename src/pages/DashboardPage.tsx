import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Plus,
  FileText,
  Users,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  draft: "hsl(215, 16%, 47%)",
  sent: "hsl(201, 96%, 32%)",
  viewed: "hsl(32, 95%, 44%)",
  partial: "hsl(32, 95%, 44%)",
  paid: "hsl(142, 71%, 45%)",
  overdue: "hsl(0, 72%, 51%)",
  void: "hsl(215, 16%, 70%)",
};

const AGING_COLORS = ["hsl(142, 71%, 45%)", "hsl(32, 95%, 44%)", "hsl(25, 95%, 53%)", "hsl(0, 84%, 60%)", "hsl(0, 72%, 51%)"];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const org = useAppStore((s) => s.organization);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);

  useEffect(() => {
    if (!org?.id) return;
    const fetchData = async () => {
      const [invRes, payRes, recentRes] = await Promise.all([
        supabase.from("invoices").select("balance_due, status, due_date, total, issue_date, created_at, amount_paid").eq("org_id", org.id).neq("status", "void"),
        supabase.from("payments").select("amount, payment_date, payment_mode, client_id").eq("org_id", org.id),
        supabase.from("invoices").select("*, clients(display_name)").eq("org_id", org.id).order("created_at", { ascending: false }).limit(10),
      ]);
      setInvoices(invRes.data || []);
      setPayments(payRes.data || []);
      setRecentInvoices(recentRes.data || []);
    };
    fetchData();
  }, [org?.id]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: org?.currency_code || "USD" }).format(n);

  // Total Receivables
  const totalReceivable = useMemo(() => invoices.reduce((s, i) => s + Number(i.balance_due), 0), [invoices]);

  // Aging buckets
  const agingData = useMemo(() => {
    const today = new Date();
    const buckets = [
      { label: "Current", min: -Infinity, max: 0, amount: 0 },
      { label: "1-15 Days", min: 1, max: 15, amount: 0 },
      { label: "16-30 Days", min: 16, max: 30, amount: 0 },
      { label: "31-45 Days", min: 31, max: 45, amount: 0 },
      { label: "Above 45 Days", min: 46, max: Infinity, amount: 0 },
    ];
    invoices.forEach((inv) => {
      const bal = Number(inv.balance_due);
      if (bal <= 0) return;
      const due = new Date(inv.due_date);
      const daysOverdue = Math.floor((today.getTime() - due.getTime()) / 86400000);
      if (daysOverdue <= 0) buckets[0].amount += bal;
      else if (daysOverdue <= 15) buckets[1].amount += bal;
      else if (daysOverdue <= 30) buckets[2].amount += bal;
      else if (daysOverdue <= 45) buckets[3].amount += bal;
      else buckets[4].amount += bal;
    });
    return buckets;
  }, [invoices]);

  // Overdue percentage for progress bar
  const overdueTotal = useMemo(() => agingData.slice(1).reduce((s, b) => s + b.amount, 0), [agingData]);
  const overduePercent = totalReceivable > 0 ? Math.min((overdueTotal / totalReceivable) * 100, 100) : 0;

  // Sales, Receipts, Dues summary table
  const salesReceiptsDues = useMemo(() => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfQuarter = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    const periods = [
      { label: "Today", start: startOfDay },
      { label: "This Week", start: startOfWeek },
      { label: "This Month", start: startOfMonth },
      { label: "This Quarter", start: startOfQuarter },
      { label: "This Year", start: startOfYear },
    ];

    return periods.map(({ label, start }) => {
      const sales = invoices
        .filter((i) => new Date(i.issue_date) >= start)
        .reduce((s, i) => s + Number(i.total), 0);
      const receipts = payments
        .filter((p) => new Date(p.payment_date) >= start)
        .reduce((s, p) => s + Number(p.amount), 0);
      return { label, sales, receipts, due: sales - receipts };
    });
  }, [invoices, payments]);

  // Monthly invoiced vs collected (last 6 months)
  const monthlyData = useMemo(() => {
    const monthMap: Record<string, number> = {};
    const paymentMonthMap: Record<string, number> = {};
    invoices.forEach((i) => {
      const m = (i.issue_date || "").slice(0, 7);
      if (m) monthMap[m] = (monthMap[m] || 0) + Number(i.total);
    });
    payments.forEach((p) => {
      const m = (p.payment_date || "").slice(0, 7);
      if (m) paymentMonthMap[m] = (paymentMonthMap[m] || 0) + Number(p.amount);
    });
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
      months.push({ month: label, invoiced: monthMap[key] || 0, collected: paymentMonthMap[key] || 0 });
    }
    return months;
  }, [invoices, payments]);

  // Status distribution
  const statusData = useMemo(() => {
    const statusMap: Record<string, number> = {};
    invoices.forEach((i) => { statusMap[i.status] = (statusMap[i.status] || 0) + 1; });
    return Object.entries(statusMap).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: STATUS_COLORS[name] || "hsl(215, 16%, 47%)",
    }));
  }, [invoices]);

  // Top clients by receivable
  const topClients = useMemo(() => {
    const clientMap: Record<string, number> = {};
    invoices.forEach((i) => {
      // We don't have client name here, use client_id
      const key = i.client_id || "unknown";
      clientMap[key] = (clientMap[key] || 0) + Number(i.balance_due);
    });
    return Object.entries(clientMap)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([, value]) => ({ value }));
  }, [invoices]);

  // Payment mode breakdown
  const paymentModeData = useMemo(() => {
    const modeMap: Record<string, number> = {};
    payments.forEach((p) => {
      const mode = (p.payment_mode || "other").replace(/_/g, " ");
      modeMap[mode] = (modeMap[mode] || 0) + Number(p.amount);
    });
    return Object.entries(modeMap)
      .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
      .sort((a, b) => b.value - a.value);
  }, [payments]);

  const totalSales = invoices.reduce((s, i) => s + Number(i.total), 0);
  const totalReceipts = payments.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Dashboard" description={`Welcome back${profile?.first_name ? `, ${profile.first_name}` : ""}`}>
        <Button onClick={() => navigate("/invoices/new")} size="sm">
          <Plus className="mr-1 h-4 w-4" /> New Invoice
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate("/clients")}>
          <Users className="mr-1 h-4 w-4" /> New Client
        </Button>
      </PageHeader>

      {/* Total Receivables with Aging */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Total Receivables</CardTitle>
            <Button size="sm" variant="outline" onClick={() => navigate("/invoices/new")}>
              <Plus className="mr-1 h-4 w-4" /> New
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Total Receivables {fmt(totalReceivable)}</p>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${overduePercent}%`,
                  background: overduePercent > 50 ? "hsl(0, 72%, 51%)" : "hsl(32, 95%, 44%)",
                }}
              />
            </div>
          </div>
          <div className="grid grid-cols-5 gap-4 pt-2">
            {agingData.map((bucket, idx) => (
              <div key={bucket.label} className="text-center">
                <p className="text-xs font-medium mb-1" style={{ color: AGING_COLORS[idx] }}>
                  {idx === 0 ? "CURRENT" : "OVERDUE"}
                </p>
                <p className="text-lg font-bold">{fmt(bucket.amount)}</p>
                <p className="text-xs text-muted-foreground">{bucket.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sales & Expenses Chart + Sales/Receipts/Dues Table */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sales and Collections</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip contentStyle={{ borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--card-foreground))" }} formatter={(value: number) => fmt(value)} />
                <Legend />
                <Bar dataKey="invoiced" name="Sales" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="collected" name="Receipts" fill="hsl(201, 96%, 32%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex justify-around pt-4 border-t mt-4">
              <div className="text-center">
                <p className="text-xs text-success font-medium flex items-center gap-1 justify-center"><TrendingUp className="h-3 w-3" /> Total Sales</p>
                <p className="text-lg font-bold">{fmt(totalSales)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-primary font-medium flex items-center gap-1 justify-center"><TrendingDown className="h-3 w-3" /> Total Receipts</p>
                <p className="text-lg font-bold">{fmt(totalReceipts)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sales, Receipts, and Dues</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead className="text-right">SALES</TableHead>
                  <TableHead className="text-right">RECEIPTS</TableHead>
                  <TableHead className="text-right">DUE</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesReceiptsDues.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell className="font-medium text-primary">{row.label}</TableCell>
                    <TableCell className="text-right">{fmt(row.sales)}</TableCell>
                    <TableCell className="text-right">{fmt(row.receipts)}</TableCell>
                    <TableCell className="text-right font-medium text-destructive">{fmt(row.due)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Invoice Status + Payment Mode */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoice Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No invoices yet</p>
            ) : (
              <div className="flex items-center">
                <ResponsiveContainer width="60%" height={240}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                      {statusData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--card-foreground))" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {statusData.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-2 text-sm">
                      <div className="h-3 w-3 rounded-sm" style={{ background: entry.color }} />
                      <span className="text-muted-foreground">{entry.name}</span>
                      <span className="ml-auto font-medium">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Mode Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentModeData.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No payments recorded yet</p>
            ) : (
              <div className="flex items-center">
                <ResponsiveContainer width="60%" height={240}>
                  <PieChart>
                    <Pie data={paymentModeData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" label={false}>
                      {paymentModeData.map((_, idx) => (
                        <Cell key={idx} fill={AGING_COLORS[idx % AGING_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--card-foreground))" }} formatter={(value: number) => fmt(value)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {paymentModeData.map((entry, idx) => (
                    <div key={entry.name} className="flex items-center gap-2 text-sm">
                      <div className="h-3 w-3 rounded-sm" style={{ background: AGING_COLORS[idx % AGING_COLORS.length] }} />
                      <span className="text-muted-foreground">{entry.name}</span>
                      <span className="ml-auto font-medium">{fmt(entry.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Recent Invoices
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentInvoices.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No invoices yet.{" "}
              <button onClick={() => navigate("/invoices/new")} className="text-primary hover:underline">
                Create your first invoice
              </button>
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentInvoices.map((inv) => (
                  <TableRow key={inv.id} className="cursor-pointer" onClick={() => navigate(`/invoices/${inv.id}`)}>
                    <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                    <TableCell>{(inv.clients as any)?.display_name}</TableCell>
                    <TableCell>{inv.issue_date}</TableCell>
                    <TableCell>{inv.due_date}</TableCell>
                    <TableCell className="text-right">{fmt(Number(inv.total))}</TableCell>
                    <TableCell><StatusBadge status={inv.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
