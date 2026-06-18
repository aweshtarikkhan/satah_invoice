import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/currency";
import { format, startOfMonth, addMonths, isWithinInterval } from "date-fns";

export default function CashFlowPage() {
  const org = useAppStore((s) => s.organization);
  const cur = (org as any)?.currency || "INR";
  const [txns, setTxns] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!org?.id) return;
    (async () => {
      setLoading(true);
      const [t, a] = await Promise.all([
        (supabase as any).from("bank_transactions").select("*, bank_accounts(name)").eq("org_id", org.id).order("txn_date"),
        (supabase as any).from("bank_accounts").select("*").eq("org_id", org.id),
      ]);
      setTxns(t.data || []);
      setAccounts(a.data || []);
      setLoading(false);
    })();
  }, [org?.id]);

  // Monthly buckets for last 6 months
  const monthly = useMemo(() => {
    const buckets: { label: string; start: Date; end: Date; inflow: number; outflow: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = startOfMonth(addMonths(new Date(), -i));
      const end = addMonths(start, 1);
      buckets.push({ label: format(start, "MMM yyyy"), start, end, inflow: 0, outflow: 0 });
    }
    txns.forEach(t => {
      const d = new Date(t.txn_date);
      const b = buckets.find(b => isWithinInterval(d, { start: b.start, end: b.end }));
      if (!b) return;
      if (t.direction === "credit") b.inflow += Number(t.amount);
      else b.outflow += Number(t.amount);
    });
    return buckets;
  }, [txns]);

  const totalBalance = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
  const maxBar = Math.max(1, ...monthly.flatMap(m => [m.inflow, m.outflow]));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Cash Flow</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Total Cash & Bank</div><div className="text-2xl font-semibold">{formatCurrency(totalBalance, cur)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Inflow (6m)</div><div className="text-2xl font-semibold text-emerald-600">{formatCurrency(monthly.reduce((s, m) => s + m.inflow, 0), cur)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Outflow (6m)</div><div className="text-2xl font-semibold text-red-600">{formatCurrency(monthly.reduce((s, m) => s + m.outflow, 0), cur)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Net (6m)</div><div className="text-2xl font-semibold">{formatCurrency(monthly.reduce((s, m) => s + m.inflow - m.outflow, 0), cur)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Monthly Cash Flow (last 6 months)</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {monthly.map(m => (
              <div key={m.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{m.label}</span>
                  <span className="text-muted-foreground">Net: <span className={m.inflow - m.outflow >= 0 ? "text-emerald-600" : "text-red-600"}>{formatCurrency(m.inflow - m.outflow, cur)}</span></span>
                </div>
                <div className="flex gap-2 h-6">
                  <div className="bg-emerald-100 rounded relative flex-1">
                    <div className="bg-emerald-500 h-full rounded" style={{ width: `${(m.inflow / maxBar) * 100}%` }} />
                    <span className="absolute inset-0 flex items-center px-2 text-xs">In: {formatCurrency(m.inflow, cur)}</span>
                  </div>
                  <div className="bg-red-100 rounded relative flex-1">
                    <div className="bg-red-500 h-full rounded" style={{ width: `${(m.outflow / maxBar) * 100}%` }} />
                    <span className="absolute inset-0 flex items-center px-2 text-xs">Out: {formatCurrency(m.outflow, cur)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="accounts">
        <TabsList><TabsTrigger value="accounts">By Account</TabsTrigger><TabsTrigger value="recent">Recent Transactions</TabsTrigger></TabsList>
        <TabsContent value="accounts">
          <Card><CardContent className="pt-4">
            <Table>
              <TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
              <TableBody>
                {accounts.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>{a.account_type}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(a.current_balance), cur)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="recent">
          <Card><CardContent className="pt-4">
            {loading ? <div className="py-8 text-center text-muted-foreground">Loading…</div> : (
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Account</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {txns.slice(-50).reverse().map(t => (
                    <TableRow key={t.id}>
                      <TableCell>{format(new Date(t.txn_date), "dd MMM")}</TableCell>
                      <TableCell>{t.bank_accounts?.name}</TableCell>
                      <TableCell className="max-w-md truncate">{t.description || "—"}</TableCell>
                      <TableCell className={`text-right font-medium ${t.direction === "credit" ? "text-emerald-600" : "text-red-600"}`}>{t.direction === "credit" ? "+" : "−"}{formatCurrency(Number(t.amount), cur)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
