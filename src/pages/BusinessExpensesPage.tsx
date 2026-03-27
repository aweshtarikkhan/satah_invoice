import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, TrendingUp, TrendingDown, Wallet, IndianRupee } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

const CATEGORIES = [
  "Salary", "Rent", "Electricity", "Internet", "Office Supplies",
  "Software/Subscriptions", "Transportation", "Insurance", "Maintenance",
  "Marketing", "Legal/Accounting", "Taxes & Fees", "Miscellaneous",
];

const CHART_COLORS = [
  "hsl(var(--primary))", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1", "#14b8a6", "#e11d48", "#a3a3a3",
];

interface Expense {
  id: string;
  org_id: string;
  category: string;
  description: string | null;
  amount: number;
  expense_date: string;
  is_recurring: boolean;
  recurring_frequency: string | null;
  created_at: string;
}

const emptyForm = {
  category: "", description: "", amount: "", expense_date: format(new Date(), "yyyy-MM-dd"),
  is_recurring: false, recurring_frequency: "monthly",
};

export default function BusinessExpensesPage() {
  const org = useAppStore((s) => s.organization);
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [period, setPeriod] = useState("current");
  const [loading, setLoading] = useState(true);

  const dateRange = useMemo(() => {
    const now = new Date();
    if (period === "current") return { from: startOfMonth(now), to: endOfMonth(now) };
    if (period === "last") return { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) };
    if (period === "3months") return { from: startOfMonth(subMonths(now, 2)), to: endOfMonth(now) };
    if (period === "6months") return { from: startOfMonth(subMonths(now, 5)), to: endOfMonth(now) };
    return { from: startOfMonth(subMonths(now, 11)), to: endOfMonth(now) };
  }, [period]);

  const fetchExpenses = async () => {
    if (!org?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("business_expenses")
      .select("*")
      .eq("org_id", org.id)
      .gte("expense_date", format(dateRange.from, "yyyy-MM-dd"))
      .lte("expense_date", format(dateRange.to, "yyyy-MM-dd"))
      .order("expense_date", { ascending: false });
    setExpenses((data as Expense[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchExpenses(); }, [org?.id, dateRange]);

  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount), 0), [expenses]);
  const recurringTotal = useMemo(() => expenses.filter((e) => e.is_recurring).reduce((s, e) => s + Number(e.amount), 0), [expenses]);

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e) => { map[e.category] = (map[e.category] || 0) + Number(e.amount); });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [expenses]);

  const monthlyData = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e) => {
      const m = format(new Date(e.expense_date), "MMM yyyy");
      map[m] = (map[m] || 0) + Number(e.amount);
    });
    return Object.entries(map).map(([month, total]) => ({ month, total }));
  }, [expenses]);

  const saveExpense = async () => {
    if (!form.category || !form.amount) return;
    const payload = {
      org_id: org!.id,
      category: form.category,
      description: form.description || null,
      amount: parseFloat(form.amount),
      expense_date: form.expense_date,
      is_recurring: form.is_recurring,
      recurring_frequency: form.is_recurring ? form.recurring_frequency : null,
    };

    const { error } = editId
      ? await supabase.from("business_expenses").update(payload).eq("id", editId)
      : await supabase.from("business_expenses").insert(payload);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setDialogOpen(false);
      setEditId(null);
      setForm(emptyForm);
      fetchExpenses();
      toast({ title: editId ? "Expense updated!" : "Expense added!" });
    }
  };

  const deleteExpense = async (id: string) => {
    await supabase.from("business_expenses").delete().eq("id", id);
    fetchExpenses();
    toast({ title: "Expense deleted" });
  };

  const openEdit = (e: Expense) => {
    setEditId(e.id);
    setForm({
      category: e.category,
      description: e.description || "",
      amount: String(e.amount),
      expense_date: e.expense_date,
      is_recurring: e.is_recurring,
      recurring_frequency: e.recurring_frequency || "monthly",
    });
    setDialogOpen(true);
  };

  const currency = org?.currency_code || "USD";
  const fmt = (n: number) => formatCurrency(n, currency);

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Business Expenses" description="Track your fixed business costs — salary, rent, bills, etc.">
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="current">This Month</SelectItem>
              <SelectItem value="last">Last Month</SelectItem>
              <SelectItem value="3months">3 Months</SelectItem>
              <SelectItem value="6months">6 Months</SelectItem>
              <SelectItem value="year">12 Months</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => { setEditId(null); setForm(emptyForm); setDialogOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Add Expense
          </Button>
        </div>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10"><Wallet className="h-5 w-5 text-destructive" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Total Expenses</p>
              <p className="text-xl font-bold">{fmt(totalExpenses)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10"><TrendingUp className="h-5 w-5 text-amber-500" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Recurring Costs</p>
              <p className="text-xl font-bold">{fmt(recurringTotal)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><TrendingDown className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Categories</p>
              <p className="text-xl font-bold">{categoryData.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Expenses by Category</CardTitle></CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {categoryData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-12">No data</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Monthly Trend</CardTitle></CardHeader>
          <CardContent>
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-12">No data</p>}
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
          ) : expenses.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No expenses found for this period.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Recurring</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm">{format(new Date(e.expense_date), "dd MMM yyyy")}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                        {e.category}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.description || "—"}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(Number(e.amount))}</TableCell>
                    <TableCell className="text-sm">
                      {e.is_recurring ? (
                        <span className="text-amber-600 text-xs font-medium">{e.recurring_frequency}</span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(e)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteExpense(e.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Category Breakdown Table */}
      {categoryData.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Category Breakdown</CardTitle></CardHeader>
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
                {categoryData.map((c) => (
                  <TableRow key={c.name}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-right">{fmt(c.value)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {totalExpenses > 0 ? ((c.value / totalExpenses) * 100).toFixed(1) : 0}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Expense" : "Add Expense"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Office rent for June" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={form.is_recurring} onCheckedChange={(v) => setForm({ ...form, is_recurring: !!v })} />
              <Label>Recurring expense</Label>
            </div>
            {form.is_recurring && (
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select value={form.recurring_frequency} onValueChange={(v) => setForm({ ...form, recurring_frequency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveExpense}>{editId ? "Update" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
