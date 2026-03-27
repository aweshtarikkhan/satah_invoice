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

interface DashboardStats {
  totalReceivable: number;
  overdue: number;
  dueToday: number;
  due30Days: number;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const org = useAppStore((s) => s.organization);
  const [stats, setStats] = useState<DashboardStats>({ totalReceivable: 0, overdue: 0, dueToday: 0, due30Days: 0 });
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);

  useEffect(() => {
    if (!org?.id) return;

    const fetchData = async () => {
      // Fetch invoice stats
      const { data: invoices } = await supabase
        .from("invoices")
        .select("balance_due, status, due_date")
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
