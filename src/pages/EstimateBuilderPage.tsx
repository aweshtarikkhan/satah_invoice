import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, Trash2, Plus, GripVertical } from "lucide-react";
import { AddClientDialog } from "@/components/shared/AddClientDialog";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface LineItem {
  id: string;
  item_id: string | null;
  name: string;
  description: string;
  quantity: number;
  rate: number;
  discount: number;
  discount_type: "percentage" | "fixed";
  tax_id: string | null;
  tax_amount: number;
  amount: number;
}

function createEmptyLine(): LineItem {
  return {
    id: crypto.randomUUID(), item_id: null, name: "", description: "",
    quantity: 1, rate: 0, discount: 0, discount_type: "percentage",
    tax_id: null, tax_amount: 0, amount: 0,
  };
}

function SortableLine({ line, index, taxRates, items, onChange, onRemove, currency }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: line.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

  const handleItemSelect = (itemId: string) => {
    if (itemId === "none") { onChange(index, "item_id", null); return; }
    const item = items.find((i: any) => i.id === itemId);
    if (item) {
      onChange(index, "item_id", item.id);
      onChange(index, "name", item.name);
      onChange(index, "description", item.description || "");
      onChange(index, "rate", Number(item.unit_price));
      if (item.tax_id) onChange(index, "tax_id", item.tax_id);
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2 py-2 border-b last:border-0">
      <button {...attributes} {...listeners} className="mt-3 cursor-grab text-muted-foreground hover:text-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="grid flex-1 grid-cols-12 gap-2">
        <div className="col-span-3">
          <Select value={line.item_id || "none"} onValueChange={handleItemSelect}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select item..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Custom item</SelectItem>
              {items.map((item: any) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input className="mt-1 h-8 text-xs" placeholder="Item name" value={line.name}
            onChange={(e) => onChange(index, "name", e.target.value)} />
        </div>
        <div className="col-span-3">
          <Textarea className="min-h-[60px] text-xs" placeholder="Description" value={line.description}
            onChange={(e) => onChange(index, "description", e.target.value)} />
        </div>
        <div className="col-span-1">
          <Input type="number" className="h-9 text-xs text-center" value={line.quantity}
            onChange={(e) => onChange(index, "quantity", parseFloat(e.target.value) || 0)} min={0} step="0.01" />
          <span className="text-[10px] text-muted-foreground">Qty</span>
        </div>
        <div className="col-span-2">
          <Input type="number" className="h-9 text-xs" value={line.rate}
            onChange={(e) => onChange(index, "rate", parseFloat(e.target.value) || 0)} min={0} step="0.01" />
          <span className="text-[10px] text-muted-foreground">Rate</span>
        </div>
        <div className="col-span-1">
          <Select value={line.tax_id || "none"} onValueChange={(v) => onChange(index, "tax_id", v === "none" ? null : v)}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Tax" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No tax</SelectItem>
              {taxRates.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.rate}%</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-[10px] text-muted-foreground">Tax</span>
        </div>
        <div className="col-span-2 text-right">
          <div className="h-9 flex items-center justify-end text-sm font-medium">{fmt(line.amount)}</div>
          {line.tax_amount > 0 && <span className="text-[10px] text-muted-foreground">+{fmt(line.tax_amount)} tax</span>}
        </div>
      </div>
      <button onClick={() => onRemove(index)} className="mt-3 text-muted-foreground hover:text-destructive">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function EstimateBuilderPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const org = useAppStore((s) => s.organization);
  const { toast } = useToast();

  const [clients, setClients] = useState<any[]>([]);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [clientId, setClientId] = useState("");
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [estimateNumber, setEstimateNumber] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [shippingCharge, setShippingCharge] = useState(0);
  const [adjustment, setAdjustment] = useState(0);
  const [adjustmentName, setAdjustmentName] = useState("Adjustment");
  const [lines, setLines] = useState<LineItem[]>([createEmptyLine()]);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (!org?.id) return;
    const fetchData = async () => {
      const [c, i, t] = await Promise.all([
        supabase.from("clients").select("*").eq("org_id", org.id).eq("status", "active").order("display_name"),
        supabase.from("items").select("*").eq("org_id", org.id).eq("is_active", true).order("name"),
        supabase.from("tax_rates").select("*").eq("org_id", org.id),
      ]);
      setClients(c.data || []);
      setCatalogItems(i.data || []);
      setTaxRates(t.data || []);
      if (!id) {
        const prefix = org.estimate_prefix || "EST";
        const num = (org as any).estimate_next_number || 1;
        const year = new Date().getFullYear();
        setEstimateNumber(`${prefix}-${year}-${String(num).padStart(4, "0")}`);
        setNotes(org.default_notes || "");
        setTerms(org.default_terms || "");
      }
    };
    fetchData();
  }, [org?.id, id]);

  useEffect(() => {
    if (issueDate) {
      const d = new Date(issueDate);
      d.setDate(d.getDate() + 30);
      setExpiryDate(d.toISOString().split("T")[0]);
    }
  }, [issueDate]);

  useEffect(() => {
    if (!id || !org?.id) return;
    const load = async () => {
      const { data: est } = await supabase.from("estimates").select("*").eq("id", id).single();
      if (!est) return;
      setClientId(est.client_id);
      setEstimateNumber(est.estimate_number);
      setIssueDate(est.issue_date);
      setExpiryDate(est.expiry_date);
      setNotes(est.notes || "");
      setTerms(est.terms_conditions || "");
      setDiscount(Number(est.discount));
      setDiscountType(est.discount_type as any);
      setShippingCharge(Number(est.shipping_charge));
      setAdjustment(Number(est.adjustment));
      setAdjustmentName(est.adjustment_name || "Adjustment");

      const { data: lineData } = await supabase.from("estimate_lines").select("*").eq("estimate_id", id).order("sort_order");
      if (lineData?.length) {
        setLines(lineData.map((l) => ({
          id: l.id, item_id: l.item_id, name: l.name, description: l.description || "",
          quantity: Number(l.quantity), rate: Number(l.rate), discount: Number(l.discount),
          discount_type: l.discount_type as any, tax_id: l.tax_id,
          tax_amount: Number(l.tax_amount), amount: Number(l.amount),
        })));
      }
    };
    load();
  }, [id, org?.id]);

  const calculateLine = useCallback((line: LineItem): LineItem => {
    const sub = line.quantity * line.rate;
    const disc = line.discount_type === "percentage" ? sub * (line.discount / 100) : line.discount;
    const after = sub - disc;
    const tr = taxRates.find((t) => t.id === line.tax_id);
    const tax = tr ? after * (Number(tr.rate) / 100) : 0;
    return { ...line, tax_amount: tax, amount: after };
  }, [taxRates]);

  const handleLineChange = (index: number, field: string, value: any) => {
    setLines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      updated[index] = calculateLine(updated[index]);
      return updated;
    });
  };

  const addLine = () => setLines((prev) => [...prev, createEmptyLine()]);
  const removeLine = (index: number) => setLines((prev) => prev.filter((_, i) => i !== index));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setLines((prev) => {
        const oi = prev.findIndex((l) => l.id === active.id);
        const ni = prev.findIndex((l) => l.id === over.id);
        return arrayMove(prev, oi, ni);
      });
    }
  };

  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const totalDiscount = discountType === "percentage" ? subtotal * (discount / 100) : discount;
  const discountedSubtotal = subtotal - totalDiscount;
  const totalTax = lines.reduce((s, l) => s + l.tax_amount, 0);
  const total = discountedSubtotal + totalTax + shippingCharge + adjustment;
  const currency = org?.currency_code || "USD";
  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

  const handleSave = async (status: "draft" | "sent" = "draft") => {
    if (!clientId) { toast({ title: "Select a client", variant: "destructive" }); return; }
    if (!lines.some((l) => l.name.trim())) { toast({ title: "Add at least one line item", variant: "destructive" }); return; }
    setSaving(true);

    const payload = {
      org_id: org!.id, client_id: clientId, estimate_number: estimateNumber, status,
      issue_date: issueDate, expiry_date: expiryDate, currency_code: currency,
      discount, discount_type: discountType, shipping_charge: shippingCharge,
      adjustment, adjustment_name: adjustmentName, subtotal, total_tax: totalTax,
      total_discount: totalDiscount, total, notes, terms_conditions: terms,
      ...(status === "sent" ? { sent_at: new Date().toISOString() } : {}),
    };

    try {
      let estimateId = id;
      if (id) {
        const { error } = await supabase.from("estimates").update(payload).eq("id", id);
        if (error) throw error;
        await supabase.from("estimate_lines").delete().eq("estimate_id", id);
      } else {
        const { data, error } = await supabase.from("estimates").insert(payload).select().single();
        if (error) throw error;
        estimateId = data.id;
        await supabase.from("organizations").update({
          estimate_next_number: ((org as any).estimate_next_number || 1) + 1,
        }).eq("id", org!.id);
      }

      const linePayloads = lines.filter((l) => l.name.trim()).map((l, i) => ({
        estimate_id: estimateId!, item_id: l.item_id, name: l.name, description: l.description,
        quantity: l.quantity, rate: l.rate, discount: l.discount, discount_type: l.discount_type,
        tax_id: l.tax_id, tax_amount: l.tax_amount, amount: l.amount, sort_order: i,
      }));

      const { error: lineError } = await supabase.from("estimate_lines").insert(linePayloads);
      if (lineError) throw lineError;

      toast({ title: status === "sent" ? "Estimate sent!" : "Estimate saved!" });
      navigate("/estimates");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{id ? "Edit Estimate" : "New Estimate"}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/estimates")}>Cancel</Button>
          <Button variant="outline" onClick={() => handleSave("draft")} disabled={saving}>
            <Save className="mr-1 h-4 w-4" /> Save Draft
          </Button>
          <Button onClick={() => handleSave("sent")} disabled={saving}>Save & Send</Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Client *</Label>
                <Select value={clientId || "placeholder"} onValueChange={(v) => { if (v === "__add_new") { setAddClientOpen(true); return; } if (v !== "placeholder") setClientId(v); }}>
                  <SelectTrigger><SelectValue placeholder="Select client..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="placeholder" disabled>Select client...</SelectItem>
                    {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>)}
                    <SelectItem value="__add_new" className="text-primary font-medium border-t mt-1 pt-1">+ Add New Client</SelectItem>
                  </SelectContent>
                </Select>
                <AddClientDialog open={addClientOpen} onOpenChange={setAddClientOpen} onClientAdded={(c) => { setClients(prev => [...prev, c]); setClientId(c.id); }} />
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Estimate #</Label>
                  <Input value={estimateNumber} onChange={(e) => setEstimateNumber(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Issue Date</Label>
                  <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Line Items</h3>
            <Button size="sm" variant="outline" onClick={addLine}>
              <Plus className="mr-1 h-3 w-3" /> Add Line
            </Button>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={lines.map((l) => l.id)} strategy={verticalListSortingStrategy}>
              {lines.map((line, i) => (
                <SortableLine key={line.id} line={line} index={i} taxRates={taxRates}
                  items={catalogItems} onChange={handleLineChange} onRemove={removeLine} currency={currency} />
              ))}
            </SortableContext>
          </DndContext>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes visible to client" />
            </div>
            <div className="space-y-2">
              <Label>Terms & Conditions</Label>
              <Textarea value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Terms & conditions" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex justify-between text-sm"><span>Subtotal</span><span className="font-medium">{fmt(subtotal)}</span></div>
            <div className="flex items-center gap-2">
              <span className="text-sm flex-1">Discount</span>
              <Input type="number" className="w-20 h-8 text-xs" value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} />
              <Select value={discountType} onValueChange={(v: any) => setDiscountType(v)}>
                <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">%</SelectItem>
                  <SelectItem value="fixed">Flat</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm font-medium w-24 text-right">-{fmt(totalDiscount)}</span>
            </div>
            <div className="flex justify-between text-sm"><span>Tax</span><span className="font-medium">{fmt(totalTax)}</span></div>
            <div className="flex items-center gap-2">
              <span className="text-sm flex-1">Shipping</span>
              <Input type="number" className="w-24 h-8 text-xs" value={shippingCharge}
                onChange={(e) => setShippingCharge(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="flex items-center gap-2">
              <Input className="text-sm h-8 flex-1" value={adjustmentName}
                onChange={(e) => setAdjustmentName(e.target.value)} />
              <Input type="number" className="w-24 h-8 text-xs" value={adjustment}
                onChange={(e) => setAdjustment(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="border-t pt-3 flex justify-between text-lg font-bold">
              <span>Total</span><span>{fmt(total)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
