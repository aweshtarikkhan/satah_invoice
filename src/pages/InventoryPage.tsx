import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
import { SEO } from "@/components/shared/SEO";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Package, Search, Plus, Minus, AlertTriangle, PackageX, PackagePlus, Sparkles, Database } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import { AddItemDialog } from "@/components/shared/AddItemDialog";
import ReactMarkdown from "react-markdown";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function InventoryPage() {
  const org = useAppStore((s) => s.organization);
  const setOrganization = useAppStore((s) => s.setOrganization);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [target, setTarget] = useState<any>(null);
  const [adjustMode, setAdjustMode] = useState<"add" | "remove" | "set">("add");
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustNote, setAdjustNote] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string>("");
  const [seedingDemo, setSeedingDemo] = useState(false);

  const threshold = Number((org as any)?.low_stock_threshold ?? 5);

  const fetchItems = async () => {
    if (!org?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("items")
      .select("id, name, sku, unit, stock_quantity, unit_price, category, type")
      .eq("org_id", org.id)
      .eq("type", "product")
      .order("name");
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, [org?.id]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      const q = search.toLowerCase();
      const matchSearch = !q || [i.name, i.sku, i.category].filter(Boolean).some((f: string) => f.toLowerCase().includes(q));
      const stock = Number(i.stock_quantity || 0);
      let matchFilter = true;
      if (filter === "low") matchFilter = stock > 0 && stock <= threshold;
      else if (filter === "out") matchFilter = stock <= 0;
      return matchSearch && matchFilter;
    });
  }, [items, search, filter, threshold]);

  const stats = useMemo(() => {
    const total = items.length;
    const out = items.filter((i) => Number(i.stock_quantity) <= 0).length;
    const low = items.filter((i) => {
      const s = Number(i.stock_quantity);
      return s > 0 && s <= threshold;
    }).length;
    const stockValue = items.reduce((s, i) => s + Number(i.stock_quantity || 0) * Number(i.unit_price || 0), 0);
    return { total, out, low, stockValue };
  }, [items, threshold]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: org?.currency_code || "USD" }).format(n);

  const openAdjust = (item: any, mode: "add" | "remove" | "set") => {
    setTarget(item);
    setAdjustMode(mode);
    setAdjustQty(0);
    setAdjustNote("");
    setAdjustOpen(true);
  };

  const saveAdjust = async () => {
    if (!target) return;
    const current = Number(target.stock_quantity || 0);
    let next = current;
    if (adjustMode === "add") next = current + Number(adjustQty);
    else if (adjustMode === "remove") next = current - Number(adjustQty);
    else next = Number(adjustQty);
    next = Math.max(0, next);
    const { error } = await supabase.from("items").update({ stock_quantity: next }).eq("id", target.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Stock updated", description: `${target.name}: ${current} → ${next}` });
    setAdjustOpen(false);
    fetchItems();
  };

  const toggleInventory = async (enabled: boolean) => {
    if (!org?.id) return;
    const { error } = await supabase.from("organizations").update({ inventory_enabled: enabled }).eq("id", org.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setOrganization({ ...(org as any), inventory_enabled: enabled });
    toast({ title: enabled ? "Inventory tracking enabled" : "Inventory tracking disabled" });
  };

  const inventoryEnabled = !!(org as any)?.inventory_enabled;

  const getAiAdvice = async () => {
    if (!items.length) {
      toast({ title: "No items", description: "Add some products first." });
      return;
    }
    setAiOpen(true);
    setAiLoading(true);
    setAiAdvice("");
    const { data, error } = await supabase.functions.invoke("inventory-advisor", {
      body: {
        items: items.map((i) => ({ name: i.name, stock_quantity: i.stock_quantity, unit: i.unit, unit_price: i.unit_price, category: i.category })),
        currency: org?.currency_code || "INR",
        threshold,
      },
    });
    setAiLoading(false);
    if (error || (data as any)?.error) {
      toast({ title: "AI error", description: (data as any)?.error || error?.message, variant: "destructive" });
      setAiAdvice("Could not generate advice. Please try again.");
      return;
    }
    setAiAdvice((data as any)?.advice || "No advice generated.");
  };

  const seedDemoData = async () => {
    if (!org?.id) return;
    setSeedingDemo(true);
    const demo = [
      { name: "Basmati Rice (5kg)", sku: "RICE-5KG", category: "Grocery", unit: "bag", unit_price: 650, stock_quantity: 24 },
      { name: "Refined Sunflower Oil (1L)", sku: "OIL-SUN-1L", category: "Grocery", unit: "ltr", unit_price: 145, stock_quantity: 3 },
      { name: "Toor Dal (1kg)", sku: "DAL-TOOR-1KG", category: "Grocery", unit: "kg", unit_price: 180, stock_quantity: 12 },
      { name: "Wheat Flour (10kg)", sku: "ATTA-10KG", category: "Grocery", unit: "bag", unit_price: 420, stock_quantity: 0 },
      { name: "Sugar (1kg)", sku: "SUGAR-1KG", category: "Grocery", unit: "kg", unit_price: 48, stock_quantity: 35 },
      { name: "Tea Powder (500g)", sku: "TEA-500G", category: "Beverage", unit: "pcs", unit_price: 240, stock_quantity: 8 },
      { name: "Milk Packet (1L)", sku: "MILK-1L", category: "Dairy", unit: "ltr", unit_price: 60, stock_quantity: 2 },
      { name: "Butter (500g)", sku: "BUTTER-500G", category: "Dairy", unit: "pcs", unit_price: 280, stock_quantity: 18 },
      { name: "Soap Bar", sku: "SOAP-100G", category: "Personal Care", unit: "pcs", unit_price: 35, stock_quantity: 60 },
      { name: "Shampoo (200ml)", sku: "SHAM-200", category: "Personal Care", unit: "pcs", unit_price: 120, stock_quantity: 4 },
      { name: "Toothpaste (150g)", sku: "TP-150", category: "Personal Care", unit: "pcs", unit_price: 95, stock_quantity: 22 },
      { name: "Detergent Powder (1kg)", sku: "DET-1KG", category: "Household", unit: "kg", unit_price: 110, stock_quantity: 1 },
      { name: "Dish Wash Liquid (500ml)", sku: "DW-500", category: "Household", unit: "ml", unit_price: 99, stock_quantity: 14 },
      { name: "Notebook A5", sku: "NB-A5", category: "Stationery", unit: "pcs", unit_price: 55, stock_quantity: 80 },
      { name: "Ball Pen (Blue)", sku: "PEN-BL", category: "Stationery", unit: "pcs", unit_price: 10, stock_quantity: 150 },
      { name: "LED Bulb 9W", sku: "LED-9W", category: "Electrical", unit: "pcs", unit_price: 90, stock_quantity: 6 },
      { name: "Extension Cord 5m", sku: "EXT-5M", category: "Electrical", unit: "pcs", unit_price: 320, stock_quantity: 0 },
      { name: "Cotton T-Shirt (M)", sku: "TS-M", category: "Apparel", unit: "pcs", unit_price: 299, stock_quantity: 45 },
      { name: "Steel Water Bottle (1L)", sku: "BOT-1L", category: "Kitchen", unit: "pcs", unit_price: 250, stock_quantity: 9 },
      { name: "Mixer Grinder", sku: "MIX-750W", category: "Appliance", unit: "pcs", unit_price: 2500, stock_quantity: 2 },
    ];
    const rows = demo.map((d) => ({ ...d, org_id: org.id, type: "product" as const, is_active: true }));
    const { error } = await supabase.from("items").insert(rows);
    setSeedingDemo(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Demo data added", description: `${rows.length} sample products inserted.` });
    fetchItems();
  };


  if (!inventoryEnabled) {
    return (
      <div className="p-6 space-y-5">
        <SEO title="Inventory" description="Track stock levels across any unit (kg, ltr, pcs, box) with low-stock alerts and movement history." path="/inventory" />
      <PageHeader title="Inventory" description="Stock tracking is currently disabled" />
        <Card className="rounded-2xl border-border/60">
          <CardContent className="p-10 flex flex-col items-center text-center gap-4">
            <PackageX className="h-12 w-12 text-muted-foreground" />
            <div>
              <h3 className="font-semibold text-lg">Inventory tracking is off</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Turn it on if you sell physical products (works with kg, ltr, pcs, box, or any unit). Service-only businesses can keep this disabled.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
              <Label htmlFor="inv-toggle" className="text-sm font-medium">Enable Inventory Tracking</Label>
              <Switch id="inv-toggle" checked={false} onCheckedChange={(v) => toggleInventory(v)} />
            </div>
            <Button variant="outline" onClick={() => navigate("/settings")}>Open Settings</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Inventory" description="Track stock across any unit (kg, ltr, pcs, box, etc.)">
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5">
          <Label htmlFor="inv-toggle" className="text-xs font-medium cursor-pointer">Tracking</Label>
          <Switch id="inv-toggle" checked={true} onCheckedChange={(v) => toggleInventory(v)} />
        </div>
        <Button variant="outline" size="sm" onClick={getAiAdvice}>
          <Sparkles className="mr-1.5 h-4 w-4" /> AI Advice
        </Button>
        {items.length === 0 && (
          <Button variant="outline" size="sm" onClick={seedDemoData} disabled={seedingDemo}>
            <Database className="mr-1.5 h-4 w-4" /> {seedingDemo ? "Loading..." : "Load Demo Data"}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => navigate("/items")}>
          <Package className="mr-1.5 h-4 w-4" /> Manage Items
        </Button>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <PackagePlus className="mr-1.5 h-4 w-4" /> Add Product
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Products", value: stats.total, color: "" },
          { label: "Low Stock", value: stats.low, color: "text-orange-600" },
          { label: "Out of Stock", value: stats.out, color: "text-destructive" },
          { label: "Stock Value", value: fmt(stats.stockValue), color: "text-emerald-600" },
        ].map((s) => (
          <Card key={s.label} className="rounded-xl border-border/60 shadow-sm">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className={`text-2xl font-semibold mt-1 ${s.color}`}>{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            className="pl-10 h-11 rounded-xl bg-card border-border/60 shadow-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
          <SelectTrigger className="h-11 rounded-xl bg-card border-border/60 shadow-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Products</SelectItem>
            <SelectItem value="low">Low Stock Only</SelectItem>
            <SelectItem value="out">Out of Stock Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No products found"
              description={items.length === 0 ? "Add product items to start tracking stock." : "No products match your filter."}
              actionLabel={items.length === 0 ? "Add Product" : undefined}
              onAction={items.length === 0 ? () => setAddOpen(true) : undefined}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Stock Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Adjust</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => {
                  const stock = Number(item.stock_quantity || 0);
                  const isOut = stock <= 0;
                  const isLow = !isOut && stock <= threshold;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.sku || "—"}</TableCell>
                      <TableCell>{item.category ? <Badge variant="outline">{item.category}</Badge> : "—"}</TableCell>
                      <TableCell className={`text-right font-medium ${isOut ? "text-destructive" : isLow ? "text-orange-600" : ""}`}>
                        {stock} {item.unit || ""}
                      </TableCell>
                      <TableCell className="text-right">{fmt(Number(item.unit_price))}</TableCell>
                      <TableCell className="text-right">{fmt(stock * Number(item.unit_price))}</TableCell>
                      <TableCell>
                        {isOut ? (
                          <Badge variant="destructive" className="gap-1"><PackageX className="h-3 w-3" /> Out</Badge>
                        ) : isLow ? (
                          <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 gap-1 border border-orange-200">
                            <AlertTriangle className="h-3 w-3" /> Low
                          </Badge>
                        ) : (
                          <Badge variant="secondary">In Stock</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => openAdjust(item, "add")}>
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => openAdjust(item, "remove")}>
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8" onClick={() => openAdjust(item, "set")}>
                            Set
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {adjustMode === "add" ? "Add Stock" : adjustMode === "remove" ? "Remove Stock" : "Set Stock Level"}
            </DialogTitle>
          </DialogHeader>
          {target && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/40 p-3">
                <div className="font-medium">{target.name}</div>
                <div className="text-sm text-muted-foreground">
                  Current stock: <span className="font-semibold">{Number(target.stock_quantity)} {target.unit || ""}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{adjustMode === "set" ? "New Stock Level" : "Quantity"}</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(parseFloat(e.target.value) || 0)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Note (optional)</Label>
                <Input value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} placeholder="e.g. Restocked from supplier" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>Cancel</Button>
            <Button onClick={saveAdjust}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddItemDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onItemAdded={() => fetchItems()}
        defaultType="product"
      />

      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> AI Inventory Advisor
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            {aiLoading ? (
              <div className="py-10 text-center text-muted-foreground text-sm">
                Analyzing your stock... ek minute ⏳
              </div>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{aiAdvice}</ReactMarkdown>
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiOpen(false)}>Close</Button>
            <Button onClick={getAiAdvice} disabled={aiLoading}>
              <Sparkles className="mr-1.5 h-4 w-4" /> Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
