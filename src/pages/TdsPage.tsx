import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";
import { format, startOfMonth, endOfMonth } from "date-fns";

export default function TdsPage() {
  const org = useAppStore((s) => s.organization);
  const { toast } = useToast();
  const [sections, setSections] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", name: "", rate: "0", threshold: "0" });
  const [from, setFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));

  const load = async () => {
    if (!org?.id) return;
    const [s, b] = await Promise.all([
      (supabase as any).from("tds_sections").select("*").eq("org_id", org.id).order("code"),
      (supabase as any).from("bills").select("*, vendors(name), tds_sections(code,name)").eq("org_id", org.id).gt("tds_amount", 0).gte("bill_date", from).lte("bill_date", to).order("bill_date", { ascending: false }),
    ]);
    setSections(s.data || []); setBills(b.data || []);
  };
  useEffect(() => { load(); }, [org?.id, from, to]);

  const save = async () => {
    if (!org?.id || !form.code || !form.name) { toast({ title: "Code & name required", variant: "destructive" }); return; }
    const payload = { ...form, org_id: org.id, rate: Number(form.rate), threshold: Number(form.threshold) };
    const { error } = editId
      ? await (supabase as any).from("tds_sections").update(payload).eq("id", editId)
      : await (supabase as any).from("tds_sections").insert(payload);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    setOpen(false); setForm({ code: "", name: "", rate: "0", threshold: "0" }); setEditId(null); load();
  };

  const summary = useMemo(() => {
    const map: Record<string, { code: string; name: string; base: number; tds: number; count: number }> = {};
    bills.forEach(b => {
      const code = b.tds_sections?.code || "—";
      const name = b.tds_sections?.name || "—";
      if (!map[code]) map[code] = { code, name, base: 0, tds: 0, count: 0 };
      map[code].base += Number(b.subtotal);
      map[code].tds += Number(b.tds_amount);
      map[code].count++;
    });
    return Object.values(map);
  }, [bills]);

  const totalTds = bills.reduce((s, b) => s + Number(b.tds_amount), 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">TDS Management</h1>

      <Tabs defaultValue="report">
        <TabsList>
          <TabsTrigger value="report">TDS Report</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
        </TabsList>

        <TabsContent value="report" className="space-y-4">
          <Card>
            <CardContent className="pt-5 flex items-end gap-3">
              <div><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
              <div><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
              <div className="ml-auto text-right">
                <div className="text-xs text-muted-foreground">Total TDS Deducted</div>
                <div className="text-2xl font-semibold text-amber-600">{formatCurrency(totalTds, (org as any)?.currency || "INR")}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Summary by Section</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Section</TableHead><TableHead>Name</TableHead><TableHead className="text-right">Bills</TableHead><TableHead className="text-right">Base Amount</TableHead><TableHead className="text-right">TDS</TableHead></TableRow></TableHeader>
                <TableBody>
                  {summary.map(s => (
                    <TableRow key={s.code}>
                      <TableCell className="font-mono">{s.code}</TableCell>
                      <TableCell>{s.name}</TableCell>
                      <TableCell className="text-right">{s.count}</TableCell>
                      <TableCell className="text-right">{formatCurrency(s.base, (org as any)?.currency || "INR")}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(s.tds, (org as any)?.currency || "INR")}</TableCell>
                    </TableRow>
                  ))}
                  {!summary.length && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No TDS for this period</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Detailed Bills with TDS</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Bill #</TableHead><TableHead>Vendor</TableHead><TableHead>Section</TableHead><TableHead className="text-right">Base</TableHead><TableHead className="text-right">TDS</TableHead></TableRow></TableHeader>
                <TableBody>
                  {bills.map(b => (
                    <TableRow key={b.id}>
                      <TableCell>{format(new Date(b.bill_date), "dd MMM")}</TableCell>
                      <TableCell className="font-mono text-xs">{b.bill_number}</TableCell>
                      <TableCell>{b.vendors?.name}</TableCell>
                      <TableCell>{b.tds_sections?.code}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(b.subtotal), (org as any)?.currency || "INR")}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(Number(b.tds_amount), (org as any)?.currency || "INR")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sections">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">TDS Sections</CardTitle>
              <Button size="sm" onClick={() => { setEditId(null); setForm({ code: "", name: "", rate: "0", threshold: "0" }); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Add</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead className="text-right">Rate %</TableHead><TableHead className="text-right">Threshold</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {sections.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono">{s.code}</TableCell>
                      <TableCell>{s.name}</TableCell>
                      <TableCell className="text-right">{s.rate}%</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(s.threshold), (org as any)?.currency || "INR")}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => { setEditId(s.id); setForm({ code: s.code, name: s.name, rate: String(s.rate), threshold: String(s.threshold) }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={async () => { if (confirm("Delete?")) { await (supabase as any).from("tds_sections").delete().eq("id", s.id); load(); } }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Edit" : "Add"} TDS Section</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Code *</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="194C" /></div>
            <div><Label>Rate %</Label><Input type="number" value={form.rate} onChange={e => setForm({ ...form, rate: e.target.value })} /></div>
            <div className="col-span-2"><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="col-span-2"><Label>Threshold</Label><Input type="number" value={form.threshold} onChange={e => setForm({ ...form, threshold: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>{editId ? "Update" : "Add"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
