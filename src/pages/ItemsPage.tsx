import { useEffect, useState, useMemo } from "react";
import JsBarcode from "jsbarcode";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
import { SEO } from "@/components/shared/SEO";
import { COMMON_UNITS } from "@/lib/constants";
import { EmptyState } from "@/components/shared/EmptyState";
import { ImportDialog, ImportField } from "@/components/shared/ImportDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Package, Search, Upload, Download, Trash2, FileText, Tag, Users, Database, ArrowRight, X, Settings, Info, Ruler } from "lucide-react";
import { downloadCSV } from "@/lib/export-csv";
import { Badge } from "@/components/ui/badge";

const INDIAN_GST_SLABS = [
  { id: 'exempt', name: 'None', rate: 0 },
  { id: 'gst0', name: 'Exempted (0%)', rate: 0 },
  { id: 'gst5', name: 'GST 5%', rate: 5 },
  { id: 'gst12', name: 'GST 12%', rate: 12 },
  { id: 'gst18', name: 'GST 18%', rate: 18 },
  { id: 'gst28', name: 'GST 28%', rate: 28 },
];

const itemImportFields: ImportField[] = [
  { key: "name", label: "Item Name", required: true },
  { key: "description", label: "Description" },
  { key: "sku", label: "SKU" },
  { key: "type", label: "Product Type (service/product/goods)" },
  { key: "unit_price", label: "Rate / Price" },
  { key: "unit", label: "Unit" },
  { key: "tax_name", label: "Tax Name" },
  { key: "is_active", label: "Active (true/false)" },
];

export default function ItemsPage() {
  const org = useAppStore((s) => s.organization);
  const [items, setItems] = useState<any[]>([]);
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("basic");
  
  const [partyPrices, setPartyPrices] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [customFieldDefs, setCustomFieldDefs] = useState<any[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  
  const defaultForm = {
    name: "", description: "", sku: "", type: "product" as "service" | "product",
    unit_price: 0, sales_price_type: "with_tax",
    purchase_price: 0, purchase_price_type: "with_tax",
    discount: 0,
    unit: "pcs", tax_id: null as string | null,
    category: "", stock_quantity: 0, hsn_code: "",
    show_online: false,
    as_of_date: new Date().toISOString().split('T')[0],
    low_stock_warning: false
  };
  
  const [form, setForm] = useState(defaultForm);

  const fetchItems = async () => {
    if (!org?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("items")
      .select("*, tax_rates(name, rate)")
      .eq("org_id", org.id)
      .order("name");
    setItems(data || []);
    const { data: taxes } = await supabase
      .from("tax_rates")
      .select("*")
      .eq("org_id", org.id);
    setTaxRates(taxes || []);

    const [cRes, vRes, cfRes] = await Promise.all([
      supabase.from("clients").select("id, name").eq("org_id", org.id),
      supabase.from("vendors").select("id, name").eq("org_id", org.id),
      supabase.from("custom_field_definitions").select("*").eq("org_id", org.id).eq("entity_type", "item").order("sort_order")
    ]);
    if (cRes.data) setClients(cRes.data);
    if (vRes.data) setVendors(vRes.data);
    if (cfRes.data) setCustomFieldDefs(cfRes.data);

    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, [org?.id]);

  const resetForm = () => {
    setForm(defaultForm);
    setEditItem(null);
    setActiveTab("basic");
  };

  const categories = useMemo(() => {
    const cats = new Set(items.map((i: any) => i.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [items]);

  const openCreate = () => { 
    resetForm(); 
    setPartyPrices([]);
    setCustomFieldValues({});
    setDialogOpen(true); 
  };

  const openEdit = async (item: any) => {
    if (selected.size > 0) return;
    setEditItem(item);
    setForm({
      ...defaultForm,
      name: item.name, description: item.description || "", sku: item.sku || "",
      type: item.type || "product", unit_price: Number(item.unit_price) || 0, unit: item.unit || "pcs",
      tax_id: item.tax_id, category: item.category || "", stock_quantity: Number(item.stock_quantity || 0),
      hsn_code: item.hsn_code || "",
      purchase_price: Number(item.purchase_price) || 0,
      sales_price_type: item.sales_price_type || "with_tax",
      purchase_price_type: item.purchase_price_type || "with_tax",
      discount: Number(item.discount) || 0,
      show_online: item.show_online || false,
    });
    
    // Fetch custom field values and party prices
    const [partyRes, cfRes] = await Promise.all([
      supabase.from("item_party_prices").select("*").eq("item_id", item.id),
      supabase.from("custom_field_values").select("*").eq("entity_id", item.id)
    ]);
    setPartyPrices(partyRes.data || []);
    
    const cfMap: Record<string, any> = {};
    cfRes.data?.forEach(v => cfMap[v.field_id] = v.field_value);
    setCustomFieldValues(cfMap);

    setActiveTab("basic");
    setDialogOpen(true);
  };

  const handleSave = async (saveAndNew = false) => {
    if (!form.name.trim()) {
      toast({ title: "Item Name required", variant: "destructive" });
      setActiveTab("basic");
      return;
    }

    let finalTaxId = form.tax_id;
    // Check if they selected a hardcoded Indian slab that isn't in DB yet
    if (form.tax_id && INDIAN_GST_SLABS.some(s => s.id === form.tax_id)) {
      const slab = INDIAN_GST_SLABS.find(s => s.id === form.tax_id)!;
      const existing = taxRates.find(t => t.rate === slab.rate && t.name.toLowerCase().includes('gst'));
      if (existing) {
        finalTaxId = existing.id;
      } else {
        // Auto-create the tax rate so the foreign key doesn't fail
        const { data: newTax } = await supabase.from('tax_rates').insert({
          org_id: org!.id,
          name: slab.name,
          rate: slab.rate,
        }).select().single();
        if (newTax) {
          finalTaxId = newTax.id;
          setTaxRates(prev => [...prev, newTax]);
        }
      }
    }

    // Strip out non-DB fields to avoid PostgREST schema errors
    const payload = {
      org_id: org!.id,
      name: form.name,
      description: form.description || null,
      sku: form.sku || null,
      type: form.type,
      unit_price: form.unit_price,
      unit: form.unit || null,
      tax_id: finalTaxId,
      category: form.category || null,
      stock_quantity: form.stock_quantity,
      hsn_code: form.hsn_code || null,
      purchase_price: form.purchase_price,
      sales_price_type: form.sales_price_type,
      purchase_price_type: form.purchase_price_type,
      discount: form.discount,
      show_online: form.show_online,
    };

    let newItemId = editItem?.id;
    if (editItem) {
      const { error } = await supabase.from("items").update(payload).eq("id", editItem.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Item updated" });
    } else {
      const { data, error } = await supabase.from("items").insert(payload).select().single();
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      newItemId = data.id;
      toast({ title: "Item created" });
    }
    
    if (newItemId) {
      // Save Party Prices
      await supabase.from("item_party_prices").delete().eq("item_id", newItemId);
      if (partyPrices.length > 0) {
        await supabase.from("item_party_prices").insert(
          partyPrices.map(p => ({
            org_id: org!.id,
            item_id: newItemId,
            party_type: p.party_type,
            party_id: p.party_id,
            price: p.price
          }))
        );
      }

      // Save Custom Fields
      await supabase.from("custom_field_values").delete().eq("entity_id", newItemId);
      const cfEntries = Object.entries(customFieldValues)
        .filter(([_, val]) => val !== undefined && val !== "")
        .map(([field_id, val]) => ({
          field_id,
          entity_id: newItemId,
          field_value: val,
        }));
      if (cfEntries.length > 0) {
        await supabase.from("custom_field_values").insert(cfEntries);
      }
    }
    
    if (saveAndNew) {
      resetForm();
    } else {
      setDialogOpen(false);
      resetForm();
    }
    fetchItems();
  };

  const handleGenerateBarcode = () => {
    let sku = form.sku;
    if (!sku) {
      sku = "ITM" + Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
      setForm({ ...form, sku });
    }
    
    setTimeout(() => {
      const canvas = document.createElement("canvas");
      JsBarcode(canvas, sku, { format: "CODE128", displayValue: true, margin: 10, height: 50 });
      const url = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `barcode-${sku}.png`;
      link.href = url;
      link.click();
    }, 100);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((i) => i.id)));
    }
  };

  const handleDeleteSelected = async () => {
    setDeleting(true);
    const ids = Array.from(selected);
    // Remove references in invoice_lines, estimate_lines, credit_note_lines
    await supabase.from("invoice_lines").update({ item_id: null }).in("item_id", ids);
    await supabase.from("estimate_lines").update({ item_id: null }).in("item_id", ids);
    await supabase.from("credit_note_lines").update({ item_id: null }).in("item_id", ids);
    const { error } = await supabase.from("items").delete().in("id", ids);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${ids.length} item(s) deleted` });
    }
    setSelected(new Set());
    setDeleteOpen(false);
    setDeleting(false);
    fetchItems();
  };

  const filtered = items.filter((i) => {
    const matchSearch = [i.name, i.sku, i.description].filter(Boolean).some((f) => f.toLowerCase().includes(search.toLowerCase()));
    const matchCategory = categoryFilter === "all" || (i.category || "") === categoryFilter;
    return matchSearch && matchCategory;
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);

  const parsePrice = (val: any): number => {
    if (val == null) return 0;
    const s = String(val).replace(/[^0-9.\-]/g, "");
    return parseFloat(s) || 0;
  };

  const normalizeType = (val: any): "service" | "product" => {
    const v = String(val || "").toLowerCase().trim();
    if (v === "product" || v === "goods") return "product";
    return "service";
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Items</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Products and services catalog</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selected.size > 0 && (
            <Button variant="destructive" size="sm" className="h-10 rounded-lg" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Delete ({selected.size})
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-10 rounded-lg px-4" onClick={() => {
            downloadCSV(items.map(i => ({
              name: i.name,
              description: i.description || "",
              sku: i.sku || "",
              type: i.type,
              rate: i.unit_price,
              unit: i.unit || "",
              tax: (i as any).tax_rates?.name || "",
            })), "items");
          }}>
            <Download className="mr-1.5 h-4 w-4" /> Export
          </Button>
          <Button variant="outline" size="sm" className="h-10 rounded-lg px-4" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1.5 h-4 w-4" /> Import
          </Button>
          <Button onClick={openCreate} size="sm" className="h-10 rounded-lg px-4">
            <Plus className="mr-1.5 h-4 w-4" /> Add Item
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            className="pl-10 h-11 rounded-xl bg-card border-border/60 shadow-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-11 rounded-xl bg-card border-border/60 shadow-sm">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Package} title="No items yet" description="Add products or services to use in invoices." actionLabel="Add Item" onAction={openCreate} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Tax</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id} className="cursor-pointer" onClick={() => openEdit(item)}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(item.id)}
                        onCheckedChange={() => toggleSelect(item.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.sku || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{item.type}</Badge>
                    </TableCell>
                    <TableCell>{item.category ? <Badge variant="outline">{item.category}</Badge> : "—"}</TableCell>
                    <TableCell>{item.unit || "—"}</TableCell>
                    <TableCell className="text-right">{fmt(Number(item.unit_price))}</TableCell>
                    <TableCell className={`text-right ${org?.inventory_enabled && item.type === "product" && Number(item.stock_quantity) <= Number(org?.low_stock_threshold ?? 5) ? "text-destructive font-medium" : ""}`}>
                      {org?.inventory_enabled && item.type === "product" ? Number(item.stock_quantity) : "—"}
                    </TableCell>
                    <TableCell>{item.tax_rates ? `${item.tax_rates.name} (${item.tax_rates.rate}%)` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selected.size} Item(s)?</DialogTitle>
            <DialogDescription>
              This will permanently delete the selected items. Invoice/estimate line items referencing them will be unlinked.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteSelected} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl p-0 gap-0 overflow-hidden bg-slate-50 [&>button]:hidden">
          <div className="flex flex-col h-[85vh] max-h-[750px]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-white shadow-sm z-10">
              <DialogTitle className="text-xl font-semibold text-slate-800">{editItem ? "Edit Item" : "Create New Item"}</DialogTitle>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setDialogOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex flex-1 overflow-hidden">
              {/* Sidebar Tabs */}
              <div className="w-[260px] bg-white border-r flex flex-col py-4">
                <div className="px-3 space-y-1">
                  <button
                    onClick={() => setActiveTab("basic")}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "basic" ? "bg-indigo-50/70 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}
                  >
                    <span className="flex items-center gap-3"><FileText className="h-4 w-4" /> Basic Details</span>
                    <span className="text-destructive">*</span>
                  </button>
                  
                  <div className="px-4 pt-6 pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Advance Details</div>
                  
                  <button
                    onClick={() => setActiveTab("stock")}
                    className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "stock" ? "bg-indigo-50/70 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}
                  >
                    <Package className="h-4 w-4 mr-3" /> Stock Details
                  </button>
                  
                  <button
                    onClick={() => setActiveTab("pricing")}
                    className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "pricing" ? "bg-indigo-50/70 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}
                  >
                    <Tag className="h-4 w-4 mr-3" /> Pricing Details
                  </button>
                  
                  <button
                    onClick={() => setActiveTab("party")}
                    className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "party" ? "bg-indigo-50/70 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}
                  >
                    <Users className="h-4 w-4 mr-3" /> Party Wise Prices
                  </button>
                  
                  <button
                    onClick={() => setActiveTab("custom")}
                    className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "custom" ? "bg-indigo-50/70 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}
                  >
                    <Database className="h-4 w-4 mr-3" /> Custom Fields
                  </button>
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                
                {/* BASIC DETAILS TAB */}
                {activeTab === "basic" && (
                  <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <Label className="text-slate-600">Item Type <span className="text-destructive">*</span></Label>
                        <RadioGroup 
                          value={form.type} 
                          onValueChange={(v) => setForm({ ...form, type: v as any })}
                          className="flex gap-4"
                        >
                          <div className={`flex items-center justify-center space-x-2 border rounded-lg px-4 py-2.5 flex-1 cursor-pointer transition-colors ${form.type === 'product' ? 'border-indigo-500 bg-indigo-50/30' : 'bg-white'}`}>
                            <RadioGroupItem value="product" id="r1" className="text-indigo-600 border-indigo-600" />
                            <Package className={`h-4 w-4 ${form.type === 'product' ? 'text-indigo-600' : 'text-slate-400'}`} />
                            <Label htmlFor="r1" className="cursor-pointer font-medium">Product</Label>
                          </div>
                          <div className={`flex items-center justify-center space-x-2 border rounded-lg px-4 py-2.5 flex-1 cursor-pointer transition-colors ${form.type === 'service' ? 'border-indigo-500 bg-indigo-50/30' : 'bg-white'}`}>
                            <RadioGroupItem value="service" id="r2" className="text-indigo-600 border-indigo-600" />
                            <Settings className={`h-4 w-4 ${form.type === 'service' ? 'text-indigo-600' : 'text-slate-400'}`} />
                            <Label htmlFor="r2" className="cursor-pointer font-medium">Service</Label>
                          </div>
                        </RadioGroup>
                      </div>
                      <div className="space-y-3">
                        <Label className="text-slate-600">Category</Label>
                        <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                          <SelectTrigger className="h-11 bg-white"><SelectValue placeholder="Search Categories" /></SelectTrigger>
                          <SelectContent>
                            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            <SelectItem value="electronics">Electronics</SelectItem>
                            <SelectItem value="services">Services</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6 items-end">
                      <div className="space-y-3">
                        <Label className="text-slate-600 flex items-center gap-1">Item Name <span className="text-destructive">*</span> <Info className="h-3.5 w-3.5 text-slate-400" /></Label>
                        <div className="relative">
                          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input 
                            value={form.name} 
                            onChange={(e) => setForm({ ...form, name: e.target.value })} 
                            placeholder="ex: Maggie 20gm" 
                            className="pl-9 h-11 border-indigo-200 focus-visible:ring-indigo-500 bg-white" 
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 border rounded-xl bg-white h-11">
                        <Label className="text-sm font-medium text-slate-700 cursor-pointer flex items-center gap-1.5" htmlFor="online">
                          Show Item in Online Store <Info className="h-3.5 w-3.5 text-slate-400" />
                        </Label>
                        <Switch id="online" checked={form.show_online} onCheckedChange={(c) => setForm({...form, show_online: c})} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <Label className="text-slate-600">Sales Price</Label>
                        <div className="flex relative shadow-sm rounded-lg">
                          <span className="absolute left-3 top-3 text-slate-400">₹</span>
                          <Input 
                            type="number" 
                            value={form.unit_price || ""} 
                            onChange={(e) => setForm({ ...form, unit_price: parseFloat(e.target.value) || 0 })} 
                            className="pl-8 h-11 rounded-r-none border-r-0 bg-white focus-visible:ring-indigo-500 z-10" 
                            placeholder="ex: 200" 
                          />
                          <Select value={form.sales_price_type} onValueChange={(v) => setForm({...form, sales_price_type: v})}>
                            <SelectTrigger className="w-[130px] h-11 rounded-l-none bg-slate-50 border-l-0 text-slate-600 focus:ring-0 focus:ring-offset-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="with_tax">With Tax</SelectItem>
                              <SelectItem value="without_tax">Without Tax</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <Label className="text-slate-600">GST Tax Rate(%)</Label>
                        <Select value={form.tax_id || "none"} onValueChange={(v) => setForm({ ...form, tax_id: v === "none" ? null : v })}>
                          <SelectTrigger className="h-11 bg-white">
                            <SelectValue placeholder="Q None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {taxRates.map((t) => (
                              <SelectItem key={t.id} value={t.id}>{t.name} ({t.rate}%)</SelectItem>
                            ))}
                            <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase mt-2">Standard Rates</div>
                            {INDIAN_GST_SLABS.filter(s => s.id !== 'exempt').map(slab => (
                              <SelectItem key={slab.id} value={slab.id}>{slab.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <Label className="text-slate-600">Measuring Unit</Label>
                        <div className="relative">
                          <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 z-10" />
                          <Select value={form.unit || "pcs"} onValueChange={(v) => setForm({ ...form, unit: v })}>
                            <SelectTrigger className="pl-9 h-11 bg-white"><SelectValue placeholder="Q Pieces(PCS)" /></SelectTrigger>
                            <SelectContent>
                              {COMMON_UNITS.map(u => (
                                <SelectItem key={u} value={u}>{u.toUpperCase()}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <Label className="text-slate-600">Opening Stock</Label>
                        <div className="relative">
                          <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 z-10" />
                          <Input 
                            type="number" 
                            value={form.stock_quantity || ""} 
                            onChange={(e) => setForm({ ...form, stock_quantity: parseFloat(e.target.value) || 0 })} 
                            className="pl-9 h-11 bg-white pr-16" 
                            placeholder="ex: 150" 
                          />
                          <div className="absolute right-0 top-0 h-full flex items-center justify-center px-4 border-l text-slate-500 text-sm font-medium bg-slate-50 rounded-r-md min-w-16">
                            {form.unit ? form.unit.toUpperCase() : 'PCS'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* STOCK DETAILS TAB */}
                {activeTab === "stock" && (
                  <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <Label className="text-slate-600">Item Code</Label>
                        <div className="flex rounded-lg shadow-sm">
                          <Input 
                            value={form.sku} 
                            onChange={(e) => setForm({ ...form, sku: e.target.value })} 
                            className="h-11 rounded-r-none bg-white" 
                            placeholder="ex: ITM12549" 
                          />
                          <Button variant="secondary" className="h-11 rounded-l-none bg-blue-50 text-blue-600 hover:bg-blue-100 border border-l-0" onClick={handleGenerateBarcode}>
                            Generate Barcode
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <Label className="text-slate-600">HSN code</Label>
                        <Input 
                          value={form.hsn_code} 
                          onChange={(e) => setForm({ ...form, hsn_code: e.target.value })} 
                          className="h-11 bg-white" 
                          placeholder="ex: 4010" 
                        />
                        <button className="text-blue-500 text-sm hover:underline">Find HSN Code</button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <Label className="text-slate-600">Measuring Unit</Label>
                        <Select value={form.unit || "pcs"} onValueChange={(v) => setForm({ ...form, unit: v })}>
                          <SelectTrigger className="h-11 bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {COMMON_UNITS.map(u => (
                              <SelectItem key={u} value={u}>{u.toUpperCase()}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="pt-2">
                          <button className="text-blue-500 text-sm hover:underline font-medium">+ Alternative Unit</button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <Label className="text-slate-600">Opening Stock</Label>
                        <div className="relative">
                          <Input 
                            type="number" 
                            value={form.stock_quantity || ""} 
                            onChange={(e) => setForm({ ...form, stock_quantity: parseFloat(e.target.value) || 0 })} 
                            className="h-11 bg-white pr-12" 
                            placeholder="ex: 150" 
                          />
                          <span className="absolute right-3 top-3 text-slate-400 text-sm font-medium">{form.unit ? form.unit.toUpperCase() : 'PCS'}</span>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <Label className="text-slate-600">As of Date</Label>
                        <Input type="date" className="h-11 bg-white" value={form.as_of_date} onChange={(e) => setForm({...form, as_of_date: e.target.value})} />
                      </div>
                    </div>

                    <div>
                      <button className="text-blue-500 text-sm hover:underline font-medium">+ Enable Low stock quantity warning</button>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-slate-600">Description</Label>
                      <Textarea 
                        value={form.description} 
                        onChange={(e) => setForm({ ...form, description: e.target.value })} 
                        className="min-h-[100px] bg-white resize-none" 
                        placeholder="Enter Description"
                      />
                    </div>
                  </div>
                )}

                {/* PRICING DETAILS TAB */}
                {activeTab === "pricing" && (
                  <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <Label className="text-slate-600">Sales Price</Label>
                        <div className="flex relative shadow-sm rounded-lg">
                          <span className="absolute left-3 top-3 text-slate-400">₹</span>
                          <Input 
                            type="number" 
                            value={form.unit_price || ""} 
                            onChange={(e) => setForm({ ...form, unit_price: parseFloat(e.target.value) || 0 })} 
                            className="pl-8 h-11 rounded-r-none border-r-0 bg-white" 
                            placeholder="ex: 200" 
                          />
                          <Select value={form.sales_price_type} onValueChange={(v) => setForm({...form, sales_price_type: v})}>
                            <SelectTrigger className="w-[130px] h-11 rounded-l-none bg-slate-50 border-l-0 text-slate-600 focus:ring-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="with_tax">With Tax</SelectItem>
                              <SelectItem value="without_tax">Without Tax</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <Label className="text-slate-600">Purchase Price</Label>
                        <div className="flex relative shadow-sm rounded-lg">
                          <span className="absolute left-3 top-3 text-slate-400">₹</span>
                          <Input 
                            type="number" 
                            value={form.purchase_price || ""} 
                            onChange={(e) => setForm({ ...form, purchase_price: parseFloat(e.target.value) || 0 })} 
                            className="pl-8 h-11 rounded-r-none border-r-0 bg-white" 
                            placeholder="ex: 200" 
                          />
                          <Select value={form.purchase_price_type} onValueChange={(v) => setForm({...form, purchase_price_type: v})}>
                            <SelectTrigger className="w-[130px] h-11 rounded-l-none bg-slate-50 border-l-0 text-slate-600 focus:ring-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="with_tax">With Tax</SelectItem>
                              <SelectItem value="without_tax">Without Tax</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <Label className="text-slate-600">GST Tax Rate(%)</Label>
                        <Select value={form.tax_id || "none"} onValueChange={(v) => setForm({ ...form, tax_id: v === "none" ? null : v })}>
                          <SelectTrigger className="h-11 bg-white">
                            <SelectValue placeholder="Q None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {taxRates
                              .filter((t) => !t.name.toUpperCase().includes("CGST") && !t.name.toUpperCase().includes("SGST"))
                              .map((t) => (
                                <SelectItem key={t.id} value={t.id}>{t.name.replace(/IGST/i, "GST")} ({t.rate}%)</SelectItem>
                              ))}
                            {/* Standard Slabs */}
                            <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase mt-2">Standard Rates</div>
                            {INDIAN_GST_SLABS.filter(s => s.id !== 'exempt').map(slab => (
                              <SelectItem key={slab.id} value={slab.id}>{slab.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-3">
                        <Label className="text-slate-600">Discount on Sales Price <span className="text-slate-400 ml-1">ⓘ</span></Label>
                        <div className="relative">
                          <Input 
                            type="number" 
                            value={form.discount || ""} 
                            onChange={(e) => setForm({ ...form, discount: parseFloat(e.target.value) || 0 })} 
                            className="h-11 bg-white pr-12" 
                            placeholder="ex: 12" 
                          />
                          <span className="absolute right-3 top-3 text-slate-400 text-sm font-medium">%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* PARTY WISE PRICES TAB */}
                {activeTab === "party" && (
                  <div className="max-w-2xl space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-medium text-slate-800">Special Pricing</h3>
                      <Button size="sm" onClick={() => setPartyPrices([...partyPrices, { party_type: 'client', party_id: '', price: 0 }])}>
                        <Plus className="h-4 w-4 mr-2" /> Add Price
                      </Button>
                    </div>
                    {partyPrices.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 border-2 border-dashed rounded-xl bg-slate-50">
                        No special prices configured. Add special prices for specific clients or vendors.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {partyPrices.map((p, idx) => (
                          <div key={idx} className="flex gap-4 items-end bg-white p-4 rounded-xl border shadow-sm">
                            <div className="space-y-2">
                              <Label>Type</Label>
                              <Select value={p.party_type} onValueChange={v => { const n = [...partyPrices]; n[idx].party_type = v; n[idx].party_id = ''; setPartyPrices(n); }}>
                                <SelectTrigger className="w-[120px] bg-white"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="client">Client</SelectItem>
                                  <SelectItem value="vendor">Vendor</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2 flex-1">
                              <Label>{p.party_type === 'client' ? 'Client' : 'Vendor'}</Label>
                              <Select value={p.party_id} onValueChange={v => { const n = [...partyPrices]; n[idx].party_id = v; setPartyPrices(n); }}>
                                <SelectTrigger className="bg-white"><SelectValue placeholder={`Select ${p.party_type}`} /></SelectTrigger>
                                <SelectContent>
                                  {(p.party_type === 'client' ? clients : vendors).map(party => (
                                    <SelectItem key={party.id} value={party.id}>{party.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2 w-[150px]">
                              <Label>Price (₹)</Label>
                              <Input 
                                type="number" 
                                value={p.price || ""} 
                                onChange={e => { const n = [...partyPrices]; n[idx].price = parseFloat(e.target.value) || 0; setPartyPrices(n); }} 
                                className="bg-white" 
                              />
                            </div>
                            <Button variant="ghost" className="text-destructive mb-0.5" onClick={() => { const n = [...partyPrices]; n.splice(idx, 1); setPartyPrices(n); }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* CUSTOM FIELDS TAB */}
                {activeTab === "custom" && (
                  <div className="max-w-2xl space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <h3 className="text-lg font-medium text-slate-800 mb-4">Additional Details</h3>
                    {customFieldDefs.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 border-2 border-dashed rounded-xl bg-slate-50">
                        No custom fields defined for items. You can create them in Settings.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-6">
                        {customFieldDefs.map(cf => (
                          <div key={cf.id} className="space-y-3">
                            <Label className="text-slate-600">{cf.field_name} {cf.is_required && <span className="text-destructive">*</span>}</Label>
                            {cf.field_type === 'select' ? (
                              <Select 
                                value={customFieldValues[cf.id] || ""} 
                                onValueChange={v => setCustomFieldValues({...customFieldValues, [cf.id]: v})}
                              >
                                <SelectTrigger className="h-11 bg-white">
                                  <SelectValue placeholder={`Select ${cf.field_name}`} />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.isArray(cf.field_options) && cf.field_options.map((opt: any) => (
                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : cf.field_type === 'boolean' ? (
                              <div className="flex items-center h-11">
                                <Switch 
                                  checked={customFieldValues[cf.id] === 'true'} 
                                  onCheckedChange={c => setCustomFieldValues({...customFieldValues, [cf.id]: c ? 'true' : 'false'})}
                                />
                              </div>
                            ) : (
                              <Input 
                                type={cf.field_type === 'number' ? 'number' : cf.field_type === 'date' ? 'date' : 'text'}
                                value={customFieldValues[cf.id] || ""} 
                                onChange={e => setCustomFieldValues({...customFieldValues, [cf.id]: e.target.value})}
                                className="h-11 bg-white" 
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-white border-t flex justify-between items-center z-10">
              <Button variant="outline" className="h-11 px-8 rounded-xl" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <div className="flex gap-3">
                <Button variant="outline" className="h-11 px-6 rounded-xl text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => handleSave(true)}>
                  Save & New
                </Button>
                <Button className="h-11 px-8 rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-sm font-medium" onClick={() => handleSave(false)}>
                  Save Item
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        fields={itemImportFields}
        entityName="Items"
        onImport={async (rows) => {
          let success = 0, errors = 0;
          for (const row of rows) {
            const matchedTax = row.tax_name ? taxRates.find((t: any) => t.name.toLowerCase() === row.tax_name.toLowerCase()) : null;
            const price = parsePrice(row.unit_price);
            const type = normalizeType(row.type);
            const { error } = await supabase.from("items").insert({
              org_id: org!.id,
              name: row.name || "Unnamed",
              description: row.description || null,
              sku: row.sku || null,
              type,
              unit_price: price,
              unit: row.unit || null,
              tax_id: matchedTax?.id || null,
              is_active: row.is_active === "false" ? false : true,
            });
            if (error) errors++; else success++;
          }
          fetchItems();
          return { success, errors };
        }}
      />
    </div>
  );
}
