import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { stateCodeFromGstin } from "@/lib/gst";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddItemDialog } from "@/components/shared/AddItemDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ListPlus, FileText, ShoppingCart, Save, Store, Calendar, CheckCircle2 } from "lucide-react";
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
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [poDate, setPoDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [expectedDate, setExpectedDate] = useState(format(addDays(new Date(), 7), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [createItemOpen, setCreateItemOpen] = useState(false);
  const [newItemTargetLine, setNewItemTargetLine] = useState<number | null>(null);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());

  // GST: determine if vendor has GSTIN and whether interstate
  const selectedVendor = useMemo(() => vendors.find(v => v.id === vendorId), [vendors, vendorId]);
  const vendorGstin = (selectedVendor?.gstin || "").trim();
  const vendorHasGst = vendorGstin.length === 15;
  const orgGstin = ((org as any)?.gstin || "").trim();
  const orgState = stateCodeFromGstin(orgGstin);
  const vendorState = stateCodeFromGstin(vendorGstin);
  const isInterstate = !!(orgState && vendorState && orgState !== vendorState);

  useEffect(() => {
    if (!org?.id) return;
    (async () => {
      const [v, it, o, tr] = await Promise.all([
        (supabase as any).from("vendors").select("id,name,gstin").eq("org_id", org.id).eq("is_active", true).order("name"),
        (supabase as any).from("items").select("*").eq("org_id", org.id).eq("is_active", true).order("name"),
        (supabase as any).from("organizations").select("po_next_number,po_prefix").eq("id", org.id).maybeSingle(),
        (supabase as any).from("tax_rates").select("*").eq("org_id", org.id)
      ]);
      setVendors(v.data || []);
      setItems(it.data || []);
      setTaxRates(tr.data || []);
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
      setPoNumber(po.po_number);
      setPoDate(po.po_date);
      setExpectedDate(po.expected_date || "");
      setNotes(po.notes || "");
      setTerms(po.terms || "");
    }
    if (pl) setLines(pl.map((l: any) => ({
      id: l.id, item_id: l.item_id || "", description: l.description, hsn: l.hsn || "",
      quantity: String(l.quantity), rate: String(l.rate), tax_rate: String(l.tax_rate || 0), unit: l.unit || "",
    })));
  };

  // GST-aware totals
  const totals = useMemo(() => {
    let sub = 0, cgst = 0, sgst = 0, igst = 0;
    const breakdown: Record<number, number> = {};
    lines.forEach(l => {
      const q = Number(l.quantity) || 0, r = Number(l.rate) || 0;
      const t = vendorHasGst ? (Number(l.tax_rate) || 0) : 0; // No GST if vendor has no GSTIN
      const amt = q * r;
      sub += amt;
      const taxAmt = amt * (t / 100);
      if (t > 0) {
        breakdown[t] = (breakdown[t] || 0) + taxAmt;
      }
      if (isInterstate) {
        igst += taxAmt;
      } else {
        cgst += taxAmt / 2;
        sgst += taxAmt / 2;
      }
    });
    const totalTax = igst + cgst + sgst;
    return { sub, cgst, sgst, igst, totalTax, total: sub + totalTax, breakdown };
  }, [lines, vendorHasGst, isInterstate]);

  const pickItem = (idx: number, itemId: string) => {
    const it = items.find(x => x.id === itemId);
    const x = [...lines];
    x[idx].item_id = itemId;
    if (it) {
      x[idx].description = it.name;
      x[idx].hsn = it.hsn_code || "";
      x[idx].unit = it.unit || "";
      x[idx].rate = String(it.unit_price || 0);
      x[idx].tax_rate = it.tax_id ? String(taxRates.find((t: any) => t.id === it.tax_id)?.rate || 0) : "0";
    }
    setLines(x);
  };

  const save = async () => {
    if (!org?.id || !vendorId) { toast({ title: "Vendor required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const payload: any = {
        org_id: org.id, vendor_id: vendorId,
        po_number: poNumber, po_date: poDate, expected_date: expectedDate || null,
        status: "draft", subtotal: totals.sub, tax_amount: totals.totalTax, total: totals.total,
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
      const linePayloads = lines.map((l, idx) => {
        const q = Number(l.quantity) || 0;
        const r = Number(l.rate) || 0;
        const tRate = vendorHasGst ? (Number(l.tax_rate) || 0) : 0;
        const tAmount = vendorHasGst ? (q * r * (tRate / 100)) : 0;
        return {
          org_id: org.id, po_id: poId, item_id: l.item_id || null, description: l.description,
          hsn: l.hsn || null, quantity: q, rate: r, tax_rate: tRate,
          amount: (q * r) + tAmount, sort_order: idx, unit: l.unit || null
        };
      });
      const { error: lErr } = await (supabase as any).from("purchase_order_lines").insert(linePayloads);
      if (lErr) throw lErr;
      toast({ title: id ? "PO updated" : "PO created" });
      navigate(`/purchase-orders/${poId}`);
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const currency = (org as any)?.currency || "INR";

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{id ? "Edit Purchase Order" : "New Purchase Order"}</h1>
            <p className="text-sm text-slate-500">Create a new purchase order for your vendor</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="bg-white" onClick={() => navigate("/purchase-orders")}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving…" : "Save PO"}
          </Button>
        </div>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-3 border-b bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-blue-100 text-blue-700 rounded-md flex items-center justify-center">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base text-blue-700">Purchase Order Details</CardTitle>
              <p className="text-xs text-slate-500">Add vendor and order details</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-slate-700">Vendor <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Store className="absolute left-3 top-2.5 h-4 w-4 text-blue-600" />
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger className="pl-9 h-10 border-slate-200 shadow-sm"><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {vendorId && (
              <div className="pt-2">
                {vendorHasGst ? (
                  <div className="inline-flex items-center bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-full border border-blue-100">
                    Vendor GSTIN: <span className="font-semibold ml-1">{vendorGstin}</span>
                    <span className="mx-2">•</span>
                    {isInterstate ? "Interstate (IGST)" : "Intrastate (CGST + SGST)"}
                  </div>
                ) : (
                  <div className="inline-flex items-center bg-amber-50 text-amber-700 text-xs px-2.5 py-1 rounded-full border border-amber-100">
                    ⚠ Vendor has no GST number — GST will not be applied
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-700">PO #</Label>
            <Input className="h-10 border-slate-200 shadow-sm" value={poNumber} onChange={e => setPoNumber(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-700">PO Date</Label>
            <div className="relative">
              <Input type="date" className="h-10 border-slate-200 shadow-sm pr-10" value={poDate} onChange={e => setPoDate(e.target.value)} />
              <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-700">Expected Date</Label>
            <div className="relative">
              <Input type="date" className="h-10 border-slate-200 shadow-sm pr-10" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} />
              <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-blue-100 text-blue-700 rounded-md flex items-center justify-center">
              <ShoppingCart className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base text-blue-700">Line Items</CardTitle>
              <p className="text-xs text-slate-500">Add products or services to this purchase order</p>
            </div>
          </div>
          <div>
            <Button size="sm" variant="outline" className="mr-2" onClick={() => setBulkAddOpen(true)}><ListPlus className="h-4 w-4 mr-1" /> Bulk Add</Button>
            <Button size="sm" variant="outline" onClick={() => setLines([...lines, emptyLine()])}><Plus className="h-4 w-4 mr-1" /> Add Line</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead className="w-[300px]">Item &amp; Description</TableHead>
              <TableHead className="w-28">HSN</TableHead>
              <TableHead className="w-28">Qty / Unit</TableHead>
              <TableHead className="w-32">Rate ({currency === 'INR' ? '₹' : currency})</TableHead>
              <TableHead className="w-24">GST%</TableHead>
              <TableHead className="text-right">Amount ({currency === 'INR' ? '₹' : currency})</TableHead>
              <TableHead className="w-16 text-center">Action</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {lines.map((l, i) => {
                const qty = Number(l.quantity) || 0;
                const rate = Number(l.rate) || 0;
                const taxRate = vendorHasGst ? (Number(l.tax_rate) || 0) : 0;
                const base = qty * rate;
                const taxAmt = base * (taxRate / 100);
                const lineIgst = isInterstate ? taxAmt : 0;
                const lineCgst = isInterstate ? 0 : taxAmt / 2;
                const lineSgst = isInterstate ? 0 : taxAmt / 2;
                const lineTotal = base + taxAmt;

                return (
                  <TableRow key={i} className="hover:bg-slate-50/50">
                    <TableCell className="text-slate-500 font-medium text-sm">{i + 1}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <Select value={l.item_id} onValueChange={(v) => {
                          if (v === "new") {
                            setNewItemTargetLine(i);
                            setCreateItemOpen(true);
                          } else {
                            pickItem(i, v);
                          }
                        }}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Item" /></SelectTrigger>
                          <SelectContent>
                            {items.map(it => <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>)}
                            <SelectItem value="new" className="text-primary font-medium cursor-pointer">+ Create New Item</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input value={l.description} onChange={e => { const x = [...lines]; x[i].description = e.target.value; setLines(x); }} className="h-7 text-xs px-2" placeholder="Description..." />
                      </div>
                    </TableCell>
                    <TableCell><Input value={l.hsn} onChange={e => { const x = [...lines]; x[i].hsn = e.target.value; setLines(x); }} /></TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <Input type="number" value={l.quantity} onChange={e => { const x = [...lines]; x[i].quantity = e.target.value; setLines(x); }} />
                        <Select value={l.unit} onValueChange={v => { const x = [...lines]; x[i].unit = v; setLines(x); }}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Unit" /></SelectTrigger>
                          <SelectContent>
                            {["pcs", "kg", "g", "ltr", "ml", "m", "cm", "ft", "inch", "box", "nos", "hrs", "days", "pair", "set", "sqft", "sqm", "ton", "dozen", "bundle", "roll", "bag", "carton"].map(u => (
                              <SelectItem key={u} value={u}>{u}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                    <TableCell><Input type="number" value={l.rate} onChange={e => { const x = [...lines]; x[i].rate = e.target.value; setLines(x); }} /></TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={vendorHasGst ? l.tax_rate : "0"}
                        onChange={e => { const x = [...lines]; x[i].tax_rate = e.target.value; setLines(x); }}
                        disabled={!vendorHasGst}
                        className={!vendorHasGst ? "opacity-50 min-w-[70px]" : "min-w-[70px]"}
                      />
                    </TableCell>

                    <TableCell className="text-right font-bold text-slate-900">{formatCurrency(lineTotal, currency)}</TableCell>
                    <TableCell className="text-center">
                      <Button size="icon" variant="ghost" className="h-8 w-8 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 rounded-md" onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="mt-6 flex justify-end">
            <div className="w-80 bg-slate-50/80 rounded-xl p-4 border shadow-sm space-y-2.5 text-sm">
              <div className="flex justify-between items-center text-slate-600">
                <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-slate-400" /> <span>Subtotal</span></div>
                <span className="font-medium text-slate-900">{formatCurrency(totals.sub, currency)}</span>
              </div>
              {vendorHasGst && Object.entries(totals.breakdown).map(([rateStr, amt]) => {
                const rate = Number(rateStr);
                const amount = Number(amt);
                if (isInterstate) {
                  return (
                    <div key={rate} className="flex justify-between items-center text-slate-600">
                      <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-slate-400" /> <span>IGST ({rate}%)</span></div>
                      <span>{formatCurrency(amount, currency)}</span>
                    </div>
                  );
                } else {
                  return (
                    <React.Fragment key={rate}>
                      <div className="flex justify-between items-center text-slate-600">
                        <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-slate-400" /> <span>CGST ({rate / 2}%)</span></div>
                        <span>{formatCurrency(amount / 2, currency)}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600">
                        <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-slate-400" /> <span>SGST ({rate / 2}%)</span></div>
                        <span>{formatCurrency(amount / 2, currency)}</span>
                      </div>
                    </React.Fragment>
                  );
                }
              })}
              {!vendorHasGst && vendorId && (
                <div className="flex justify-between items-center text-amber-600">
                  <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-amber-400" /> <span>GST</span></div>
                  <span>N/A</span>
                </div>
              )}
              <div className="flex justify-between items-center font-bold text-base border-t border-slate-200 border-dashed pt-3 text-blue-700 mt-2">
                <div className="flex items-center gap-2"><span>Total</span></div>
                <span>{formatCurrency(totals.total, currency)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3 border-b bg-slate-50/50">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 bg-blue-100 text-blue-700 rounded-md flex items-center justify-center">
                <FileText className="h-3.5 w-3.5" />
              </div>
              <CardTitle className="text-sm font-semibold text-blue-700">Notes</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <Textarea 
              value={notes} 
              onChange={e => setNotes(e.target.value)} 
              rows={3} 
              placeholder="Add any notes for this purchase order..."
              className="resize-none bg-slate-50/50 border-slate-200 text-sm"
              maxLength={500}
            />
            <div className="text-right text-xs text-slate-400 mt-2">{notes.length} / 500</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3 border-b bg-slate-50/50">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 bg-blue-100 text-blue-700 rounded-md flex items-center justify-center">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
              <CardTitle className="text-sm font-semibold text-blue-700">Terms</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <Textarea 
              value={terms} 
              onChange={e => setTerms(e.target.value)} 
              rows={3} 
              placeholder="Select payment terms (optional)..."
              className="resize-none bg-slate-50/50 border-slate-200 text-sm"
            />
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Calendar className="h-3.5 w-3.5" />
              Payment is due as per the selected terms.
            </div>
          </CardContent>
        </Card>
      </div>

      <AddItemDialog
        open={createItemOpen}
        onOpenChange={setCreateItemOpen}
        taxRates={taxRates}
        onItemAdded={(item) => {
          setItems((prev: any[]) => [...prev, item]);
          if (newItemTargetLine !== null) {
            const newLines = [...lines];
            newLines[newItemTargetLine] = {
              ...newLines[newItemTargetLine],
              item_id: item.id,
              description: item.name,
              hsn: item.hsn_code || "",
              unit: (item as any).unit || "pcs",
              rate: String(item.unit_price || 0),
              tax_rate: item.tax_id ? String(taxRates.find((t: any) => t.id === item.tax_id)?.rate || 0) : "0",
            };
            setLines(newLines);
            setNewItemTargetLine(null);
          }
        }}
      />

      {/* Bulk Add Items Dialog */}
      <Dialog open={bulkAddOpen} onOpenChange={setBulkAddOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Add Items</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No items in catalog. Add items first.</p>
            ) : (
              <>
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Checkbox
                    checked={bulkSelected.size === items.length}
                    onCheckedChange={(checked) => {
                      if (checked) setBulkSelected(new Set(items.map((i: any) => i.id)));
                      else setBulkSelected(new Set());
                    }}
                  />
                  <span className="text-sm font-medium">Select All ({items.length} items)</span>
                </div>
                {items.map((item: any) => (
                  <div key={item.id} className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-accent/50">
                    <Checkbox
                      checked={bulkSelected.has(item.id)}
                      onCheckedChange={(checked) => {
                        const next = new Set(bulkSelected);
                        if (checked) next.add(item.id); else next.delete(item.id);
                        setBulkSelected(next);
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{item.name}</span>
                      {item.description && <span className="text-xs text-muted-foreground ml-2">{item.description}</span>}
                    </div>
                    <span className="text-xs text-muted-foreground">{item.unit || "pcs"}</span>
                    <span className="text-sm font-medium">{formatCurrency(Number(item.unit_price), currency)}</span>
                  </div>
                ))}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAddOpen(false)}>Cancel</Button>
            <Button
              disabled={bulkSelected.size === 0}
              onClick={() => {
                const toAdd = Array.from(bulkSelected).map(id => items.find(i => i.id === id)).filter(Boolean);
                const newLines = toAdd.map(it => ({
                  item_id: it.id, description: it.name, hsn: it.hsn || "",
                  quantity: "1", unit: it.unit || "", rate: String(it.unit_price || 0), tax_rate: String(it.tax_rate || 0)
                }));
                setLines(lines.length === 1 && !lines[0].item_id && !lines[0].description ? newLines : [...lines, ...newLines]);
                setBulkAddOpen(false);
                setBulkSelected(new Set());
              }}
            >
              Add {bulkSelected.size} Items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
