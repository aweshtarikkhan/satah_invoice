import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  DollarSign,
  AlertTriangle,
  Clock,
  Calendar,
  Plus,
  FileText,
  Users,
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
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface DashboardStats {
  totalReceivable: number;
  overdue: number;
  dueToday: number;
  due30Days: number;
}

interface MonthlyData {
  month: string;
  invoiced: number;
  collected: number;
}

interface StatusCount {
  name: string;
  value: number;
  color: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "hsl(215, 16%, 47%)",
  sent: "hsl(201, 96%, 32%)",
  viewed: "hsl(32, 95%, 44%)",
  partial: "hsl(32, 95%, 44%)",
  paid: "hsl(142, 71%, 45%)",
  overdue: "hsl(0, 72%, 51%)",
  void: "hsl(215, 16%, 70%)",
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const org = useAppStore((s) => s.organization);
  const [stats, setStats] = useState<DashboardStats>({ totalReceivable: 0, overdue: 0, dueToday: 0, due30Days: 0 });
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [statusData, setStatusData] = useState<StatusCount[]>([]);
  const [paymentModeData, setPaymentModeData] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    if (!org?.id) return;

    const fetchData = async () => {
      // Fetch invoice stats
      const { data: invoices } = await supabase
        .from("invoices")
        .select("balance_due, status, due_date, total, issue_date, created_at")
        .eq("org_id", org.id)
        .neq("status", "void");

      if (invoices) {
        const today = new Date().toISOString().split("T")[0];
        const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
        setStats({
          totalReceivable: invoices.reduce((s, i) => s + Number(i.balance_due), 0),
          overdue: invoices.filter((i) => i.status === "overdue").reduce((s, i) => s + Number(i.balance_due), 0),
          dueToday: invoices.filter((i) => i.due_date === today).reduce((s, i) => s + Number(i.balance_due), 0),
          due30Days: invoices.filter((i) => i.due_date <= in30 && i.due_date > today).reduce((s, i) => s + Number(i.balance_due), 0),
        });

        // Status distribution
        const statusMap: Record<string, number> = {};
        invoices.forEach((i) => { statusMap[i.status] = (statusMap[i.status] || 0) + 1; });
        setStatusData(
          Object.entries(statusMap).map(([name, value]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            value,
            color: STATUS_COLORS[name] || "hsl(215, 16%, 47%)",
          }))
        );

        // Monthly invoiced amounts (last 6 months)
        const monthMap: Record<string, number> = {};
        invoices.forEach((i) => {
          const m = (i.issue_date || "").slice(0, 7); // YYYY-MM
          if (m) monthMap[m] = (monthMap[m] || 0) + Number(i.total);
        });

        // Fetch payments for monthly collected
        const { data: payments } = await supabase
          .from("payments")
          .select("amount, payment_date, payment_mode")
          .eq("org_id", org.id);

        const paymentMonthMap: Record<string, number> = {};
        const modeMap: Record<string, number> = {};
        (payments || []).forEach((p) => {
          const m = (p.payment_date || "").slice(0, 7);
          if (m) paymentMonthMap[m] = (paymentMonthMap[m] || 0) + Number(p.amount);
          const mode = (p.payment_mode || "other").replace(/_/g, " ");
          modeMap[mode] = (modeMap[mode] || 0) + Number(p.amount);
        });

        setPaymentModeData(
          Object.entries(modeMap)
            .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
            .sort((a, b) => b.value - a.value)
        );

        // Build last 6 months
        const months: MonthlyData[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          const key = d.toISOString().slice(0, 7);
          const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
          months.push({
            month: label,
            invoiced: monthMap[key] || 0,
            collected: paymentMonthMap[key] || 0,
          });
        }
        setMonthlyData(months);
      }

      // Recent invoices
      const { data: recent } = await supabase
        .from("invoices")
        .select("*, clients(display_name)")
        .eq("org_id", org.id)
        .order("created_at", { ascending: false })
        .limit(10);
      setRecentInvoices(recent || []);
    };

    fetchData();
  }, [org?.id]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: org?.currency_code || "USD" }).format(n);

  const summaryCards = [
    { title: "Total Receivable", value: fmt(stats.totalReceivable), icon: DollarSign, color: "text-primary" },
    { title: "Overdue", value: fmt(stats.overdue), icon: AlertTriangle, color: "text-destructive" },
    { title: "Due Today", value: fmt(stats.dueToday), icon: Clock, color: "text-warning" },
    { title: "Due in 30 Days", value: fmt(stats.due30Days), icon: Calendar, color: "text-muted-foreground" },
  ];

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Revenue vs Collections */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoiced vs Collected (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs fill-muted-foreground" tick={{ fontSize: 12 }} />
                <YAxis className="text-xs fill-muted-foreground" tick={{ fontSize: 12 }} tickFormatter={(v) => `${org?.currency_code === "INR" ? "₹" : "$"}${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                <Tooltip
                  contentStyle={{ borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--card-foreground))" }}
                  formatter={(value: number) => fmt(value)}
                />
                <Legend />
                <Bar dataKey="invoiced" name="Invoiced" fill="hsl(201, 96%, 32%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="collected" name="Collected" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Invoice Status Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoice Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No invoices yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name} (${value})`}
                  >
                    {statusData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--card-foreground))" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment Trends & Mode Breakdown */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Payment Trends Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Trends (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs fill-muted-foreground" tick={{ fontSize: 12 }} />
                <YAxis className="text-xs fill-muted-foreground" tick={{ fontSize: 12 }} tickFormatter={(v) => `${org?.currency_code === "INR" ? "₹" : "$"}${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                <Tooltip
                  contentStyle={{ borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--card-foreground))" }}
                  formatter={(value: number) => fmt(value)}
                />
                <Legend />
                <Line type="monotone" dataKey="collected" name="Payments" stroke="hsl(142, 71%, 45%)" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="invoiced" name="Invoiced" stroke="hsl(201, 96%, 32%)" strokeWidth={2} dot={{ r: 4 }} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Payment Mode Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Mode Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentModeData.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No payments recorded yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={paymentModeData} layout="vertical" barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" className="text-xs fill-muted-foreground" tick={{ fontSize: 12 }} tickFormatter={(v) => `${org?.currency_code === "INR" ? "₹" : "$"}${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                  <YAxis type="category" dataKey="name" className="text-xs fill-muted-foreground" tick={{ fontSize: 12 }} width={100} />
                  <Tooltip
                    contentStyle={{ borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--card-foreground))" }}
                    formatter={(value: number) => fmt(value)}
                  />
                  <Bar dataKey="value" name="Amount" fill="hsl(201, 96%, 32%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

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
                  <TableRow
                    key={inv.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/invoices/${inv.id}`)}
                  >
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
