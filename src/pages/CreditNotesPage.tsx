import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageActionBar } from "@/components/shared/PageActionBar";
import { SummaryRibbon } from "@/components/shared/SummaryRibbon";
import { AnalyticsGrid } from "@/components/shared/AnalyticsGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, FileText, Search, Download } from "lucide-react";
import { downloadCSV } from "@/lib/export-csv";
import { format, parseISO } from "date-fns";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const PIE_COLORS = ["hsl(201, 96%, 42%)", "hsl(142, 71%, 45%)", "hsl(32, 95%, 44%)", "hsl(0, 72%, 51%)", "hsl(262, 83%, 58%)", "hsl(215, 16%, 47%)"];

export default function CreditNotesPage() {
  const navigate = useNavigate();
  const org = useAppStore((s) => s.organization);
  const [creditNotes, setCreditNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!org?.id) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("credit_notes")
        .select("*, clients(display_name)")
        .eq("org_id", org.id)
        .order("created_at", { ascending: false });
      setCreditNotes(data || []);
      setLoading(false);
    };
    fetch();
  }, [org?.id]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);

  const summary = useMemo(() => {
    const total = creditNotes.reduce((s, c) => s + Number(c.total || 0), 0);
    const open = creditNotes.filter(c => c.status === "open" || c.status === "draft");
    const openValue = open.reduce((s, c) => s + Number(c.total || 0), 0);
    const closed = creditNotes.filter(c => c.status === "closed" || c.status === "applied");
    const closedValue = closed.reduce((s, c) => s + Number(c.total || 0), 0);
    return { total, openValue, closedValue, count: creditNotes.length };
  }, [creditNotes]);

  const statusBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    creditNotes.forEach(c => { map[c.status || "draft"] = (map[c.status || "draft"] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
  }, [creditNotes]);

  const monthlyTrend = useMemo(() => {
    const map: Record<string, number> = {};
    creditNotes.forEach(c => {
      if (!c.issue_date) return;
      const k = c.issue_date.slice(0, 7);
      map[k] = (map[k] || 0) + Number(c.total || 0);
    });
    const out: { month: string; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      out.push({ month: d.toLocaleString("default", { month: "short", year: "2-digit" }), amount: map[key] || 0 });
    }
    return out;
  }, [creditNotes]);

  const topClients = useMemo(() => {
    const map: Record<string, number> = {};
    creditNotes.forEach(c => {
      const n = c.clients?.display_name || "Unknown";
      map[n] = (map[n] || 0) + Number(c.total || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value).slice(0, 5);
  }, [creditNotes]);

  const valueBuckets = useMemo(() => {
    const b: Record<string, number> = { "<1k": 0, "1k-5k": 0, "5k-25k": 0, "25k+": 0 };
    creditNotes.forEach(c => {
      const v = Number(c.total || 0);
      if (v < 1000) b["<1k"]++;
      else if (v < 5000) b["1k-5k"]++;
      else if (v < 25000) b["5k-25k"]++;
      else b["25k+"]++;
    });
    return Object.entries(b).map(([range, count]) => ({ range, count }));
  }, [creditNotes]);

  const visible = creditNotes.filter(c =>
    [c.credit_note_number, c.clients?.display_name].filter(Boolean)
      .some((f: string) => f.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-6">
      <PageActionBar title="Credit Notes">
        <Button variant="outline" size="sm" onClick={() => {
          downloadCSV(creditNotes.map(c => ({
            credit_note_number: c.credit_note_number,
            client: c.clients?.display_name || "",
            issue_date: c.issue_date,
            status: c.status,
            total: c.total,
          })), "credit_notes");
        }}>
          <Download className="mr-1 h-4 w-4" /> Export
        </Button>
        <Button size="sm" onClick={() => navigate("/credit-notes/new")}>
          <Plus className="mr-1 h-4 w-4" /> New Credit Note
        </Button>
      </PageActionBar>

      <SummaryRibbon
        label="Credit Notes Summary"
        items={[
          { label: "Total Credit Issued", value: fmt(summary.total), accent: "info" },
          { label: "Open Balance", value: fmt(summary.openValue), accent: "warning" },
          { label: "Applied / Closed", value: fmt(summary.closedValue), accent: "success" },
          { label: "Total Notes", value: summary.count, accent: "default" },
        ]}
      />

      {creditNotes.length > 0 && (
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
              title: "Monthly Credit Issued",
              body: (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={monthlyTrend} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                    <Tooltip contentStyle={{ borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} formatter={(v: number) => fmt(v)} />
                    <Line type="monotone" dataKey="amount" stroke="hsl(0, 72%, 51%)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ),
            },
            {
              title: "Top Clients (Credit)",
              body: (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={topClients} layout="vertical" barSize={14} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" width={70} />
                    <Tooltip contentStyle={{ borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="value" fill="hsl(262, 83%, 58%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ),
            },
            {
              title: "Value Distribution",
              body: (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={valueBuckets} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="range" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                    <Bar dataKey="count" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ),
            },
          ]}
        />
      )}

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <h2 className="text-base font-semibold">All Credit Notes</h2>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 h-9" placeholder="Search credit notes..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No credit notes yet"
              description="Issue credit notes against invoices"
              actionLabel="New Credit Note"
              onAction={() => navigate("/credit-notes/new")}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs uppercase font-semibold text-muted-foreground">Credit Note #</TableHead>
                  <TableHead className="text-xs uppercase font-semibold text-muted-foreground">Client</TableHead>
                  <TableHead className="text-xs uppercase font-semibold text-muted-foreground">Date</TableHead>
                  <TableHead className="text-xs uppercase font-semibold text-muted-foreground">Status</TableHead>
                  <TableHead className="text-xs uppercase font-semibold text-muted-foreground text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((cn) => (
                  <TableRow key={cn.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/credit-notes/${cn.id}`)}>
                    <TableCell className="font-medium text-primary text-sm">{cn.credit_note_number}</TableCell>
                    <TableCell className="text-sm">{cn.clients?.display_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{cn.issue_date ? format(parseISO(cn.issue_date), "dd/MM/yyyy") : "-"}</TableCell>
                    <TableCell><StatusBadge status={cn.status} /></TableCell>
                    <TableCell className="text-right font-medium text-sm">{fmt(Number(cn.total))}</TableCell>
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
