import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
import { SEO } from "@/components/shared/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Download, TrendingUp, Clock, DollarSign, FileText } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, differenceInDays } from "date-fns";

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "#94a3b8"];

export default function ReportsPage() {
  const org = useAppStore((s) => s.organization);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [period, setPeriod] = useState("12");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!org?.id) return;
    const fetch = async () => {
      setLoading(true);
      const [inv, pay, cl] = await Promise.all([
        supabase.from("invoices").select("*").eq("org_id", org.id),
        supabase.from("payments").select("*").eq("org_id", org.id),
        supabase.from("clients").select("*").eq("org_id", org.id),
      ]);
      setInvoices(inv.data || []);
      setPayments(pay.data || []);
      setClients(cl.data || []);
      setLoading(false);
    };
    fetch();
  }, [org?.id]);

  const currency = org?.currency_code || "INR";
  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

  const months = useMemo(() => {
    const count = parseInt(period);
    return Array.from({ length: count }, (_, i) => {
      const d = subMonths(new Date(), count - 1 - i);
      return { start: startOfMonth(d), end: endOfMonth(d), label: format(d, "MMM yy") };
    });
  }, [period]);

  const revenueData = useMemo(() => {
    return months.map((m) => {
      const monthPayments = payments.filter((p) =>
        isWithinInterval(new Date(p.payment_date), { start: m.start, end: m.end })
      );
      const revenue = monthPayments.reduce((s, p) => s + Number(p.amount), 0);
      const monthInvoices = invoices.filter((inv) =>
        isWithinInterval(new Date(inv.issue_date), { start: m.start, end: m.end })
      );
      const invoiced = monthInvoices.reduce((s, inv) => s + Number(inv.total), 0);
      return { name: m.label, revenue, invoiced };
    });
  }, [months, payments, invoices]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    invoices.forEach((inv) => { counts[inv.status] = (counts[inv.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
  }, [invoices]);

  const agingData = useMemo(() => {
    const now = new Date();
    const buckets = [
      { label: "Current", min: -Infinity, max: 0 },
      { label: "1-30 days", min: 1, max: 30 },
      { label: "31-60 days", min: 31, max: 60 },
      { label: "61-90 days", min: 61, max: 90 },
      { label: "90+ days", min: 91, max: Infinity },
    ];
    const outstanding = invoices.filter((i) => !["paid", "void", "draft"].includes(i.status));
    return buckets.map((b) => {
      const matching = outstanding.filter((inv) => {
        const days = differenceInDays(now, new Date(inv.due_date));
        return days >= b.min && days <= b.max;
      });
      return { bucket: b.label, amount: matching.reduce((s, inv) => s + Number(inv.balance_due), 0), count: matching.length };
    });
  }, [invoices]);

  const topClients = useMemo(() => {
    const map: Record<string, { name: string; total: number; count: number }> = {};
    invoices.forEach((inv) => {
      const cl = clients.find((c) => c.id === inv.client_id);
      const name = cl?.display_name || "Unknown";
      if (!map[inv.client_id]) map[inv.client_id] = { name, total: 0, count: 0 };
      map[inv.client_id].total += Number(inv.total);
      map[inv.client_id].count += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [invoices, clients]);

  const taxSummary = useMemo(() => {
    const totalTax = invoices.reduce((s, inv) => s + Number(inv.total_tax), 0);
    const totalRevenue = invoices.reduce((s, inv) => s + Number(inv.total), 0);
    const totalCollected = payments.reduce((s, p) => s + Number(p.amount), 0);
    const totalOutstanding = invoices.filter((i) => !["paid", "void", "draft"].includes(i.status))
      .reduce((s, inv) => s + Number(inv.balance_due), 0);
    return { totalTax, totalRevenue, totalCollected, totalOutstanding };
  }, [invoices, payments]);

  const downloadCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csv = [headers.join(","), ...data.map((row) => headers.map((h) => JSON.stringify(row[h] ?? "")).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${filename}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-6">Loading reports...</div>;

  return (
    <div className="p-6 space-y-6">
      <SEO title="Reports" description="Financial insights and analytics: receivables aging, sales by client, tax summary and more." path="/reports" />
      <PageHeader title="Reports" description="Financial insights and analytics for your business" />

      <div className="flex items-center gap-3">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="3">Last 3 months</SelectItem>
            <SelectItem value="6">Last 6 months</SelectItem>
            <SelectItem value="12">Last 12 months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div><p className="text-sm text-muted-foreground">Total Revenue</p><p className="text-xl font-bold">{fmt(taxSummary.totalRevenue)}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div><p className="text-sm text-muted-foreground">Collected</p><p className="text-xl font-bold">{fmt(taxSummary.totalCollected)}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div><p className="text-sm text-muted-foreground">Outstanding</p><p className="text-xl font-bold">{fmt(taxSummary.totalOutstanding)}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-info" />
              </div>
              <div><p className="text-sm text-muted-foreground">Tax Collected</p><p className="text-xl font-bold">{fmt(taxSummary.totalTax)}</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="revenue">
        <TabsList>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="aging">Aging</TabsTrigger>
          <TabsTrigger value="clients">Top Clients</TabsTrigger>
          <TabsTrigger value="status">Invoice Status</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Revenue vs Invoiced</CardTitle>
              <Button variant="outline" size="sm" onClick={() => downloadCSV(revenueData, "revenue-report")}>
                <Download className="mr-1 h-4 w-4" /> Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs fill-muted-foreground" />
                  <YAxis className="text-xs fill-muted-foreground" tickFormatter={(v) => fmt(v)} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="invoiced" name="Invoiced" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="revenue" name="Collected" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aging" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Accounts Receivable Aging</CardTitle>
              <Button variant="outline" size="sm" onClick={() => downloadCSV(agingData, "aging-report")}>
                <Download className="mr-1 h-4 w-4" /> Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={agingData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="bucket" className="text-xs fill-muted-foreground" />
                  <YAxis className="text-xs fill-muted-foreground" tickFormatter={(v) => fmt(v)} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="amount" name="Outstanding" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <Table className="mt-4">
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-center">Invoices</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agingData.map((row) => (
                    <TableRow key={row.bucket}>
                      <TableCell>{row.bucket}</TableCell>
                      <TableCell className="text-center">{row.count}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(row.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clients" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Top Clients by Revenue</CardTitle>
              <Button variant="outline" size="sm" onClick={() => downloadCSV(topClients, "top-clients")}>
                <Download className="mr-1 h-4 w-4" /> Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-center">Invoices</TableHead>
                    <TableHead className="text-right">Total Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topClients.map((cl, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{i + 1}</TableCell>
                      <TableCell>{cl.name}</TableCell>
                      <TableCell className="text-center">{cl.count}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(cl.total)}</TableCell>
                    </TableRow>
                  ))}
                  {topClients.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No data available</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Invoice Status Distribution</CardTitle></CardHeader>
            <CardContent>
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={80} outerRadius={130}
                      dataKey="value" nameKey="name" label={({ name, value }) => `${name}: ${value}`}>
                      {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-12">No invoices yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
