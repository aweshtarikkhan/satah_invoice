import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from "recharts";
import { Download, TrendingUp, TrendingDown, DollarSign, Minus } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { downloadCSV } from "@/lib/export-csv";

export default function ProfitLossPage() {
  const org = useAppStore((s) => s.organization);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [period, setPeriod] = useState("12");
  const [loading, setLoading] = useState(true);

  const currency = org?.currency_code || "USD";
  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

  useEffect(() => {
    if (!org?.id) return;
    const fetch = async () => {
      setLoading(true);
      const [inv, pay, exp] = await Promise.all([
        supabase.from("invoices").select("total, total_tax, total_discount, issue_date, status").eq("org_id", org.id).neq("status", "void"),
        supabase.from("payments").select("amount, payment_date").eq("org_id", org.id),
        supabase.from("business_expenses").select("amount, expense_date, category").eq("org_id", org.id),
      ]);
      setInvoices(inv.data || []);
      setPayments(pay.data || []);
      setExpenses(exp.data || []);
      setLoading(false);
    };
    fetch();
  }, [org?.id]);

  const months = useMemo(() => {
    const count = parseInt(period);
    return Array.from({ length: count }, (_, i) => {
      const d = subMonths(new Date(), count - 1 - i);
      return { start: startOfMonth(d), end: endOfMonth(d), label: format(d, "MMM yy") };
    });
  }, [period]);

  const monthlyData = useMemo(() => {
    return months.map((m) => {
      const revenue = payments.filter(p => isWithinInterval(new Date(p.payment_date), { start: m.start, end: m.end }))
        .reduce((s, p) => s + Number(p.amount), 0);
      const expense = expenses.filter(e => isWithinInterval(new Date(e.expense_date), { start: m.start, end: m.end }))
        .reduce((s, e) => s + Number(e.amount), 0);
      return { name: m.label, revenue, expense, profit: revenue - expense };
    });
  }, [months, payments, expenses]);

  const totals = useMemo(() => {
    const totalRevenue = monthlyData.reduce((s, m) => s + m.revenue, 0);
    const totalExpenses = monthlyData.reduce((s, m) => s + m.expense, 0);
    const totalInvoiced = invoices.reduce((s, i) => s + Number(i.total), 0);
    const totalTax = invoices.reduce((s, i) => s + Number(i.total_tax), 0);
    const totalDiscount = invoices.reduce((s, i) => s + Number(i.total_discount), 0);
    return {
      revenue: totalRevenue,
      expenses: totalExpenses,
      profit: totalRevenue - totalExpenses,
      invoiced: totalInvoiced,
      tax: totalTax,
      discount: totalDiscount,
      margin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue * 100) : 0,
    };
  }, [monthlyData, invoices]);

  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => {
      const cutoff = subMonths(new Date(), parseInt(period));
      if (new Date(e.expense_date) >= cutoff) {
        map[e.category] = (map[e.category] || 0) + Number(e.amount);
      }
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([category, amount]) => ({ category, amount }));
  }, [expenses, period]);

  if (loading) return <div className="p-6">Loading P&L report...</div>;

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Profit & Loss" description="Income vs expenses breakdown">
        <Button variant="outline" size="sm" onClick={() => downloadCSV(monthlyData, "profit-loss-report")}>
          <Download className="mr-1 h-4 w-4" /> Export CSV
        </Button>
      </PageHeader>

      <Select value={period} onValueChange={setPeriod}>
        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="3">Last 3 months</SelectItem>
          <SelectItem value="6">Last 6 months</SelectItem>
          <SelectItem value="12">Last 12 months</SelectItem>
        </SelectContent>
      </Select>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Income</p>
                <p className="text-xl font-bold">{fmt(totals.revenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Expenses</p>
                <p className="text-xl font-bold">{fmt(totals.expenses)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${totals.profit >= 0 ? "bg-success/10" : "bg-destructive/10"}`}>
                <DollarSign className={`h-5 w-5 ${totals.profit >= 0 ? "text-success" : "text-destructive"}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Net Profit</p>
                <p className={`text-xl font-bold ${totals.profit >= 0 ? "text-success" : "text-destructive"}`}>{fmt(totals.profit)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Minus className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Profit Margin</p>
                <p className="text-xl font-bold">{totals.margin.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue vs Expense Chart */}
      <Card>
        <CardHeader><CardTitle>Income vs Expenses</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" className="text-xs fill-muted-foreground" />
              <YAxis className="text-xs fill-muted-foreground" tickFormatter={(v) => fmt(v)} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend />
              <Bar dataKey="revenue" name="Income" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Profit Trend */}
      <Card>
        <CardHeader><CardTitle>Net Profit Trend</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" className="text-xs fill-muted-foreground" />
              <YAxis className="text-xs fill-muted-foreground" tickFormatter={(v) => fmt(v)} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Area type="monotone" dataKey="profit" name="Net Profit" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* P&L Table */}
        <Card>
          <CardHeader><CardTitle>Monthly Breakdown</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Income</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyData.map((m) => (
                  <TableRow key={m.name}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-right text-success">{fmt(m.revenue)}</TableCell>
                    <TableCell className="text-right text-destructive">{fmt(m.expense)}</TableCell>
                    <TableCell className={`text-right font-semibold ${m.profit >= 0 ? "text-success" : "text-destructive"}`}>{fmt(m.profit)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold border-t-2">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right text-success">{fmt(totals.revenue)}</TableCell>
                  <TableCell className="text-right text-destructive">{fmt(totals.expenses)}</TableCell>
                  <TableCell className={`text-right ${totals.profit >= 0 ? "text-success" : "text-destructive"}`}>{fmt(totals.profit)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Expense by Category */}
        <Card>
          <CardHeader><CardTitle>Expenses by Category</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">% of Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenseByCategory.map((row) => (
                  <TableRow key={row.category}>
                    <TableCell className="font-medium">{row.category}</TableCell>
                    <TableCell className="text-right">{fmt(row.amount)}</TableCell>
                    <TableCell className="text-right">{totals.expenses > 0 ? (row.amount / totals.expenses * 100).toFixed(1) : 0}%</TableCell>
                  </TableRow>
                ))}
                {expenseByCategory.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No expenses recorded</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Tax Summary */}
      <Card>
        <CardHeader><CardTitle>Tax Summary (GST Breakdown)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border p-4 text-center">
              <p className="text-sm text-muted-foreground">Total Invoiced</p>
              <p className="text-2xl font-bold">{fmt(totals.invoiced)}</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-sm text-muted-foreground">Total Tax Collected</p>
              <p className="text-2xl font-bold text-primary">{fmt(totals.tax)}</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-sm text-muted-foreground">Total Discounts Given</p>
              <p className="text-2xl font-bold text-warning">{fmt(totals.discount)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
