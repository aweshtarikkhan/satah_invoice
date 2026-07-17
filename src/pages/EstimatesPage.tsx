import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { ImportDialog } from "@/components/shared/ImportDialog";
import { PageActionBar } from "@/components/shared/PageActionBar";
import { SummaryRibbon } from "@/components/shared/SummaryRibbon";
import { AnalyticsGrid } from "@/components/shared/AnalyticsGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, MoreHorizontal, FileText, ArrowRightLeft, Trash2, Upload, Download } from "lucide-react";
import { downloadCSV } from "@/lib/export-csv";
import { format, parseISO, differenceInDays } from "date-fns";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

type EstimateStatus = "draft" | "sent" | "viewed" | "accepted" | "declined" | "expired" | "converted";

const statusMap: Record<EstimateStatus, { label: string; variant: "default" | "info" | "success" | "warning" | "danger" | "muted" }> = {
  draft: { label: "Draft", variant: "muted" },
  sent: { label: "Sent", variant: "info" },
  viewed: { label: "Viewed", variant: "default" },
  accepted: { label: "Accepted", variant: "success" },
  declined: { label: "Declined", variant: "danger" },
  expired: { label: "Expired", variant: "warning" },
  converted: { label: "Converted", variant: "success" },
};

const PIE_COLORS = ["hsl(201, 96%, 42%)", "hsl(142, 71%, 45%)", "hsl(32, 95%, 44%)", "hsl(0, 72%, 51%)", "hsl(262, 83%, 58%)", "hsl(215, 16%, 47%)", "hsl(186, 80%, 40%)"];

export default function EstimatesPage() {
  const navigate = useNavigate();
  const org = useAppStore((s) => s.organization);
  const { toast } = useToast();
  const [estimates, setEstimates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [importOpen, setImportOpen] = useState(false);

  const fetchEstimates = async () => {
    if (!org?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("estimates")
      .select("*, clients(display_name)")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false });
    setEstimates(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchEstimates(); }, [org?.id]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);

  const visible = estimates
    .filter((e) => tab === "all" || e.status === tab)
    .filter((e) =>
      [e.estimate_number, e.clients?.display_name].filter(Boolean)
        .some((f: string) => f.toLowerCase().includes(search.toLowerCase()))
    );

  // Summary
  const summary = useMemo(() => {
    const totalValue = estimates.reduce((s, e) => s + Number(e.total || 0), 0);
    const accepted = estimates.filter((e) => e.status === "accepted" || e.status === "converted");
    const acceptedValue = accepted.reduce((s, e) => s + Number(e.total || 0), 0);
    const pending = estimates.filter((e) => ["draft", "sent", "viewed"].includes(e.status));
    const pendingValue = pending.reduce((s, e) => s + Number(e.total || 0), 0);
    const conversionRate = estimates.length > 0
      ? Math.round((accepted.length / estimates.length) * 100)
      : 0;
    return { totalValue, acceptedValue, pendingValue, conversionRate };
  }, [estimates]);

  // Charts
  const statusBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    estimates.forEach((e) => { map[e.status] = (map[e.status] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1), value,
    }));
  }, [estimates]);

  const monthlyTrend = useMemo(() => {
    const map: Record<string, number> = {};
    estimates.forEach((e) => {
      if (!e.issue_date) return;
      const k = e.issue_date.slice(0, 7);
      map[k] = (map[k] || 0) + Number(e.total || 0);
    });
    const out: { month: string; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      out.push({ month: d.toLocaleString("default", { month: "short", year: "2-digit" }), amount: map[key] || 0 });
    }
    return out;
  }, [estimates]);

  const topClients = useMemo(() => {
    const map: Record<string, number> = {};
    estimates.forEach((e) => {
      const n = e.clients?.display_name || "Unknown";
      map[n] = (map[n] || 0) + Number(e.total || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value).slice(0, 5);
  }, [estimates]);

  const expiryBuckets = useMemo(() => {
    const today = new Date();
    const b: Record<string, number> = { "Expired": 0, "0-7 days": 0, "8-30 days": 0, "30+ days": 0 };
    estimates.forEach((e) => {
      if (!["draft", "sent", "viewed"].includes(e.status) || !e.expiry_date) return;
      const d = differenceInDays(parseISO(e.expiry_date), today);
      const v = Number(e.total || 0);
      if (d < 0) b["Expired"] += v;
      else if (d <= 7) b["0-7 days"] += v;
      else if (d <= 30) b["8-30 days"] += v;
      else b["30+ days"] += v;
    });
    return Object.entries(b).map(([range, amount]) => ({ range, amount }));
  }, [estimates]);

  const handleDelete = async (id: string) => {
    await supabase.from("estimates").delete().eq("id", id);
    toast({ title: "Estimate deleted" });
    fetchEstimates();
  };

  const handleConvert = (id: string) => navigate(`/estimates/${id}/convert`);

  return (
    <div className="p-6 space-y-6">
      <PageActionBar title="Estimates">
        <Button variant="outline" size="sm" onClick={() => {
          downloadCSV(estimates.map(e => ({
            estimate_number: e.estimate_number,
            client: e.clients?.display_name || "",
            issue_date: e.issue_date,
            expiry_date: e.expiry_date,
            total: e.total,
            status: e.status,
          })), "estimates");
        }}>
          <Download className="mr-1 h-4 w-4" /> Export
        </Button>
        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
          <Upload className="mr-1 h-4 w-4" /> Import
        </Button>
        <Button size="sm" onClick={() => navigate("/estimates/new")}>
          <Plus className="mr-1 h-4 w-4" /> New Estimate
        </Button>
      </PageActionBar>

      <SummaryRibbon
        label="Estimate Summary"
        items={[
          { label: "Total Value", value: fmt(summary.totalValue), accent: "info" },
          { label: "Accepted / Converted", value: fmt(summary.acceptedValue), accent: "success" },
          { label: "Pending Decision", value: fmt(summary.pendingValue), accent: "warning" },
          { label: "Conversion Rate", value: `${summary.conversionRate}%`, accent: "default" },
        ]}
      />

      {estimates.length > 0 && (
        <AnalyticsGrid
          cards={[
            {
              title: "Status Breakdown",
              body: (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={statusBreakdown} cx="50%" cy="50%" innerRadius={42} outerRadius={75} paddingAngle={3} dataKey="value">
                      {statusBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                  </PieChart>
                </ResponsiveContainer>
              ),
            },
            {
              title: "Monthly Quoted Value",
              body: (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={monthlyTrend} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                    <Tooltip contentStyle={{ borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} formatter={(v: number) => fmt(v)} />
                    <Line type="monotone" dataKey="amount" stroke="hsl(201, 96%, 42%)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ),
            },
            {
              title: "Top Clients by Value",
              body: (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={topClients} layout="vertical" barSize={14} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" width={70} />
                    <Tooltip contentStyle={{ borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="value" fill="hsl(142, 71%, 45%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ),
            },
            {
              title: "Expiry Window (Open)",
              body: (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={expiryBuckets} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="range" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
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

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="sent">Sent</TabsTrigger>
            <TabsTrigger value="accepted">Accepted</TabsTrigger>
            <TabsTrigger value="declined">Declined</TabsTrigger>
            <TabsTrigger value="converted">Converted</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 h-9" placeholder="Search estimates..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {!loading && visible.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No estimates yet"
              description="Create your first estimate to get started."
              actionLabel="New Estimate"
              onAction={() => navigate("/estimates/new")}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs uppercase font-semibold text-muted-foreground">Date</TableHead>
                  <TableHead className="text-xs uppercase font-semibold text-muted-foreground">Estimate #</TableHead>
                  <TableHead className="text-xs uppercase font-semibold text-muted-foreground">Client</TableHead>
                  <TableHead className="text-xs uppercase font-semibold text-muted-foreground">Expiry</TableHead>
                  <TableHead className="text-xs uppercase font-semibold text-muted-foreground text-right">Amount</TableHead>
                  <TableHead className="text-xs uppercase font-semibold text-muted-foreground">Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((est) => {
                  const s = statusMap[est.status as EstimateStatus] || statusMap.draft;
                  return (
                    <TableRow key={est.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/estimates/${est.id}`)}>
                      <TableCell className="text-sm text-muted-foreground">{est.issue_date ? format(parseISO(est.issue_date), "dd/MM/yyyy") : "-"}</TableCell>
                      <TableCell className="font-medium text-primary text-sm">{est.estimate_number}</TableCell>
                      <TableCell className="text-sm">{est.clients?.display_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{est.expiry_date ? format(parseISO(est.expiry_date), "dd/MM/yyyy") : "-"}</TableCell>
                      <TableCell className="text-right font-medium text-sm">{fmt(Number(est.total))}</TableCell>
                      <TableCell><StatusBadge status={est.status}>{s.label}</StatusBadge></TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/estimates/${est.id}/edit`)}>
                              <FileText className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            {(est.status === "accepted" || est.status === "sent" || est.status === "draft") && est.status !== "converted" && (
                              <DropdownMenuItem onClick={() => handleConvert(est.id)}>
                                <ArrowRightLeft className="mr-2 h-4 w-4" /> Convert to Invoice
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(est.id)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        fields={[
          { key: "estimate_number", label: "Estimate #", required: true },
          { key: "client_name", label: "Client Name", required: true },
          { key: "issue_date", label: "Issue Date" },
          { key: "expiry_date", label: "Expiry Date" },
          { key: "total", label: "Total Amount" },
          { key: "notes", label: "Notes" },
        ]}
        entityName="Estimates"
        onImport={async (rows) => {
          let success = 0, errors = 0;
          const { data: clients } = await supabase.from("clients").select("id, display_name").eq("org_id", org!.id);
          for (const row of rows) {
            const client = clients?.find((c) => c.display_name.toLowerCase() === (row.client_name || "").toLowerCase());
            if (!client) { errors++; continue; }
            const { error } = await supabase.from("estimates").insert({
              org_id: org!.id,
              client_id: client.id,
              estimate_number: row.estimate_number,
              issue_date: row.issue_date || new Date().toISOString().split("T")[0],
              expiry_date: row.expiry_date || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
              total: parseFloat(row.total) || 0,
              notes: row.notes || null,
              currency_code: org!.currency_code,
            });
            if (error) errors++; else success++;
          }
          fetchEstimates();
          return { success, errors };
        }}
      />
    </div>
  );
}
