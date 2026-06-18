import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Line { account_id: string; debit: string; credit: string; description: string; }

export default function JournalEntriesPage() {
  const org = useAppStore((s) => s.organization);
  const { toast } = useToast();
  const [entries, setEntries] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lineMap, setLineMap] = useState<Record<string, any[]>>({});

  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { account_id: "", debit: "0", credit: "0", description: "" },
    { account_id: "", debit: "0", credit: "0", description: "" },
  ]);

  const load = async () => {
    if (!org?.id) return;
    const [e, a] = await Promise.all([
      (supabase as any).from("journal_entries").select("*").eq("org_id", org.id).order("entry_date", { ascending: false }).limit(200),
      (supabase as any).from("accounts").select("id,code,name").eq("org_id", org.id).order("code"),
    ]);
    setEntries(e.data || []);
    setAccounts(a.data || []);
  };
  useEffect(() => { load(); }, [org?.id]);

  const toggle = async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!lineMap[id]) {
      const { data } = await (supabase as any).from("journal_lines").select("*, accounts(code,name)").eq("entry_id", id).order("sort_order");
      setLineMap({ ...lineMap, [id]: data || [] });
    }
  };

  const totalDr = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCr = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);

  const save = async () => {
    if (!org?.id) return;
    if (Math.abs(totalDr - totalCr) > 0.01) { toast({ title: "Debits must equal credits", variant: "destructive" }); return; }
    if (totalDr === 0) { toast({ title: "Enter amounts", variant: "destructive" }); return; }
    const valid = lines.filter(l => l.account_id && ((Number(l.debit) || 0) > 0 || (Number(l.credit) || 0) > 0));
    if (valid.length < 2) { toast({ title: "Need at least 2 lines", variant: "destructive" }); return; }

    const { data: entry, error } = await (supabase as any).from("journal_entries").insert({
      org_id: org.id, entry_date: date, narration, source_type: "manual",
      total_debit: totalDr, total_credit: totalCr, is_posted: true,
    }).select().single();
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    const linePayloads = valid.map((l, i) => ({
      org_id: org.id, entry_id: entry.id, account_id: l.account_id,
      debit: Number(l.debit) || 0, credit: Number(l.credit) || 0,
      description: l.description, sort_order: i,
    }));
    await (supabase as any).from("journal_lines").insert(linePayloads);
    toast({ title: "Entry posted" });
    setOpen(false); setNarration("");
    setLines([{ account_id: "", debit: "0", credit: "0", description: "" }, { account_id: "", debit: "0", credit: "0", description: "" }]);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this entry?")) return;
    await (supabase as any).from("journal_entries").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Journal Entries</h1>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> New Entry</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All Entries ({entries.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-8"></TableHead><TableHead>Date</TableHead><TableHead>Reference</TableHead>
              <TableHead>Narration</TableHead><TableHead>Source</TableHead>
              <TableHead className="text-right">Amount</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {entries.map(e => (
                <>
                  <TableRow key={e.id} className="cursor-pointer" onClick={() => toggle(e.id)}>
                    <TableCell>{expanded === e.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                    <TableCell>{format(new Date(e.entry_date), "dd MMM yyyy")}</TableCell>
                    <TableCell className="font-mono text-xs">{e.reference || "—"}</TableCell>
                    <TableCell>{e.narration || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{e.source_type || "manual"}</Badge></TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(e.total_debit), org?.currency || "INR")}</TableCell>
                    <TableCell className="text-right" onClick={(ev) => ev.stopPropagation()}>
                      {e.source_type === "manual" && <Button size="icon" variant="ghost" onClick={() => remove(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </TableCell>
                  </TableRow>
                  {expanded === e.id && (
                    <TableRow><TableCell colSpan={7} className="bg-muted/30">
                      <Table>
                        <TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {(lineMap[e.id] || []).map((l: any) => (
                            <TableRow key={l.id}>
                              <TableCell>{l.accounts?.code} {l.accounts?.name}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{l.description || "—"}</TableCell>
                              <TableCell className="text-right">{Number(l.debit) > 0 ? formatCurrency(Number(l.debit), org?.currency || "INR") : "—"}</TableCell>
                              <TableCell className="text-right">{Number(l.credit) > 0 ? formatCurrency(Number(l.credit), org?.currency || "INR") : "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableCell></TableRow>
                  )}
                </>
              ))}
              {!entries.length && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No entries yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>New Journal Entry</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
              <div><Label>Narration</Label><Input value={narration} onChange={e => setNarration(e.target.value)} /></div>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Description</TableHead><TableHead className="w-32">Debit</TableHead><TableHead className="w-32">Credit</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {lines.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Select value={l.account_id} onValueChange={(v) => { const x = [...lines]; x[i].account_id = v; setLines(x); }}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} {a.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Input value={l.description} onChange={e => { const x = [...lines]; x[i].description = e.target.value; setLines(x); }} /></TableCell>
                    <TableCell><Input type="number" value={l.debit} onChange={e => { const x = [...lines]; x[i].debit = e.target.value; if (Number(e.target.value) > 0) x[i].credit = "0"; setLines(x); }} /></TableCell>
                    <TableCell><Input type="number" value={l.credit} onChange={e => { const x = [...lines]; x[i].credit = e.target.value; if (Number(e.target.value) > 0) x[i].debit = "0"; setLines(x); }} /></TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button size="sm" variant="outline" onClick={() => setLines([...lines, { account_id: "", debit: "0", credit: "0", description: "" }])}>
              <Plus className="h-4 w-4 mr-1" /> Add Line
            </Button>
            <div className="flex justify-end gap-6 text-sm">
              <span>Total Debit: <strong>{formatCurrency(totalDr, org?.currency || "INR")}</strong></span>
              <span>Total Credit: <strong>{formatCurrency(totalCr, org?.currency || "INR")}</strong></span>
              <span className={Math.abs(totalDr - totalCr) > 0.01 ? "text-destructive" : "text-emerald-600"}>
                {Math.abs(totalDr - totalCr) > 0.01 ? `Off by ${formatCurrency(Math.abs(totalDr - totalCr), org?.currency || "INR")}` : "✓ Balanced"}
              </span>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Post Entry</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
