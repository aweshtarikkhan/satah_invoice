import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, DollarSign, FileText, CreditCard, TrendingUp, AlertTriangle, CheckCircle2, Clock,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const org = useAppStore((s) => s.organization);

  const [client, setClient] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !org?.id) return;
    const load = async () => {
      setLoading(true);
      const [{ data: cl }, { data: inv }, { data: pay }] = await Promise.all([
        supabase.from("clients").select("*").eq("id", id).single(),
        supabase.from("invoices").select("*").eq("client_id", id).eq("org_id", org.id).order("issue_date", { ascending: false }),
        supabase.from("payments").select("*").eq("client_id", id).eq("org_id", org.id).order("payment_date", { ascending: false }),
      ]);
      setClient(cl);
      setInvoices(inv || []);
      setPayments(pay || []);
      setLoading(false);
    };
    load();
  }, [id, org?.id]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: org?.currency_code || "USD" }).format(n);

  // Analytics
  const totalBilled = useMemo(() => invoices.filter(i => i.status !== "void").reduce((s, i) => s + Number(i.total), 0), [invoices]);
  const totalPaid = useMemo(() => payments.reduce((s, p) => s + Number(p.amount), 0), [payments]);
  const totalDue = useMemo(() => invoices.filter(i => i.status !== "void").reduce((s, i) => s + Number(i.balance_due), 0), [invoices]);
  const overdueAmount = useMemo(() => {
    const today = new Date();
    return invoices.filter(i => i.status !== "void" && i.status !== "paid" && new Date(i.due_date) < today)
      .reduce((s, i) => s + Number(i.balance_due), 0);
  }, [invoices]);
  const invoiceCount = invoices.filter(i => i.status !== "void").length;
  const paidCount = invoices.filter(i => i.status === "paid").length;

  // Monthly revenue chart
  const monthlyData = useMemo(() => {
    const map: Record<string, { billed: number; paid: number }> = {};
    invoices.filter(i => i.status !== "void").forEach((inv) => {
      const m = (inv.issue_date || "").slice(0, 7);
      if (!map[m]) map[m] = { billed: 0, paid: 0 };
      map[m].billed += Number(inv.total);
    });
    payments.forEach((p) => {
      const m = (p.payment_date || "").slice(0, 7);
      if (!map[m]) map[m] = { billed: 0, paid: 0 };
      map[m].paid += Number(p.amount);
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, vals]) => ({
        month: new Date(month + "-01").toLocaleString("default", { month: "short", year: "2-digit" }),
        ...vals,
      }));
  }, [invoices, payments]);

  // Invoice status pie
  const statusData = useMemo(() => {
    const map: Record<string, number> = {};
    invoices.forEach((inv) => {
      const s = inv.status;
      map[s] = (map[s] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
  }, [invoices]);

  // Payment mode breakdown
  const modeData = useMemo(() => {
    const map: Record<string, number> = {};
    payments.forEach((p) => {
      const mode = (p.payment_mode || "other").replace(/_/g, " ");
      map[mode] = (map[mode] || 0) + Number(p.amount);
    });
    return Object.entries(map).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1), value,
    }));
  }, [payments]);

  const PIE_COLORS = [
    "hsl(201, 96%, 32%)", "hsl(142, 71%, 45%)", "hsl(32, 95%, 44%)",
    "hsl(0, 72%, 51%)", "hsl(262, 83%, 58%)", "hsl(215, 16%, 47%)",
  ];

  if (loading || !client) {
    return <div className="p-6 text-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={client.display_name} description={client.company_name || client.email || ""}>
        <Button variant="outline" size="sm" onClick={() => navigate("/clients")}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <Button size="sm" onClick={() => navigate(`/invoices/new`)}>
          <FileText className="mr-1 h-4 w-4" /> New Invoice
        </Button>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Billed</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{fmt(totalBilled)}</div>
            <p className="text-xs text-muted-foreground mt-1">{invoiceCount} invoices</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Received</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{fmt(totalPaid)}</div>
            <p className="text-xs text-muted-foreground mt-1">{paidCount} paid invoices</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Balance Due</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{fmt(totalDue)}</div>
            <p className="text-xs text-muted-foreground mt-1">{invoices.filter(i => Number(i.balance_due) > 0 && i.status !== "void").length} unpaid</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{fmt(overdueAmount)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Billed vs Paid */}
        {monthlyData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Billed vs Received</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                  <Tooltip contentStyle={{ borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--card-foreground))" }} formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="billed" name="Billed" fill="hsl(201, 96%, 32%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="paid" name="Received" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Invoice Status Pie */}
        {statusData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Invoice Status</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {statusData.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--card-foreground))" }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Payment Mode */}
        {modeData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Payment Modes</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={modeData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {modeData.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[(idx + 2) % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--card-foreground))" }} formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Payment Timeline */}
        {payments.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Payment Timeline</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={(() => {
                  const map: Record<string, number> = {};
                  payments.forEach((p) => {
                    const m = (p.payment_date || "").slice(0, 7);
                    map[m] = (map[m] || 0) + Number(p.amount);
                  });
                  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-12)
                    .map(([m, amount]) => ({ month: new Date(m + "-01").toLocaleString("default", { month: "short", year: "2-digit" }), amount }));
                })()}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                  <Tooltip contentStyle={{ borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--card-foreground))" }} formatter={(v: number) => fmt(v)} />
                  <Area type="monotone" dataKey="amount" name="Payment" stroke="hsl(142, 71%, 45%)" fill="hsl(142, 71%, 45%, 0.15)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Invoices & Payments Tabs */}
      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">Invoices ({invoices.length})</TabsTrigger>
          <TabsTrigger value="payments">Payments ({payments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          <Card>
            <CardContent className="p-0">
              {invoices.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No invoices found for this client.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv) => {
                      const isOverdue = inv.status !== "paid" && inv.status !== "void" && new Date(inv.due_date) < new Date();
                      return (
                        <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/invoices/${inv.id}`)}>
                          <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                          <TableCell>{inv.issue_date}</TableCell>
                          <TableCell className={isOverdue ? "text-red-600 dark:text-red-400 font-medium" : ""}>{inv.due_date}</TableCell>
                          <TableCell><StatusBadge status={inv.status} /></TableCell>
                          <TableCell className="text-right">{fmt(Number(inv.total))}</TableCell>
                          <TableCell className="text-right text-emerald-600 dark:text-emerald-400">{fmt(Number(inv.amount_paid))}</TableCell>
                          <TableCell className={`text-right font-semibold ${Number(inv.balance_due) > 0 ? (isOverdue ? "text-red-600 dark:text-red-400" : "text-orange-600 dark:text-orange-400") : "text-emerald-600 dark:text-emerald-400"}`}>
                            {fmt(Number(inv.balance_due))}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardContent className="p-0">
              {payments.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No payments received from this client yet.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.payment_number}</TableCell>
                        <TableCell>{p.payment_date}</TableCell>
                        <TableCell className="capitalize">{(p.payment_mode || "").replace(/_/g, " ")}</TableCell>
                        <TableCell>{p.reference_number || "—"}</TableCell>
                        <TableCell className="text-right text-emerald-600 dark:text-emerald-400 font-semibold">{fmt(Number(p.amount))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
