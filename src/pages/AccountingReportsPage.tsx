import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/currency";
import { format, startOfYear, endOfYear } from "date-fns";

interface AcctSum { id: string; code: string; name: string; type: string; debit: number; credit: number; balance: number; }

export default function AccountingReportsPage() {
  const org = useAppStore((s) => s.organization);
  const [from, setFrom] = useState(format(startOfYear(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(endOfYear(new Date()), "yyyy-MM-dd"));
  const [data, setData] = useState<AcctSum[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!org?.id) return;
    (async () => {
      setLoading(true);
      const { data: accts } = await (supabase as any).from("accounts").select("id,code,name,type").eq("org_id", org.id);
      const { data: lines } = await (supabase as any)
        .from("journal_lines")
        .select("account_id, debit, credit, journal_entries!inner(entry_date)")
        .eq("org_id", org.id)
        .gte("journal_entries.entry_date", from)
        .lte("journal_entries.entry_date", to);
      const map: Record<string, AcctSum> = {};
      (accts || []).forEach((a: any) => {
        map[a.id] = { ...a, debit: 0, credit: 0, balance: 0 };
      });
      (lines || []).forEach((l: any) => {
        const a = map[l.account_id]; if (!a) return;
        a.debit += Number(l.debit) || 0;
        a.credit += Number(l.credit) || 0;
      });
      // Balance sign: asset/expense = debit - credit; liability/equity/income = credit - debit
      Object.values(map).forEach(a => {
        if (a.type === "asset" || a.type === "expense") a.balance = a.debit - a.credit;
        else a.balance = a.credit - a.debit;
      });
      setData(Object.values(map).sort((a, b) => a.code.localeCompare(b.code)));
      setLoading(false);
    })();
  }, [org?.id, from, to]);

  const byType = useMemo(() => {
    const groups: Record<string, AcctSum[]> = { asset: [], liability: [], equity: [], income: [], expense: [] };
    data.forEach(a => { groups[a.type]?.push(a); });
    return groups;
  }, [data]);

  const sum = (arr: AcctSum[]) => arr.reduce((s, a) => s + a.balance, 0);
  const totalAssets = sum(byType.asset);
  const totalLiab = sum(byType.liability);
  const totalEq = sum(byType.equity);
  const totalIncome = sum(byType.income);
  const totalExpense = sum(byType.expense);
  const netProfit = totalIncome - totalExpense;
  const totalLiabEq = totalLiab + totalEq + netProfit;

  const totalDebit = data.reduce((s, a) => s + a.debit, 0);
  const totalCredit = data.reduce((s, a) => s + a.credit, 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Accounting Reports</h1>

      <Card>
        <CardContent className="pt-5 flex items-end gap-3">
          <div><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Tabs defaultValue="trial">
        <TabsList>
          <TabsTrigger value="trial">Trial Balance</TabsTrigger>
          <TabsTrigger value="balance">Balance Sheet</TabsTrigger>
          <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
        </TabsList>

        <TabsContent value="trial">
          <Card>
            <CardHeader><CardTitle className="text-base">Trial Balance</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Account</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.filter(a => a.debit > 0 || a.credit > 0).map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono">{a.code}</TableCell>
                      <TableCell>{a.name}</TableCell>
                      <TableCell className="capitalize text-xs text-muted-foreground">{a.type}</TableCell>
                      <TableCell className="text-right">{a.debit > 0 ? formatCurrency(a.debit) : "—"}</TableCell>
                      <TableCell className="text-right">{a.credit > 0 ? formatCurrency(a.credit) : "—"}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold border-t-2">
                    <TableCell colSpan={3}>Total</TableCell>
                    <TableCell className="text-right">{formatCurrency(totalDebit)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totalCredit)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              {Math.abs(totalDebit - totalCredit) > 0.01 && (
                <div className="mt-2 text-sm text-destructive">⚠ Out of balance by {formatCurrency(Math.abs(totalDebit - totalCredit))}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balance">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Assets</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    {byType.asset.filter(a => a.balance !== 0).map(a => (
                      <TableRow key={a.id}><TableCell>{a.name}</TableCell><TableCell className="text-right">{formatCurrency(a.balance)}</TableCell></TableRow>
                    ))}
                    <TableRow className="font-semibold border-t-2"><TableCell>Total Assets</TableCell><TableCell className="text-right">{formatCurrency(totalAssets)}</TableCell></TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Liabilities & Equity</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    {byType.liability.filter(a => a.balance !== 0).map(a => (
                      <TableRow key={a.id}><TableCell>{a.name}</TableCell><TableCell className="text-right">{formatCurrency(a.balance)}</TableCell></TableRow>
                    ))}
                    <TableRow className="font-medium"><TableCell>Total Liabilities</TableCell><TableCell className="text-right">{formatCurrency(totalLiab)}</TableCell></TableRow>
                    {byType.equity.filter(a => a.balance !== 0).map(a => (
                      <TableRow key={a.id}><TableCell>{a.name}</TableCell><TableCell className="text-right">{formatCurrency(a.balance)}</TableCell></TableRow>
                    ))}
                    <TableRow><TableCell>Net Profit (period)</TableCell><TableCell className="text-right">{formatCurrency(netProfit)}</TableCell></TableRow>
                    <TableRow className="font-semibold border-t-2"><TableCell>Total Liabilities + Equity</TableCell><TableCell className="text-right">{formatCurrency(totalLiabEq)}</TableCell></TableRow>
                  </TableBody>
                </Table>
                {Math.abs(totalAssets - totalLiabEq) > 0.01 && (
                  <div className="mt-2 text-xs text-amber-600">Difference: {formatCurrency(totalAssets - totalLiabEq)}</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cashflow">
          <Card>
            <CardHeader><CardTitle className="text-base">Cash Flow (simplified)</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  {data.filter(a => a.code === "1000" || a.code === "1010").map(a => (
                    <TableRow key={a.id}>
                      <TableCell>{a.name}</TableCell>
                      <TableCell className="text-right text-emerald-600">In: {formatCurrency(a.debit)}</TableCell>
                      <TableCell className="text-right text-rose-600">Out: {formatCurrency(a.credit)}</TableCell>
                      <TableCell className="text-right font-semibold">Net: {formatCurrency(a.balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground mt-3">Computed from Cash (1000) and Bank Account (1010) movements posted to the ledger.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {loading && <div className="text-center py-4 text-muted-foreground text-sm">Loading…</div>}
    </div>
  );
}
