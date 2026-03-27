import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, Send } from "lucide-react";
import { AddClientDialog } from "@/components/shared/AddClientDialog";
import { AddItemDialog } from "@/components/shared/AddItemDialog";

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

export default function CreditNoteBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const org = useAppStore((s) => s.organization);
  const { toast } = useToast();
  const isEdit = !!id;

  const [clients, setClients] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  const [clientId, setClientId] = useState("");
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [invoiceId, setInvoiceId] = useState("");
  const [creditNoteNumber, setCreditNoteNumber] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [lines, setLines] = useState<LineItem[]>([createEmptyLine()]);

  useEffect(() => {
    if (!org?.id) return;
    const load = async () => {
      const [c, i, t, inv] = await Promise.all([
        supabase.from("clients").select("id, display_name").eq("org_id", org.id).eq("status", "active"),
        supabase.from("items").select("*").eq("org_id", org.id).eq("is_active", true),
        supabase.from("tax_rates").select("*").eq("org_id", org.id),
        supabase.from("invoices").select("id, invoice_number, client_id").eq("org_id", org.id),
      ]);
      setClients(c.data || []);
      setItems(i.data || []);
      setTaxRates(t.data || []);
      setInvoices(inv.data || []);

      if (!isEdit) {
        const prefix = org.credit_note_prefix || "CN";
        const num = org.credit_note_next_number || 1;
        setCreditNoteNumber(`${prefix}-${new Date().getFullYear()}-${String(num).padStart(4, "0")}`);
        setNotes(org.default_notes || "");
        setTerms(org.default_terms || "");
      }
    };
    load();
  }, [org?.id]);

  useEffect(() => {
    if (!isEdit || !id) return;
    const loadCN = async () => {
      const { data: cn } = await supabase.from("credit_notes").select("*").eq("id", id).single();
      if (cn) {
        setClientId(cn.client_id);
        setInvoiceId(cn.invoice_id || "");
        setCreditNoteNumber(cn.credit_note_number);
        setIssueDate(cn.issue_date);
        setNotes(cn.notes || "");
        setTerms(cn.terms_conditions || "");
      }
      const { data: lineData } = await supabase.from("credit_note_lines").select("*").eq("credit_note_id", id).order("sort_order");
      if (lineData?.length) {
        setLines(lineData.map((l: any) => ({
          id: l.id, item_id: l.item_id, name: l.name, description: l.description || "",
          quantity: Number(l.quantity), rate: Number(l.rate), discount: Number(l.discount),
          discount_type: l.discount_type, tax_id: l.tax_id, tax_amount: Number(l.tax_amount),
          amount: Number(l.amount),
        })));
      }
    };
    loadCN();
  }, [id, isEdit]);

  const calculateLine = useCallback((line: LineItem): LineItem => {
    let lineTotal = line.quantity * line.rate;
    if (line.discount > 0) {
      lineTotal -= line.discount_type === "percentage" ? lineTotal * (line.discount / 100) : line.discount;
    }
    let taxAmt = 0;
    if (line.tax_id) {
      const tax = taxRates.find((t) => t.id === line.tax_id);
      if (tax) taxAmt = lineTotal * (Number(tax.rate) / 100);
    }
    return { ...line, tax_amount: taxAmt, amount: lineTotal + taxAmt };
  }, [taxRates]);

  const handleLineChange = (index: number, field: string, value: any) => {
    setLines((prev) => {
      const updated = [...prev];
      if (field === "item_id" && value) {
        const item = items.find((i) => i.id === value);
        if (item) {
          updated[index] = calculateLine({
            ...updated[index], item_id: value, name: item.name,
            description: item.description || "", rate: Number(item.unit_price),
            tax_id: item.tax_id,
          });
          return updated;
        }
      }
      updated[index] = calculateLine({ ...updated[index], [field]: value });
      return updated;
    });
  };

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.rate, 0);
  const totalDiscount = lines.reduce((s, l) => {
    const lt = l.quantity * l.rate;
    return s + (l.discount_type === "percentage" ? lt * (l.discount / 100) : l.discount);
  }, 0);
  const totalTax = lines.reduce((s, l) => s + l.tax_amount, 0);
  const total = subtotal - totalDiscount + totalTax;

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: org?.currency_code || "USD" }).format(n);

  const handleSave = async (status: "draft" | "sent" = "draft") => {
    if (!clientId || lines.every((l) => !l.name.trim())) {
      toast({ title: "Please select a client and add items", variant: "destructive" });
      return;
    }
    const cnData = {
      org_id: org!.id, client_id: clientId, invoice_id: invoiceId || null,
      credit_note_number: creditNoteNumber, status, issue_date: issueDate,
      currency_code: org!.currency_code, subtotal, total_tax: totalTax,
      total_discount: totalDiscount, total, notes: notes || null,
      terms_conditions: terms || null,
    };

    let cnId = id;
    if (isEdit) {
      await supabase.from("credit_notes").update(cnData).eq("id", id!);
      await supabase.from("credit_note_lines").delete().eq("credit_note_id", id!);
    } else {
      const { data } = await supabase.from("credit_notes").insert(cnData).select().single();
      cnId = data?.id;
      await supabase.from("organizations").update({
        credit_note_next_number: (org!.credit_note_next_number || 1) + 1,
      }).eq("id", org!.id);
    }

    if (cnId) {
      const lineInserts = lines.filter((l) => l.name.trim()).map((l, i) => ({
        credit_note_id: cnId!, item_id: l.item_id, name: l.name,
        description: l.description || null, quantity: l.quantity, rate: l.rate,
        discount: l.discount, discount_type: l.discount_type, tax_id: l.tax_id,
        tax_amount: l.tax_amount, amount: l.amount, sort_order: i,
      }));
      await supabase.from("credit_note_lines").insert(lineInserts);
    }

    toast({ title: status === "sent" ? "Credit note sent!" : "Credit note saved!" });
    navigate("/credit-notes");
  };

  const filteredInvoices = clientId ? invoices.filter((inv) => inv.client_id === clientId) : invoices;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <PageHeader title={isEdit ? "Edit Credit Note" : "New Credit Note"}>
        <Button variant="outline" onClick={() => handleSave("draft")}><Save className="mr-1 h-4 w-4" /> Save Draft</Button>
        <Button onClick={() => handleSave("sent")}><Send className="mr-1 h-4 w-4" /> Save & Send</Button>
      </PageHeader>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Client *</Label>
              <div className="flex gap-2">
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" onClick={() => setAddClientOpen(true)} title="Add New Client">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <AddClientDialog open={addClientOpen} onOpenChange={setAddClientOpen} onClientAdded={(c) => { setClients(prev => [...prev, c]); setClientId(c.id); }} />
            </div>
            <div className="space-y-2">
              <Label>Against Invoice (optional)</Label>
              <Select value={invoiceId} onValueChange={setInvoiceId}>
                <SelectTrigger><SelectValue placeholder="Select invoice" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {filteredInvoices.map((inv) => <SelectItem key={inv.id} value={inv.id}>{inv.invoice_number}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Credit Note #</Label>
              <Input value={creditNoteNumber} onChange={(e) => setCreditNoteNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Issue Date</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Item</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-20">Qty</TableHead>
                <TableHead className="w-24">Rate</TableHead>
                <TableHead className="w-24">Tax</TableHead>
                <TableHead className="w-24 text-right">Amount</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line, idx) => (
                <TableRow key={line.id}>
                  <TableCell>
                    <Select value={line.item_id || ""} onValueChange={(v) => handleLineChange(idx, "item_id", v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select item" /></SelectTrigger>
                      <SelectContent>
                        {items.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input className="mt-1 h-8 text-xs" value={line.name} onChange={(e) => handleLineChange(idx, "name", e.target.value)} placeholder="Item name" />
                  </TableCell>
                  <TableCell><Input className="h-8 text-xs" value={line.description} onChange={(e) => handleLineChange(idx, "description", e.target.value)} /></TableCell>
                  <TableCell><Input className="h-8 text-xs" type="number" value={line.quantity} onChange={(e) => handleLineChange(idx, "quantity", parseFloat(e.target.value) || 0)} /></TableCell>
                  <TableCell><Input className="h-8 text-xs" type="number" value={line.rate} onChange={(e) => handleLineChange(idx, "rate", parseFloat(e.target.value) || 0)} /></TableCell>
                  <TableCell>
                    <Select value={line.tax_id || ""} onValueChange={(v) => handleLineChange(idx, "tax_id", v || null)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="No tax" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No tax</SelectItem>
                        {taxRates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} ({t.rate}%)</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">{fmt(line.amount)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLines((p) => p.filter((_, i) => i !== idx))} disabled={lines.length <= 1}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setLines((p) => [...p, createEmptyLine()])}>
            <Plus className="mr-1 h-4 w-4" /> Add Line
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-2"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div className="space-y-2"><Label>Terms & Conditions</Label><Textarea value={terms} onChange={(e) => setTerms(e.target.value)} /></div>
        </div>
        <Card>
          <CardContent className="pt-6 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmt(subtotal)}</span></div>
            {totalDiscount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="text-destructive">-{fmt(totalDiscount)}</span></div>}
            {totalTax > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>+{fmt(totalTax)}</span></div>}
            <div className="flex justify-between border-t pt-2 font-bold text-base"><span>Total</span><span>{fmt(total)}</span></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
