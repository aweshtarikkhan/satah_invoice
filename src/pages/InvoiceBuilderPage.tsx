import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { useAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { CustomFieldsForm, saveCustomFieldValues } from "@/components/shared/CustomFieldsForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, Eye, Trash2, Plus, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
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
    id: crypto.randomUUID(),
    item_id: null,
    name: "",
    description: "",
    quantity: 1,
    rate: 0,
    discount: 0,
    discount_type: "percentage",
    tax_id: null,
    tax_amount: 0,
    amount: 0,
  };
}

function SortableLineItem({
  line,
  index,
  taxRates,
  items,
  onChange,
  onRemove,
  currency,
}: {
  line: LineItem;
  index: number;
  taxRates: any[];
  items: any[];
  onChange: (index: number, field: string, value: any) => void;
  onRemove: (index: number) => void;
  currency: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: line.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleItemSelect = (itemId: string) => {
    if (itemId === "none") {
      onChange(index, "item_id", null);
      return;
    }
    const item = items.find((i: any) => i.id === itemId);
    if (item) {
      onChange(index, "item_id", item.id);
      onChange(index, "name", item.name);
      onChange(index, "description", item.description || "");
      onChange(index, "rate", Number(item.unit_price));
      if (item.tax_id) onChange(index, "tax_id", item.tax_id);
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2 py-2 border-b last:border-0">
      <button {...attributes} {...listeners} className="mt-3 cursor-grab text-muted-foreground hover:text-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="grid flex-1 grid-cols-12 gap-2">
        <div className="col-span-3">
          <Select value={line.item_id || "none"} onValueChange={handleItemSelect}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Select item..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Custom item</SelectItem>
              {items.map((item: any) => (
                <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="mt-1 h-8 text-xs"
            placeholder="Item name"
            value={line.name}
            onChange={(e) => onChange(index, "name", e.target.value)}
          />
        </div>
        <div className="col-span-3">
          <Textarea
            className="min-h-[60px] text-xs"
            placeholder="Description"
            value={line.description}
            onChange={(e) => onChange(index, "description", e.target.value)}
          />
        </div>
        <div className="col-span-1">
          <Input
            type="number"
            className="h-9 text-xs text-center"
            value={line.quantity}
            onChange={(e) => onChange(index, "quantity", parseFloat(e.target.value) || 0)}
            min={0}
            step="0.01"
          />
          <span className="text-[10px] text-muted-foreground">Qty</span>
        </div>
        <div className="col-span-2">
          <Input
            type="number"
            className="h-9 text-xs"
            value={line.rate}
            onChange={(e) => onChange(index, "rate", parseFloat(e.target.value) || 0)}
            min={0}
            step="0.01"
          />
          <span className="text-[10px] text-muted-foreground">Rate</span>
        </div>
        <div className="col-span-1">
          <Select value={line.tax_id || "none"} onValueChange={(v) => onChange(index, "tax_id", v === "none" ? null : v)}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Tax" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No tax</SelectItem>
              {taxRates.map((t: any) => (
                <SelectItem key={t.id} value={t.id}>{t.rate}%</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-[10px] text-muted-foreground">Tax</span>
        </div>
        <div className="col-span-2 text-right">
          <div className="h-9 flex items-center justify-end text-sm font-medium">
            {fmt(line.amount)}
          </div>
          {line.tax_amount > 0 && (
            <span className="text-[10px] text-muted-foreground">+{fmt(line.tax_amount)} tax</span>
          )}
        </div>
      </div>
      <button onClick={() => onRemove(index)} className="mt-3 text-muted-foreground hover:text-destructive">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function InvoiceBuilderPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const org = useAppStore((s) => s.organization);
  const { toast } = useToast();
  const { user } = useAuth();
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  const [clients, setClients] = useState<any[]>([]);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [taxRates, setTaxRates] = useState<any[]>([]);

  const [clientId, setClientId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState(30);
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

  // Fetch reference data
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

      // Auto-generate invoice number
      if (!id) {
        const prefix = org.invoice_prefix || "INV";
        const num = org.invoice_next_number || 1;
        const year = new Date().getFullYear();
        setInvoiceNumber(`${prefix}-${year}-${String(num).padStart(4, "0")}`);
        setPaymentTerms(org.payment_terms || 30);
        setNotes(org.default_notes || "");
        setTerms(org.default_terms || "");
      }
    };
    fetchData();
  }, [org?.id, id]);

  // Update due date when issue date or payment terms change
  useEffect(() => {
    if (issueDate) {
      const d = new Date(issueDate);
      d.setDate(d.getDate() + paymentTerms);
      setDueDate(d.toISOString().split("T")[0]);
    }
  }, [issueDate, paymentTerms]);

  // Load existing invoice for editing
  useEffect(() => {
    if (!id || !org?.id) return;
    const loadInvoice = async () => {
      const { data: inv } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", id)
        .single();
      if (!inv) return;

      setClientId(inv.client_id);
      setInvoiceNumber(inv.invoice_number);
      setIssueDate(inv.issue_date);
      setDueDate(inv.due_date);
      setNotes(inv.notes || "");
      setTerms(inv.terms_conditions || "");
      setDiscount(Number(inv.discount));
      setDiscountType(inv.discount_type as any);
      setShippingCharge(Number(inv.shipping_charge));
      setAdjustment(Number(inv.adjustment));
      setAdjustmentName(inv.adjustment_name || "Adjustment");

      const { data: lineData } = await supabase
        .from("invoice_lines")
        .select("*")
        .eq("invoice_id", id)
        .order("sort_order");

      if (lineData?.length) {
        setLines(lineData.map((l) => ({
          id: l.id,
          item_id: l.item_id,
          name: l.name,
          description: l.description || "",
          quantity: Number(l.quantity),
          rate: Number(l.rate),
          discount: Number(l.discount),
          discount_type: l.discount_type as any,
          tax_id: l.tax_id,
          tax_amount: Number(l.tax_amount),
          amount: Number(l.amount),
        })));
      }
    };
    loadInvoice();
  }, [id, org?.id]);

  // Calculate line amounts
  const calculateLine = useCallback((line: LineItem): LineItem => {
    const lineSubtotal = line.quantity * line.rate;
    const lineDiscount = line.discount_type === "percentage"
      ? lineSubtotal * (line.discount / 100)
      : line.discount;
    const afterDiscount = lineSubtotal - lineDiscount;
    const taxRate = taxRates.find((t) => t.id === line.tax_id);
    const taxAmount = taxRate ? afterDiscount * (Number(taxRate.rate) / 100) : 0;
    return { ...line, tax_amount: taxAmount, amount: afterDiscount };
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
        const oldIndex = prev.findIndex((l) => l.id === active.id);
        const newIndex = prev.findIndex((l) => l.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  // Totals
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const totalDiscount = discountType === "percentage" ? subtotal * (discount / 100) : discount;
  const discountedSubtotal = subtotal - totalDiscount;
  const totalTax = lines.reduce((s, l) => s + l.tax_amount, 0);
  const total = discountedSubtotal + totalTax + shippingCharge + adjustment;

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: org?.currency_code || "USD" }).format(n);

  const handleSave = async (status: "draft" | "sent" = "draft") => {
    if (!clientId) {
      toast({ title: "Select a client", variant: "destructive" });
      return;
    }
    if (!lines.some((l) => l.name.trim())) {
      toast({ title: "Add at least one line item", variant: "destructive" });
      return;
    }
    setSaving(true);

    const invoicePayload = {
      org_id: org!.id,
      client_id: clientId,
      invoice_number: invoiceNumber,
      status,
      issue_date: issueDate,
      due_date: dueDate,
      currency_code: org!.currency_code,
      discount,
      discount_type: discountType,
      shipping_charge: shippingCharge,
      adjustment,
      adjustment_name: adjustmentName,
      subtotal,
      total_tax: totalTax,
      total_discount: totalDiscount,
      total,
      balance_due: total,
      notes,
      terms_conditions: terms,
      ...(status === "sent" ? { sent_at: new Date().toISOString() } : {}),
    };

    try {
      let invoiceId = id;
      if (id) {
        const { error } = await supabase.from("invoices").update(invoicePayload).eq("id", id);
        if (error) throw error;
        // Delete old lines and re-insert
        await supabase.from("invoice_lines").delete().eq("invoice_id", id);
      } else {
        const { data, error } = await supabase.from("invoices").insert(invoicePayload).select().single();
        if (error) throw error;
        invoiceId = data.id;
        // Increment org next number
        await supabase.from("organizations").update({
          invoice_next_number: (org!.invoice_next_number || 1) + 1,
        }).eq("id", org!.id);
      }

      // Insert lines
      const linePayloads = lines
        .filter((l) => l.name.trim())
        .map((l, i) => ({
          invoice_id: invoiceId!,
          item_id: l.item_id,
          name: l.name,
          description: l.description,
          quantity: l.quantity,
          rate: l.rate,
          discount: l.discount,
          discount_type: l.discount_type,
          tax_id: l.tax_id,
          tax_amount: l.tax_amount,
          amount: l.amount,
          sort_order: i,
        }));

      const { error: lineError } = await supabase.from("invoice_lines").insert(linePayloads);
      if (lineError) throw lineError;

      toast({ title: status === "sent" ? "Invoice sent!" : "Invoice saved!" });
      navigate(`/invoices`);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave("draft");
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [clientId, lines, subtotal]);

  // Auto-save every 60s
  useEffect(() => {
    if (!clientId || !lines.some((l) => l.name.trim())) return;
    const interval = setInterval(() => {
      if (id) handleSave("draft");
    }, 60000);
    return () => clearInterval(interval);
  }, [id, clientId, lines]);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{id ? "Edit Invoice" : "New Invoice"}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/invoices")}>Cancel</Button>
          <Button variant="outline" onClick={() => handleSave("draft")} disabled={saving}>
            <Save className="mr-1 h-4 w-4" /> Save Draft
          </Button>
          <Button onClick={() => handleSave("sent")} disabled={saving}>
            <Eye className="mr-1 h-4 w-4" /> Save & Send
          </Button>
        </div>
      </div>

      {/* Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Client *</Label>
                <Select value={clientId || "placeholder"} onValueChange={(v) => v !== "placeholder" && setClientId(v)}>
                  <SelectTrigger><SelectValue placeholder="Select client..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="placeholder" disabled>Select client...</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Invoice #</Label>
                  <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Payment Terms</Label>
                  <Select value={String(paymentTerms)} onValueChange={(v) => setPaymentTerms(parseInt(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">Net 15</SelectItem>
                      <SelectItem value="30">Net 30</SelectItem>
                      <SelectItem value="45">Net 45</SelectItem>
                      <SelectItem value="60">Net 60</SelectItem>
                      <SelectItem value="0">Due on Receipt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Issue Date</Label>
                  <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs font-medium text-muted-foreground grid grid-cols-12 gap-2 px-6 pb-2 border-b">
            <div className="col-span-3">Item</div>
            <div className="col-span-3">Description</div>
            <div className="col-span-1 text-center">Qty</div>
            <div className="col-span-2">Rate</div>
            <div className="col-span-1">Tax</div>
            <div className="col-span-2 text-right">Amount</div>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={lines.map((l) => l.id)} strategy={verticalListSortingStrategy}>
              {lines.map((line, index) => (
                <SortableLineItem
                  key={line.id}
                  line={line}
                  index={index}
                  taxRates={taxRates}
                  items={catalogItems}
                  onChange={handleLineChange}
                  onRemove={removeLine}
                  currency={org?.currency_code || "USD"}
                />
              ))}
            </SortableContext>
          </DndContext>
          <Button variant="ghost" size="sm" onClick={addLine} className="mt-2">
            <Plus className="mr-1 h-4 w-4" /> Add Line
          </Button>
        </CardContent>
      </Card>

      {/* Totals & Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes visible on invoice..." />
          </div>
          <div className="space-y-2">
            <Label>Terms & Conditions</Label>
            <Textarea value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Payment terms, late fees..." />
          </div>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{fmt(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm gap-2">
              <span className="text-muted-foreground">Discount</span>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  className="h-7 w-16 text-xs text-right"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                />
                <Select value={discountType} onValueChange={(v) => setDiscountType(v as any)}>
                  <SelectTrigger className="h-7 w-14 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">%</SelectItem>
                    <SelectItem value="fixed">$</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-destructive">-{fmt(totalDiscount)}</span>
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span>+{fmt(totalTax)}</span>
            </div>
            <div className="flex items-center justify-between text-sm gap-2">
              <span className="text-muted-foreground">Shipping</span>
              <Input
                type="number"
                className="h-7 w-24 text-xs text-right"
                value={shippingCharge}
                onChange={(e) => setShippingCharge(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="flex items-center justify-between text-sm gap-2">
              <Input
                className="h-7 w-24 text-xs"
                value={adjustmentName}
                onChange={(e) => setAdjustmentName(e.target.value)}
              />
              <Input
                type="number"
                className="h-7 w-24 text-xs text-right"
                value={adjustment}
                onChange={(e) => setAdjustment(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="border-t pt-3 flex justify-between text-lg font-bold">
              <span>Total</span>
              <span>{fmt(total)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
