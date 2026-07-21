import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import { format, addDays } from "date-fns";
import { formatCurrency } from "@/lib/currency";
import { postBillJournal } from "@/lib/accounting";

interface Line {
  id?: string;
  description: string;
  hsn: string;
  quantity: string;
  rate: string;
  tax_rate: string;
  account_id: string;
}

const emptyLine = (): Line => ({ description: "", hsn: "", quantity: "1", rate: "0", tax_rate: "0", account_id: "" });

export default function BillBuilderPage() {
  const org = useAppStore((s) => s.organization);
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [vendors, setVendors] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [tdsSections, setTdsSections] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [vendorBillNumber, setVendorBillNumber] = useState("");
  const [billDate, setBillDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), 30), "yyyy-MM-dd"));
  const [tdsId, setTdsId] = useState<string>("none");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [amountPaid, setAmountPaid] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!org?.id) return;
    (async () => {
      const [v, a, t, br, o] = await Promise.all([
        (supabase as any).from("vendors").select("id,name").eq("org_id", org.id).eq("is_active", true).order("name"),
        (supabase as any).from("accounts").select("id,code,name,type").eq("org_id", org.id).in("type", ["expense", "asset"]).order("code"),
        (supabase as any).from("tds_sections").select("*").eq("org_id", org.id).eq("is_active", true).order("code"),
        (supabase as any).from("branches").select("id,name,is_default").eq("org_id", org.id).eq("is_active", true).order("name"),
        (supabase as any).from("organizations").select("next_bill_number, bill_prefix").eq("id", org.id).maybeSingle(),
      ]);
      setVendors(v.data || []);
      setAccounts(a.data || []);
      setTdsSections(t.data || []);
      setBranches(br.data || []);
      const def = (br.data || []).find((x: any) => x.is_default);
      if (def) setBranchId(def.id);
      if (!id) {
        const next = o.data?.next_bill_number || 1;
        const prefix = o.data?.bill_prefix || "BILL-";
        setBillNumber(`${prefix}${String(next).padStart(4, "0")}`);
      }
      if (id) loadBill();
    })();
  }, [org?.id, id]);

  const loadBill = async () => {
    const { data: bill } = await (supabase as any).from("bills").select("*").eq("id", id).maybeSingle();
    const { data: blines } = await (supabase as any).from("bill_lines").select("*").eq("bill_id", id).order("sort_order");
    if (bill) {
      setVendorId(bill.vendor_id);
      setBranchId(bill.branch_id || "");
      setBillNumber(bill.bill_number);
      setVendorBillNumber(bill.vendor_bill_number || "");
      setBillDate(bill.bill_date);
      setDueDate(bill.due_date || "");
      setTdsId(bill.tds_section_id || "none");
      setNotes(bill.notes || "");
      setAmountPaid(Number(bill.amount_paid || 0));
    }
    if (blines) setLines(blines.map((l: any) => ({
      id: l.id, description: l.description, hsn: l.hsn || "",
      quantity: String(l.quantity), rate: String(l.rate),
      tax_rate: String(l.tax_rate), account_id: l.account_id || "",
    })));
  };

  const totals = useMemo(() => {
    let sub = 0, tax = 0;
    lines.forEach(l => {
      const q = Number(l.quantity) || 0, r = Number(l.rate) || 0, t = Number(l.tax_rate) || 0;
      const amt = q * r;
      sub += amt;
      tax += amt * (t / 100);
    });
    const tdsRate = tdsSections.find(t => t.id === tdsId)?.rate || 0;
    const tdsAmt = (sub * Number(tdsRate)) / 100;
    const total = sub + tax - tdsAmt;
    return { sub, tax, tdsAmt, total };
  }, [lines, tdsId, tdsSections]);

  const save = async () => {
    if (!org?.id || !vendorId) { toast({ title: "Vendor required", variant: "destructive" }); return; }
    if (!lines.length) { toast({ title: "Add at least one line", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const billPayload: any = {
        org_id: org.id, vendor_id: vendorId, branch_id: branchId || null,
        bill_number: billNumber, vendor_bill_number: vendorBillNumber || null,
        bill_date: billDate, due_date: dueDate || null,
        subtotal: totals.sub, tax_total: totals.tax,
        tds_section_id: tdsId === "none" ? null : tdsId, tds_amount: totals.tdsAmt,
        total: totals.total, balance_due: totals.total - amountPaid, amount_paid: amountPaid,
        status: (totals.total - amountPaid) <= 0 && amountPaid > 0 ? "paid" : (amountPaid > 0 ? "partial" : "received"), notes: notes || null,
      };
      let billId = id;
      if (id) {
        const { error } = await (supabase as any).from("bills").update(billPayload).eq("id", id);
        if (error) throw error;
        await (supabase as any).from("bill_lines").delete().eq("bill_id", id);
      } else {
        const { data, error } = await (supabase as any).from("bills").insert(billPayload).select().single();
        if (error) throw error;
        billId = data.id;
        // increment org next_bill_number
        await (supabase as any).rpc as any;
        const { data: o } = await (supabase as any).from("organizations").select("next_bill_number").eq("id", org.id).maybeSingle();
        await (supabase as any).from("organizations").update({ next_bill_number: (o?.next_bill_number || 1) + 1 }).eq("id", org.id);
      }
      const linePayloads = lines.map((l, idx) => ({
        org_id: org.id, bill_id: billId, account_id: l.account_id || null,
        description: l.description, hsn: l.hsn || null,
        quantity: Number(l.quantity) || 0, rate: Number(l.rate) || 0,
        tax_rate: Number(l.tax_rate) || 0,
        tax_amount: (Number(l.quantity) * Number(l.rate)) * (Number(l.tax_rate) / 100),
        amount: (Number(l.quantity) || 0) * (Number(l.rate) || 0),
        sort_order: idx,
      }));
      const { error: lErr } = await (supabase as any).from("bill_lines").insert(linePayloads);
      if (lErr) throw lErr;

      // Post journal entry
      await postBillJournal(org.id, billId!, billDate, billNumber, vendorId, linePayloads, totals.tax, totals.tdsAmt, totals.total, branchId || null);

      toast({ title: id ? "Bill updated" : "Bill created" });
      navigate(`/bills/${billId}`);
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{id ? "Edit Bill" : "New Bill"}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/bills")}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Bill"}</Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label>Vendor *</Label>
            <Select value={vendorId} onValueChange={setVendorId}>
              <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
              <SelectContent>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Branch</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger><SelectValue placeholder="Branch" /></SelectTrigger>
              <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Bill #</Label><Input value={billNumber} onChange={e => setBillNumber(e.target.value)} /></div>
          <div><Label>Vendor Bill #</Label><Input value={vendorBillNumber} onChange={e => setVendorBillNumber(e.target.value)} /></div>
          <div><Label>Bill Date</Label><Input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} /></div>
          <div><Label>Due Date</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
          <div>
            <Label>TDS Section</Label>
            <Select value={tdsId} onValueChange={setTdsId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {tdsSections.map(t => <SelectItem key={t.id} value={t.id}>{t.code} ({t.rate}%)</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Line Items</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setLines([...lines, emptyLine()])}><Plus className="h-4 w-4 mr-1" /> Add Line</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Description</TableHead><TableHead>Expense Account</TableHead>
              <TableHead className="w-32">HSN</TableHead><TableHead className="w-24">Qty</TableHead>
              <TableHead className="w-32">Rate</TableHead><TableHead className="w-24">Tax %</TableHead>
              <TableHead className="text-right">Amount</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {lines.map((l, i) => (
                <TableRow key={i}>
                  <TableCell><Input value={l.description} onChange={e => { const x = [...lines]; x[i].description = e.target.value; setLines(x); }} /></TableCell>
                  <TableCell>
                    <Select value={l.account_id} onValueChange={(v) => { const x = [...lines]; x[i].account_id = v; setLines(x); }}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Account" /></SelectTrigger>
                      <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} {a.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Input value={l.hsn} onChange={e => { const x = [...lines]; x[i].hsn = e.target.value; setLines(x); }} /></TableCell>
                  <TableCell><Input type="number" value={l.quantity} onChange={e => { const x = [...lines]; x[i].quantity = e.target.value; setLines(x); }} /></TableCell>
                  <TableCell><Input type="number" value={l.rate} onChange={e => { const x = [...lines]; x[i].rate = e.target.value; setLines(x); }} /></TableCell>
                  <TableCell><Input type="number" value={l.tax_rate} onChange={e => { const x = [...lines]; x[i].tax_rate = e.target.value; setLines(x); }} /></TableCell>
                  <TableCell className="text-right">{formatCurrency((Number(l.quantity) || 0) * (Number(l.rate) || 0), (org as any)?.currency || "INR")}</TableCell>
                  <TableCell><Button size="icon" variant="ghost" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 ml-auto w-72 space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(totals.sub, (org as any)?.currency || "INR")}</span></div>
            <div className="flex justify-between"><span>Tax</span><span>{formatCurrency(totals.tax, (org as any)?.currency || "INR")}</span></div>
            {totals.tdsAmt > 0 && <div className="flex justify-between text-amber-600"><span>TDS</span><span>− {formatCurrency(totals.tdsAmt, (org as any)?.currency || "INR")}</span></div>}
            <div className="flex justify-between font-semibold text-base border-t pt-2"><span>Total</span><span>{formatCurrency(totals.total, (org as any)?.currency || "INR")}</span></div>
          </div>
        </CardContent>
      </Card>

      <Card><CardContent className="pt-5"><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></CardContent></Card>
    </div>
  );
}
