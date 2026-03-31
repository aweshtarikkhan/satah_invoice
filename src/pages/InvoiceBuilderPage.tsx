import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { useAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { CustomFieldsForm, saveCustomFieldValues } from "@/components/shared/CustomFieldsForm";
import { CURRENCIES, formatCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, Eye, Trash2, Plus, GripVertical, Printer, Share2, Clock, ChevronDown, AlertTriangle, Layers } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { InvoiceSettingsSheet } from "@/components/shared/InvoiceSettingsSheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddClientDialog } from "@/components/shared/AddClientDialog";
import { AddItemDialog } from "@/components/shared/AddItemDialog";
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
  unit: string;
  quantity: number;
  rate: number;
  discount: number;
  discount_type: "percentage" | "fixed";
  tax_id: string | null;
  tax_amount: number;
  amount: number;
}

const UNITS = ["pcs", "kg", "g", "ltr", "ml", "m", "cm", "ft", "inch", "box", "nos", "hrs", "days", "pair", "set", "sqft", "sqm", "ton", "dozen", "bundle", "roll", "bag", "carton"];

function createEmptyLine(): LineItem {
  return {
    id: crypto.randomUUID(),
    item_id: null,
    name: "",
    description: "",
    unit: "pcs",
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
  items,
  onChange,
  onRemove,
  onAddItem,
  currency,
}: {
  line: LineItem;
  index: number;
  items: any[];
  onChange: (index: number, field: string, value: any) => void;
  onRemove: (index: number) => void;
  onAddItem: () => void;
  currency: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: line.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleItemSelect = (itemId: string) => {
    if (itemId === "manual_entry") {
      onChange(index, "item_id", null);
      onChange(index, "name", "");
      return;
    }
    const item = items.find((i: any) => i.id === itemId);
    if (item) {
      onChange(index, "item_id", item.id);
      onChange(index, "name", item.name);
      onChange(index, "description", item.description || "");
      onChange(index, "rate", Number(item.unit_price));
      onChange(index, "unit", item.unit || "pcs");
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-1 py-3 border-b last:border-0">
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground shrink-0 mt-2">
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <div className="grid flex-1 grid-cols-12 gap-2 items-start">
        {/* Item Details - Name + Description */}
        <div className="col-span-5 space-y-1">
          <div className="flex gap-0.5">
            <div className="relative flex-1">
              <Input
                className="h-8 text-xs pr-7"
                placeholder="Type item name"
                value={line.name}
                onChange={(e) => onChange(index, "name", e.target.value)}
              />
              <Select value={line.item_id || ""} onValueChange={handleItemSelect}>
                <SelectTrigger className="absolute right-0 top-0 h-8 w-7 border-0 bg-transparent shadow-none px-1 focus:ring-0">
                  <ChevronDown className="h-3 w-3" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item: any) => (
                    <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <button type="button" onClick={onAddItem} className="h-8 w-8 flex items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:text-foreground hover:bg-accent shrink-0" title="Add New Item">
              <Plus className="h-3 w-3" />
            </button>
          </div>
          <Textarea
            className="text-xs min-h-[40px] resize-none"
            placeholder="Add a description to your item"
            value={line.description}
            onChange={(e) => onChange(index, "description", e.target.value)}
            rows={2}
          />
        </div>
        {/* Quantity */}
        <div className="col-span-2">
          <Input type="number" className="h-8 text-xs text-center" value={line.quantity} onChange={(e) => onChange(index, "quantity", parseFloat(e.target.value) || 0)} min={0} step="0.01" />
          {line.unit && <span className="text-[10px] text-muted-foreground text-center block mt-0.5">{line.unit}</span>}
        </div>
        {/* Rate */}
        <div className="col-span-2">
          <Input type="number" className="h-8 text-xs text-right" value={line.rate} onChange={(e) => onChange(index, "rate", parseFloat(e.target.value) || 0)} min={0} step="0.01" />
        </div>
        {/* Amount */}
        <div className="col-span-3 text-right pt-1">
          <span className="text-sm font-bold">{fmt(line.amount)}</span>
        </div>
      </div>
      <button onClick={() => onRemove(index)} className="text-muted-foreground hover:text-destructive shrink-0 mt-2 ml-1">
        <Trash2 className="h-3.5 w-3.5" />
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
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState(30);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [shippingCharge, setShippingCharge] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [adjustment, setAdjustment] = useState(0);
  const [adjustmentName, setAdjustmentName] = useState("Adjustment");
  const [lines, setLines] = useState<LineItem[]>([createEmptyLine()]);
  const [saving, setSaving] = useState(false);
  const [clientInvoices, setClientInvoices] = useState<any[]>([]);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [invoiceTaxId, setInvoiceTaxId] = useState<string | null>(null);
  const [addTaxOpen, setAddTaxOpen] = useState(false);
  const [newTaxName, setNewTaxName] = useState("");
  const [newTaxRate, setNewTaxRate] = useState("");

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

      // Auto-generate invoice number from fresh DB value
      if (!id) {
        const { data: freshOrg } = await supabase.from("organizations").select("invoice_next_number, invoice_prefix, payment_terms, default_notes, default_terms").eq("id", org.id).single();
        const prefix = freshOrg?.invoice_prefix || org.invoice_prefix || "INV";
        const num = freshOrg?.invoice_next_number || org.invoice_next_number || 1;
        const year = new Date().getFullYear();
        setInvoiceNumber(`${prefix}-${year}-${String(num).padStart(4, "0")}`);
        setPaymentTerms(freshOrg?.payment_terms || org.payment_terms || 30);
        setNotes(freshOrg?.default_notes || org.default_notes || "");
        setTerms(freshOrg?.default_terms || org.default_terms || "");
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
      setExpenses(Number((inv as any).expenses || 0));
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
          unit: l.unit || "pcs",
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

  // Fetch client pending invoices when client changes
  useEffect(() => {
    if (!clientId || !org?.id) { setClientInvoices([]); return; }
    const fetchClientInvoices = async () => {
      const { data } = await supabase
        .from("invoices")
        .select("total, balance_due, due_date, status")
        .eq("client_id", clientId)
        .eq("org_id", org.id)
        .neq("status", "void")
        .neq("status", "draft");
      setClientInvoices(data || []);
    };
    fetchClientInvoices();
  }, [clientId, org?.id]);

  const clientAgingSummary = useMemo(() => {
    if (!clientInvoices.length) return null;
    const today = new Date();
    let totalDue = 0;
    let over15 = 0;
    let over45 = 0;
    let totalBilled = 0;

    clientInvoices.forEach((inv) => {
      totalBilled += Number(inv.total);
      const bal = Number(inv.balance_due);
      if (bal <= 0) return;
      totalDue += bal;
      const dueDt = new Date(inv.due_date);
      const daysPast = Math.floor((today.getTime() - dueDt.getTime()) / (1000 * 60 * 60 * 24));
      if (daysPast > 45) over45 += bal;
      else if (daysPast > 15) over15 += bal;
    });

    return { totalBilled, totalDue, over15, over45 };
  }, [clientInvoices]);


  const calculateLine = useCallback((line: LineItem): LineItem => {
    const lineSubtotal = line.quantity * line.rate;
    const lineDiscount = line.discount_type === "percentage"
      ? lineSubtotal * (line.discount / 100)
      : line.discount;
    const afterDiscount = lineSubtotal - lineDiscount;
    return { ...line, tax_amount: 0, amount: afterDiscount };
  }, []);

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
  const invoiceTaxRate = taxRates.find((t) => t.id === invoiceTaxId);
  const totalTax = invoiceTaxRate ? discountedSubtotal * (Number(invoiceTaxRate.rate) / 100) : 0;
  const total = discountedSubtotal + totalTax + shippingCharge + adjustment - expenses;

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: org?.currency_code || "USD" }).format(n);

  const handleSave = async (status: "draft" | "sent" = "draft") => {
    if (!clientId) {
      toast({ title: "Select a client", variant: "destructive" });
      return;
    }
    // Auto-remove empty/blank lines before saving
    const validLines = lines.filter((l) => l.name.trim() || l.rate > 0 || l.quantity > 0);
    if (!validLines.length) {
      toast({ title: "Add at least one line item", variant: "destructive" });
      return;
    }
    setLines(validLines);
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
      expenses,
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
        // Increment org next number using fresh DB value
        const { data: currentOrg } = await supabase.from("organizations").select("invoice_next_number").eq("id", org!.id).single();
        const currentNum = currentOrg?.invoice_next_number || 1;
        await supabase.from("organizations").update({
          invoice_next_number: currentNum + 1,
        }).eq("id", org!.id);
      }

      // Insert lines
      const linePayloads = validLines
        .filter((l) => l.name.trim() || l.rate > 0)
        .map((l, i) => ({
          invoice_id: invoiceId!,
          item_id: l.item_id,
          name: l.name,
          description: l.description,
          unit: l.unit || "pcs",
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

      // Save custom fields
      if (invoiceId && Object.keys(customFieldValues).length > 0) {
        await saveCustomFieldValues(invoiceId, customFieldValues);
      }

      // Audit log
      if (org && user) {
        await logAudit({
          orgId: org.id, userId: user.id, entityType: "invoice",
          entityId: invoiceId, action: id ? "update" : "create",
          description: `Invoice ${invoiceNumber} ${id ? "updated" : "created"} (${status})`,
        });
      }

      // Sync client opening_balance
      if (clientId) {
        const { data: cInvoices } = await supabase.from("invoices").select("balance_due").eq("client_id", clientId);
        const totalDue = (cInvoices || []).reduce((s: number, inv: any) => s + Number(inv.balance_due), 0);
        await supabase.from("clients").update({ opening_balance: totalDue }).eq("id", clientId);
      }

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
          <InvoiceSettingsSheet />
          <Button variant="outline" onClick={() => navigate("/invoices")}>Cancel</Button>
          <Button variant="outline" onClick={() => handleSave("draft")} disabled={saving}>
            <Save className="mr-1 h-4 w-4" /> Save as Draft
          </Button>
          <div className="flex">
            <Button className="rounded-r-none" onClick={() => handleSave("sent")} disabled={saving}>
              <Eye className="mr-1 h-4 w-4" /> Save and Send
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="rounded-l-none border-l border-primary-foreground/20 px-2" disabled={saving}>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={async () => { await handleSave("sent"); setTimeout(() => window.print(), 500); }}>
                  <Printer className="mr-2 h-4 w-4" /> Save and Print
                </DropdownMenuItem>
                <DropdownMenuItem onClick={async () => {
                  await handleSave("sent");
                  // Copy portal share link
                  if (id) {
                    const { data: existing } = await supabase.from("portal_tokens").select("token").eq("entity_type", "invoice").eq("entity_id", id).maybeSingle();
                    let token = existing?.token;
                    if (!token) {
                      const { data } = await supabase.from("portal_tokens").insert({ org_id: org!.id, entity_type: "invoice", entity_id: id }).select("token").single();
                      token = data?.token;
                    }
                    if (token) {
                      await navigator.clipboard.writeText(`${window.location.origin}/portal/${token}`);
                      toast({ title: "Invoice saved & portal link copied!" });
                    }
                  }
                }}>
                  <Share2 className="mr-2 h-4 w-4" /> Save and Share
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSave("draft")}>
                  <Clock className="mr-2 h-4 w-4" /> Save and Send Later
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Client *</Label>
                <div className="flex gap-2">
                  <Select value={clientId || "placeholder"} onValueChange={(v) => { if (v !== "placeholder") setClientId(v); }}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Select client..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="placeholder" disabled>Select client...</SelectItem>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="icon" onClick={() => setAddClientOpen(true)} title="Add New Client">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <AddClientDialog open={addClientOpen} onOpenChange={setAddClientOpen} onClientAdded={(c) => { setClients(prev => [...prev, c]); setClientId(c.id); }} />
                <AddItemDialog open={addItemOpen} onOpenChange={setAddItemOpen} taxRates={taxRates} onItemAdded={(item) => { setCatalogItems(prev => [...prev, item]); }} />
                {clientId && clientAgingSummary && clientAgingSummary.totalDue > 0 && (
                  <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-orange-700 dark:text-orange-400">
                      <AlertTriangle className="h-4 w-4" />
                      Client Pending Summary
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md bg-background p-2 border">
                        <span className="text-muted-foreground">Total Billed</span>
                        <p className="font-bold text-foreground">{formatCurrency(clientAgingSummary.totalBilled, org?.currency_code || "INR")}</p>
                      </div>
                      <div className="rounded-md bg-background p-2 border border-destructive/30">
                        <span className="text-muted-foreground">Total Due</span>
                        <p className="font-bold text-destructive">{formatCurrency(clientAgingSummary.totalDue, org?.currency_code || "INR")}</p>
                      </div>
                      {clientAgingSummary.over15 > 0 && (
                        <div className="rounded-md bg-background p-2 border border-orange-300 dark:border-orange-700">
                          <span className="text-muted-foreground">15+ Days Overdue</span>
                          <p className="font-bold text-orange-600 dark:text-orange-400">{formatCurrency(clientAgingSummary.over15, org?.currency_code || "INR")}</p>
                        </div>
                      )}
                      {clientAgingSummary.over45 > 0 && (
                        <div className="rounded-md bg-background p-2 border border-destructive/50">
                          <span className="text-muted-foreground">45+ Days Overdue</span>
                          <p className="font-bold text-destructive">{formatCurrency(clientAgingSummary.over45, org?.currency_code || "INR")}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={org?.currency_code || "USD"} disabled>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom Fields */}
      <Card>
        <CardContent className="pt-6">
          <CustomFieldsForm entityType="invoice" entityId={id} onChange={setCustomFieldValues} />
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-base">Line Items</CardTitle>
          <Button variant="outline" size="sm" onClick={() => { setBulkSelected(new Set()); setBulkAddOpen(true); }}>
            <Layers className="mr-1 h-4 w-4" /> Bulk Add
          </Button>
        </CardHeader>
        <CardContent>
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider grid grid-cols-12 gap-2 px-6 pb-2 border-b">
            <div className="col-span-5">Item Details</div>
            <div className="col-span-2 text-center">Quantity</div>
            <div className="col-span-2 text-right">Rate</div>
            <div className="col-span-3 text-right">Amount</div>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={lines.map((l) => l.id)} strategy={verticalListSortingStrategy}>
              {lines.map((line, index) => (
                <SortableLineItem
                  key={line.id}
                  line={line}
                  index={index}
                  items={catalogItems}
                  onChange={handleLineChange}
                  onRemove={removeLine}
                  onAddItem={() => setAddItemOpen(true)}
                  currency={org?.currency_code || "USD"}
                />
              ))}
            </SortableContext>
          </DndContext>
          {/* Empty row placeholder */}
          <div className="flex items-center gap-1 py-3 border-b text-muted-foreground">
            <GripVertical className="h-3.5 w-3.5 opacity-30 shrink-0" />
            <div className="grid flex-1 grid-cols-12 gap-2 items-center px-1">
              <div className="col-span-5 text-xs italic cursor-pointer hover:text-foreground" onClick={addLine}>
                Type or click to select an item.
              </div>
              <div className="col-span-2 text-center text-xs">1.00</div>
              <div className="col-span-2 text-right text-xs">0.00</div>
              <div className="col-span-3 text-right text-xs">0.00</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={addLine} className="mt-2">
            <Plus className="mr-1 h-4 w-4" /> Add Line
          </Button>
        </CardContent>
      </Card>

      {/* Bulk Add Items Dialog */}
      <Dialog open={bulkAddOpen} onOpenChange={setBulkAddOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Add Items</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            {catalogItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No items in catalog. Add items first.</p>
            ) : (
              <>
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Checkbox
                    checked={bulkSelected.size === catalogItems.length}
                    onCheckedChange={(checked) => {
                      if (checked) setBulkSelected(new Set(catalogItems.map((i: any) => i.id)));
                      else setBulkSelected(new Set());
                    }}
                  />
                  <span className="text-sm font-medium">Select All ({catalogItems.length} items)</span>
                </div>
                {catalogItems.map((item: any) => (
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
                    <span className="text-sm font-medium">{formatCurrency(Number(item.unit_price), org?.currency_code || "USD")}</span>
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
                const newLines: LineItem[] = [];
                bulkSelected.forEach((itemId) => {
                  const item = catalogItems.find((i: any) => i.id === itemId);
                  if (item) {
                    let line = createEmptyLine();
                    line.item_id = item.id;
                    line.name = item.name;
                    line.description = item.description || "";
                    line.rate = Number(item.unit_price);
                    line.unit = item.unit || "pcs";
                    line.quantity = 1;
                    // Calculate amount
                    line.amount = line.quantity * line.rate;
                    newLines.push(line);
                  }
                });
                setLines((prev) => {
                  const filtered = prev.filter((l) => l.name || l.rate > 0);
                  return [...filtered, ...newLines];
                });
                setBulkAddOpen(false);
                toast({ title: `${newLines.length} items added` });
              }}
            >
              Add {bulkSelected.size} Items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                    <SelectItem value="fixed">₹</SelectItem>
                  </SelectContent>
                </Select>
                {totalDiscount > 0 && <span className="text-destructive">-{fmt(totalDiscount)}</span>}
              </div>
            </div>
            <div className="flex items-center justify-between text-sm gap-2">
              <span className="text-muted-foreground">Tax</span>
              <div className="flex items-center gap-1">
                <Select value={invoiceTaxId || "none"} onValueChange={(v) => {
                  if (v === "add_new") { setAddTaxOpen(true); return; }
                  setInvoiceTaxId(v === "none" ? null : v);
                }}>
                  <SelectTrigger className="h-7 w-32 text-xs"><SelectValue placeholder="No tax" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No tax</SelectItem>
                    {taxRates.map((t: any) => (<SelectItem key={t.id} value={t.id}>{t.name} ({t.rate}%)</SelectItem>))}
                    <SelectItem value="add_new" className="text-primary font-medium">+ Add New Tax</SelectItem>
                  </SelectContent>
                </Select>
                {totalTax > 0 && <span>+{fmt(totalTax)}</span>}
              </div>
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
              <span className="text-muted-foreground">Expenses (Fixed Cost)</span>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  className="h-7 w-24 text-xs text-right"
                  value={expenses}
                  onChange={(e) => setExpenses(parseFloat(e.target.value) || 0)}
                />
                {expenses > 0 && <span className="text-destructive">-{fmt(expenses)}</span>}
              </div>
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

      {/* Add Tax Dialog */}
      <Dialog open={addTaxOpen} onOpenChange={setAddTaxOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add New Tax Rate</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Tax Name</Label>
              <Input value={newTaxName} onChange={(e) => setNewTaxName(e.target.value)} placeholder="e.g. GST 18%" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Rate (%)</Label>
              <Input type="number" value={newTaxRate} onChange={(e) => setNewTaxRate(e.target.value)} placeholder="18" min={0} step="0.01" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTaxOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
              if (!newTaxName.trim() || !newTaxRate) { toast({ title: "Fill all fields", variant: "destructive" }); return; }
              const { data, error } = await supabase.from("tax_rates").insert({
                org_id: org!.id, name: newTaxName.trim(), rate: parseFloat(newTaxRate), type: "simple",
              }).select().single();
              if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
              setTaxRates((prev) => [...prev, data]);
              setInvoiceTaxId(data.id);
              setNewTaxName(""); setNewTaxRate("");
              setAddTaxOpen(false);
              toast({ title: `Tax "${data.name}" added` });
            }}>Add Tax</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
