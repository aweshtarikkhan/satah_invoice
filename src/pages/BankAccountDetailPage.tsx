import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Upload, Plus, Link2, Trash2, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";
import { format } from "date-fns";

interface ParsedRow {
  txn_date: string;
  description: string;
  amount: number;
  direction: "credit" | "debit";
  reference: string;
  balance_after: number | null;
}

function parseCsv(text: string): ParsedRow[] {
  // Heuristic CSV parser for bank statement / UPI export
  const lines = text.replace(/\r/g, "").split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const split = (l: string) => l.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
  const header = split(lines[0]).map(h => h.toLowerCase());
  const find = (...names: string[]) => {
    for (const n of names) {
      const i = header.findIndex(h => h.includes(n));
      if (i >= 0) return i;
    }
    return -1;
  };
  const dateIdx = find("date", "txn date", "transaction date");
  const descIdx = find("description", "narration", "particulars", "details", "remarks");
  const debitIdx = find("debit", "withdrawal", "amount out");
  const creditIdx = find("credit", "deposit", "amount in");
  const amountIdx = find("amount");
  const refIdx = find("ref", "utr", "txn id", "transaction id", "cheque");
  const balIdx = find("balance", "running balance");

  const parseDate = (s: string): string => {
    if (!s) return new Date().toISOString().slice(0, 10);
    // Try dd/mm/yyyy or dd-mm-yyyy or yyyy-mm-dd
    const m1 = s.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})/);
    if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
    const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m2) return s.slice(0, 10);
    const d = new Date(s);
    return isNaN(+d) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
  };
  const parseNum = (s: string) => Number((s || "0").replace(/[,₹\s]/g, "")) || 0;

  return lines.slice(1).map(l => {
    const c = split(l);
    let amount = 0, direction: "credit" | "debit" = "debit";
    if (debitIdx >= 0 || creditIdx >= 0) {
      const d = parseNum(c[debitIdx] || "0"), cr = parseNum(c[creditIdx] || "0");
      if (cr > 0) { amount = cr; direction = "credit"; }
      else { amount = d; direction = "debit"; }
    } else if (amountIdx >= 0) {
      const v = parseNum(c[amountIdx]);
      amount = Math.abs(v);
      direction = v < 0 ? "debit" : "credit";
    }
    return {
      txn_date: parseDate(c[dateIdx] || ""),
      description: descIdx >= 0 ? c[descIdx] : "",
      amount,
      direction,
      reference: refIdx >= 0 ? c[refIdx] : "",
      balance_after: balIdx >= 0 ? parseNum(c[balIdx]) : null,
    };
  }).filter(r => r.amount > 0);
}

export default function BankAccountDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const org = useAppStore((s) => s.organization);
  const cur = (org as any)?.currency || "INR";
  const { toast } = useToast();
  const [acct, setAcct] = useState<any>(null);
  const [txns, setTxns] = useState<any[]>([]);
  const [unmatched, setUnmatched] = useState<{ payments: any[]; billPayments: any[]; expenses: any[] }>({ payments: [], billPayments: [], expenses: [] });
  const [importOpen, setImportOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [matchOpen, setMatchOpen] = useState<any>(null);
  const [manual, setManual] = useState<any>({ txn_date: format(new Date(), "yyyy-MM-dd"), amount: "", direction: "debit", description: "", reference: "" });

  const load = async () => {
    if (!id) return;
    const { data: a } = await (supabase as any).from("bank_accounts").select("*").eq("id", id).maybeSingle();
    const { data: t } = await (supabase as any).from("bank_transactions").select("*").eq("bank_account_id", id).order("txn_date", { ascending: false });
    setAcct(a); setTxns(t || []);
    if (org?.id) {
      const [p, bp, ex] = await Promise.all([
        (supabase as any).from("payments").select("id,payment_date,amount,reference_number,clients(name)").eq("org_id", org.id).order("payment_date", { ascending: false }).limit(100),
        (supabase as any).from("bill_payments").select("id,payment_date,amount,reference_number,vendors(name)").eq("org_id", org.id).order("payment_date", { ascending: false }).limit(100),
        (supabase as any).from("business_expenses").select("id,expense_date,amount,description").eq("org_id", org.id).order("expense_date", { ascending: false }).limit(100),
      ]);
      setUnmatched({ payments: p.data || [], billPayments: bp.data || [], expenses: ex.data || [] });
    }
  };
  useEffect(() => { load(); }, [id, org?.id]);

  const handleFile = async (f: File) => {
    const text = await f.text();
    const rows = parseCsv(text);
    setParsed(rows);
    if (!rows.length) toast({ title: "No rows found", description: "Could not parse the CSV. Expected columns like Date, Description, Debit/Credit/Amount, Reference, Balance.", variant: "destructive" });
  };

  const doImport = async () => {
    if (!parsed.length || !org?.id || !id) return;
    setImporting(true);
    const payloads = parsed.map(r => ({
      org_id: org.id, bank_account_id: id,
      txn_date: r.txn_date, amount: r.amount, direction: r.direction,
      description: r.description, reference: r.reference || null,
      balance_after: r.balance_after, source: "csv",
    }));
    const { error } = await (supabase as any).from("bank_transactions").insert(payloads);
    if (error) toast({ title: "Import failed", description: error.message, variant: "destructive" });
    else {
      // Update current balance
      const delta = parsed.reduce((s, r) => s + (r.direction === "credit" ? r.amount : -r.amount), 0);
      await (supabase as any).from("bank_accounts").update({ current_balance: Number(acct?.current_balance || 0) + delta }).eq("id", id);
      toast({ title: `Imported ${parsed.length} transactions` });
    }
    setImporting(false); setImportOpen(false); setParsed([]); load();
  };

  const addManual = async () => {
    if (!org?.id || !id || !manual.amount) return;
    const amt = Number(manual.amount);
    await (supabase as any).from("bank_transactions").insert({
      org_id: org.id, bank_account_id: id,
      txn_date: manual.txn_date, amount: amt, direction: manual.direction,
      description: manual.description, reference: manual.reference || null, source: "manual",
    });
    const delta = manual.direction === "credit" ? amt : -amt;
    await (supabase as any).from("bank_accounts").update({ current_balance: Number(acct?.current_balance || 0) + delta }).eq("id", id);
    setManualOpen(false);
    setManual({ txn_date: format(new Date(), "yyyy-MM-dd"), amount: "", direction: "debit", description: "", reference: "" });
    load();
  };

  const removeTxn = async (t: any) => {
    if (!confirm("Delete this transaction?")) return;
    await (supabase as any).from("bank_transactions").delete().eq("id", t.id);
    const delta = t.direction === "credit" ? -Number(t.amount) : Number(t.amount);
    await (supabase as any).from("bank_accounts").update({ current_balance: Number(acct?.current_balance || 0) + delta }).eq("id", id);
    load();
  };

  const linkMatch = async (txn: any, type: string, matchedId: string) => {
    await (supabase as any).from("bank_transactions").update({
      reconciled: true, reconciled_at: new Date().toISOString(),
      matched_type: type, matched_id: matchedId,
    }).eq("id", txn.id);
    toast({ title: "Matched & reconciled" });
    setMatchOpen(null);
    load();
  };

  const markReconciled = async (txn: any) => {
    await (supabase as any).from("bank_transactions").update({
      reconciled: !txn.reconciled,
      reconciled_at: txn.reconciled ? null : new Date().toISOString(),
    }).eq("id", txn.id);
    load();
  };

  const stats = useMemo(() => {
    const reconciled = txns.filter(t => t.reconciled).length;
    const unrec = txns.length - reconciled;
    const credits = txns.filter(t => t.direction === "credit").reduce((s, t) => s + Number(t.amount), 0);
    const debits = txns.filter(t => t.direction === "debit").reduce((s, t) => s + Number(t.amount), 0);
    return { reconciled, unrec, credits, debits };
  }, [txns]);

  // suggest matches: same amount and date ±3 days, not yet matched to another bank txn
  const suggestions = (txn: any) => {
    const pool = txn.direction === "credit"
      ? unmatched.payments.map(p => ({ kind: "payment", id: p.id, label: p.clients?.name || "Payment", date: p.payment_date, amount: Number(p.amount), ref: p.reference_number }))
      : [
          ...unmatched.billPayments.map(p => ({ kind: "bill_payment", id: p.id, label: p.vendors?.name || "Bill Payment", date: p.payment_date, amount: Number(p.amount), ref: p.reference_number })),
          ...unmatched.expenses.map(e => ({ kind: "expense", id: e.id, label: e.description || "Expense", date: e.expense_date, amount: Number(e.amount), ref: "" })),
        ];
    const tDate = +new Date(txn.txn_date);
    return pool
      .map(p => ({ ...p, score: (Math.abs(p.amount - Number(txn.amount)) < 0.01 ? 100 : 0) + (Math.abs(+new Date(p.date) - tDate) < 3 * 86400000 ? 20 : 0) }))
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  };

  if (!acct) return <div className="p-6 text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button size="icon" variant="ghost" onClick={() => navigate("/bank-accounts")}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-semibold">{acct.name}</h1>
            <div className="text-sm text-muted-foreground">{acct.bank_name} {acct.account_number ? `• ${acct.account_number}` : ""}</div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setManualOpen(true)}><Plus className="h-4 w-4 mr-1" />Add</Button>
          <Button onClick={() => setImportOpen(true)}><Upload className="h-4 w-4 mr-1" />Import CSV</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Current Balance</div><div className="text-2xl font-semibold">{formatCurrency(Number(acct.current_balance), cur)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Money In</div><div className="text-2xl font-semibold text-emerald-600">{formatCurrency(stats.credits, cur)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Money Out</div><div className="text-2xl font-semibold text-red-600">{formatCurrency(stats.debits, cur)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Reconciled</div><div className="text-2xl font-semibold">{stats.reconciled} / {txns.length}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="unrec">
        <TabsList>
          <TabsTrigger value="unrec">To Reconcile ({stats.unrec})</TabsTrigger>
          <TabsTrigger value="all">All Transactions</TabsTrigger>
        </TabsList>
        {["unrec", "all"].map(tab => (
          <TabsContent key={tab} value={tab}>
            <Card><CardContent className="pt-4">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead><TableHead>Description</TableHead>
                  <TableHead>Ref</TableHead><TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {txns.filter(t => tab === "all" || !t.reconciled).map(t => (
                    <TableRow key={t.id}>
                      <TableCell>{format(new Date(t.txn_date), "dd MMM")}</TableCell>
                      <TableCell className="max-w-md truncate">{t.description || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{t.reference || "—"}</TableCell>
                      <TableCell className={`text-right font-medium ${t.direction === "credit" ? "text-emerald-600" : "text-red-600"}`}>
                        {t.direction === "credit" ? "+" : "−"} {formatCurrency(Number(t.amount), cur)}
                      </TableCell>
                      <TableCell>
                        {t.reconciled
                          ? <Badge className="bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-3 w-3 mr-1" />Reconciled</Badge>
                          : <Badge variant="secondary">Pending</Badge>}
                        {t.matched_type && <div className="text-xs text-muted-foreground mt-0.5">→ {t.matched_type}</div>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setMatchOpen(t)}><Link2 className="h-3 w-3 mr-1" />Match</Button>
                        <Button size="icon" variant="ghost" onClick={() => markReconciled(t)} title="Toggle reconciled"><CheckCircle2 className={`h-4 w-4 ${t.reconciled ? "text-emerald-600" : "text-muted-foreground"}`} /></Button>
                        <Button size="icon" variant="ghost" onClick={() => removeTxn(t)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!txns.filter(t => tab === "all" || !t.reconciled).length && (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{tab === "unrec" ? "All caught up — no pending transactions" : "No transactions yet"}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Import Bank Statement (CSV)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Supports HDFC / SBI / ICICI / Axis bank exports and UPI statements (PhonePe, GPay, Paytm). Expected columns: Date, Description / Narration, Debit, Credit (or Amount), Reference / UTR, Balance.
            </div>
            <Input type="file" accept=".csv,.txt" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            {parsed.length > 0 && (
              <div className="max-h-64 overflow-auto border rounded">
                <Table>
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Desc</TableHead><TableHead>Ref</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {parsed.slice(0, 50).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>{r.txn_date}</TableCell>
                        <TableCell className="max-w-xs truncate text-xs">{r.description}</TableCell>
                        <TableCell className="font-mono text-xs">{r.reference}</TableCell>
                        <TableCell className={`text-right ${r.direction === "credit" ? "text-emerald-600" : "text-red-600"}`}>{r.direction === "credit" ? "+" : "−"}{r.amount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="text-xs text-muted-foreground p-2">{parsed.length} rows parsed</div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportOpen(false); setParsed([]); }}>Cancel</Button>
            <Button onClick={doImport} disabled={!parsed.length || importing}>{importing ? "Importing…" : `Import ${parsed.length} rows`}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual add */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Transaction</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Date</Label><Input type="date" value={manual.txn_date} onChange={e => setManual({ ...manual, txn_date: e.target.value })} /></div>
            <div>
              <Label>Type</Label>
              <Select value={manual.direction} onValueChange={v => setManual({ ...manual, direction: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="credit">Money In (Credit)</SelectItem><SelectItem value="debit">Money Out (Debit)</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Amount</Label><Input type="number" value={manual.amount} onChange={e => setManual({ ...manual, amount: e.target.value })} /></div>
            <div className="col-span-2"><Label>Description</Label><Input value={manual.description} onChange={e => setManual({ ...manual, description: e.target.value })} /></div>
            <div className="col-span-2"><Label>Reference / UTR</Label><Input value={manual.reference} onChange={e => setManual({ ...manual, reference: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setManualOpen(false)}>Cancel</Button><Button onClick={addManual}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Match dialog */}
      <Dialog open={!!matchOpen} onOpenChange={(o) => !o && setMatchOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Match Transaction</DialogTitle>
            {matchOpen && <div className="text-sm text-muted-foreground">{format(new Date(matchOpen.txn_date), "dd MMM yyyy")} • {matchOpen.description} • {matchOpen.direction === "credit" ? "+" : "−"}{formatCurrency(Number(matchOpen.amount), cur)}</div>}
          </DialogHeader>
          {matchOpen && (
            <div className="space-y-2 max-h-96 overflow-auto">
              {suggestions(matchOpen).map((s: any) => (
                <div key={`${s.kind}-${s.id}`} className="flex items-center justify-between p-2 border rounded hover:bg-muted">
                  <div>
                    <div className="text-sm font-medium">{s.label}</div>
                    <div className="text-xs text-muted-foreground">{s.kind} • {format(new Date(s.date), "dd MMM yyyy")} • {formatCurrency(s.amount, cur)} {s.ref && `• ${s.ref}`}</div>
                  </div>
                  <Button size="sm" onClick={() => linkMatch(matchOpen, s.kind, s.id)}>Match</Button>
                </div>
              ))}
              {!suggestions(matchOpen).length && <div className="text-sm text-muted-foreground text-center py-6">No matching {matchOpen.direction === "credit" ? "payments received" : "bill payments / expenses"} found. Try marking it reconciled manually if it's a one-off entry.</div>}
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setMatchOpen(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
