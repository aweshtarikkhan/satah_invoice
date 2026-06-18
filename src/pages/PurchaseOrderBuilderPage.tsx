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

interface Line {
  id?: string;
  item_id: string;
  description: string;
  hsn: string;
  quantity: string;
  rate: string;
  tax_rate: string;
  unit: string;
}
const emptyLine = (): Line => ({ item_id: "", description: "", hsn: "", quantity: "1", rate: "0", tax_rate: "0", unit: "" });

export default function PurchaseOrderBuilderPage() {
  const org = useAppStore((s) => s.organization);
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [vendors, setVendors] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [poDate, setPoDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [expectedDate, setExpectedDate] = useState(format(addDays(new Date(), 7), "yyyy-MM-dd"));
  const [status, setStatus] = useState("draft");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!org?.id) return;
    (async () => {
      const [v, it, br, wh, o] = await Promise.all([
        (supabase as any).from("vendors").select("id,name").eq("org_id", org.id).eq("is_active", true).order("name"),
        (supabase as any).from("items").select("id,name,hsn,unit,purchase_price,tax_rate").eq("org_id", org.id).order("name"),
        (supabase as any).from("branches").select("id,name,is_default").eq("org_id", org.id).eq("is_active", true),
        (supabase as any).from("warehouses").select("id,name").eq("org_id", org.id),
        (supabase as any).from("organizations").select("po_next_number,po_prefix").eq("id", org.id).maybeSingle(),
      ]);
      setVendors(v.data || []);
      setItems(it.data || []);
      setBranches(br.data || []);
      setWarehouses(wh.data || []);
      const def = (br.data || []).find((x: any) => x.is_default);
      if (def) setBranchId(def.id);
      if (!id) {
        const prefix = o.data?.po_prefix || "PO-";
        const next = o.data?.po_next_number || 1;
        setPoNumber(`${prefix}${String(next).padStart(4, "0")}`);
      } else {
        loadPo();
      }
    })();
  }, [org?.id, id]);

  const loadPo = async () => {
    const { data: po } = await (supabase as any).from("purchase_orders").select("*").eq("id", id).maybeSingle();
    const { data: pl } = await (supabase as any).from("purchase_order_lines").select("*").eq("po_id", id).order("sort_order");
    if (po) {
      setVendorId(po.vendor_id || "");
      setBranchId(po.branch_id || "");
      setWarehouseId(po.warehouse_id || "");
      setPoNumber(po.po_number);
      setPoDate(po.po_date);
      setExpectedDate(po.expected_date || "");
      setStatus(po.status);
      setNotes(po.notes || "");
      setTerms(po.terms || "");
    }
    if (pl) setLines(pl.map((l: any) => ({
      id: l.id, item_id: l.item_id || "", description: l.description, hsn: l.hsn || "",
      quantity: String(l.quantity), rate: String(l.rate), tax_rate: String(l.tax_rate || 0), unit: l.unit || "",
    })));
  };

  const totals = useMemo(() => {
    let sub = 0, tax = 0;
    lines.forEach(l => {
      const q = Number(l.quantity) || 0, r = Number(l.rate) || 0, t = Number(l.tax_rate) || 0;
      const amt = q * r;
      sub += amt; tax += amt * (t / 100);
    });
    return { sub, tax, total: sub + tax };
  }, [lines]);

  const pickItem = (idx: number, itemId: string) => {
    const it = items.find(x => x.id === itemId);
    const x = [...lines];
    x[idx].item_id = itemId;
    if (it) {
      x[idx].description = it.name;
      x[idx].hsn = it.hsn || "";
      x[idx].unit = it.unit || "";
      x[idx].rate = String(it.purchase_price || 0);
      x[idx].tax_rate = String(it.tax_rate || 0);
    }
    setLines(x);
  };

  const save = async () => {
    if (!org?.id || !vendorId) { toast({ title: "Vendor required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const payload: any = {
        org_id: org.id, vendor_id: vendorId, branch_id: branchId || null, warehouse_id: warehouseId || null,
        po_number: poNumber, po_date: poDate, expected_date: expectedDate || null,
        status, subtotal: totals.sub, tax_amount: totals.tax, total: totals.total,
        currency: (org as any)?.currency || "INR", notes: notes || null, terms: terms || null,
      };
      let poId = id;
      if (id) {
        const { error } = await (supabase as any).from("purchase_orders").update(payload).eq("id", id);
        if (error) throw error;
        await (supabase as any).from("purchase_order_lines").delete().eq("po_id", id);
      } else {
        const { data, error } = await (supabase as any).from("purchase_orders").insert(payload).select().single();
        if (error) throw error;
        poId = data.id;
        const { data: o } = await (supabase as any).from("organizations").select("po_next_number").eq("id", org.id).maybeSingle();
        await (supabase as any).from("organizations").update({ po_next_number: (o?.po_next_number || 1) + 1 }).eq("id", org.id);
      }
      const linePayloads = lines.map((l, idx) => ({
        org_id: org.id, po_id: poId, item_id: l.item_id || null,
        description: l.description, hsn: l.hsn || null, unit: l.unit || null,
        quantity: Number(l.quantity) || 0, rate: Number(l.rate) || 0,
        tax_rate: Number(l.tax_rate) || 0,
        amount: (Number(l.quantity) || 0) * (Number(l.rate) || 0),
        sort_order: idx,
      }));
      const { error: lErr } = await (supabase as any).from("purchase_order_lines").insert(linePayloads);
      if (lErr) throw lErr;
      toast({ title: id ? "PO updated" : "PO created" });
      navigate(`/purchase-orders/${poId}`);
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{id ? "Edit Purchase Order" : "New Purchase Order"}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/purchase-orders")}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save PO"}</Button>
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
          <div>
            <Label>Warehouse</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger><SelectValue placeholder="Warehouse" /></SelectTrigger>
              <SelectContent>{warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>PO #</Label><Input value={poNumber} onChange={e => setPoNumber(e.target.value)} /></div>
          <div><Label>PO Date</Label><Input type="date" value={poDate} onChange={e => setPoDate(e.target.value)} /></div>
          <div><Label>Expected Date</Label><Input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} /></div>
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
              <TableHead className="w-48">Item</TableHead><TableHead>Description</TableHead>
              <TableHead className="w-20">HSN</TableHead><TableHead className="w-16">Qty</TableHead>
              <TableHead className="w-20">Unit</TableHead><TableHead className="w-24">Rate</TableHead>
              <TableHead className="w-20">Tax%</TableHead><TableHead className="text-right">Amount</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {lines.map((l, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Select value={l.item_id} onValueChange={(v) => pickItem(i, v)}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Item" /></SelectTrigger>
                      <SelectContent>{items.map(it => <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Input value={l.description} onChange={e => { const x = [...lines]; x[i].description = e.target.value; setLines(x); }} /></TableCell>
                  <TableCell><Input value={l.hsn} onChange={e => { const x = [...lines]; x[i].hsn = e.target.value; setLines(x); }} /></TableCell>
                  <TableCell><Input type="number" value={l.quantity} onChange={e => { const x = [...lines]; x[i].quantity = e.target.value; setLines(x); }} /></TableCell>
                  <TableCell><Input value={l.unit} onChange={e => { const x = [...lines]; x[i].unit = e.target.value; setLines(x); }} /></TableCell>
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
            <div className="flex justify-between font-semibold text-base border-t pt-2"><span>Total</span><span>{formatCurrency(totals.total, (org as any)?.currency || "INR")}</span></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5 grid grid-cols-2 gap-4">
          <div><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
          <div><Label>Terms</Label><Textarea value={terms} onChange={e => setTerms(e.target.value)} rows={2} /></div>
        </CardContent>
      </Card>
    </div>
  );
}
