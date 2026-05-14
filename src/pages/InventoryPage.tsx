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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Package, Search, AlertTriangle, PackageX, PackagePlus, Sparkles, Database, Wrench, Pencil, Trash2, Infinity as InfinityIcon } from "lucide-react";
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
  const [tab, setTab] = useState<"all" | "products" | "services" | "low">("all");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [target, setTarget] = useState<any>(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string>("");
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const threshold = Number((org as any)?.low_stock_threshold ?? 5);

  const fetchItems = async () => {
    if (!org?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("items")
      .select("id, name, sku, unit, stock_quantity, unit_price, category, type, description")
      .eq("org_id", org.id)
      .order("type", { ascending: false })
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
      let matchTab = true;
      if (tab === "products") matchTab = i.type === "product";
      else if (tab === "services") matchTab = i.type === "service";
      else if (tab === "low") matchTab = i.type === "product" && stock <= threshold;
      return matchSearch && matchTab;
    });
  }, [items, search, tab, threshold]);

  const stats = useMemo(() => {
    const products = items.filter((i) => i.type === "product");
    const services = items.filter((i) => i.type === "service");
    const low = products.filter((i) => Number(i.stock_quantity || 0) <= threshold).length;
    const stockValue = products.reduce((s, i) => s + Number(i.stock_quantity || 0) * Number(i.unit_price || 0), 0);
    return { products: products.length, services: services.length, low, stockValue };
  }, [items, threshold]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: org?.currency_code || "USD" }).format(n);

  const openAdjust = (item: any) => {
    setTarget(item);
    setAdjustQty(Number(item.stock_quantity || 0));
    setAdjustOpen(true);
  };

  const saveAdjust = async () => {
    if (!target) return;
    const next = Math.max(0, Number(adjustQty));
    const { error } = await supabase.from("items").update({ stock_quantity: next }).eq("id", target.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Stock updated", description: `${target.name} → ${next}` });
    setAdjustOpen(false);
    fetchItems();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await supabase.from("invoice_lines").update({ item_id: null }).eq("item_id", deleteTarget.id);
    await supabase.from("estimate_lines").update({ item_id: null }).eq("item_id", deleteTarget.id);
    await supabase.from("credit_note_lines").update({ item_id: null }).eq("item_id", deleteTarget.id);
    const { error } = await supabase.from("items").delete().eq("id", deleteTarget.id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Item deleted" });
    setDeleteTarget(null);
    fetchItems();
  };

  const toggleInventory = async (enabled: boolean) => {
    if (!org?.id) return;
    const { error } = await supabase.from("organizations").update({ inventory_enabled: enabled }).eq("id", org.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setOrganization({ ...(org as any), inventory_enabled: enabled });
    toast({ title: enabled ? "Inventory tracking enabled" : "Inventory tracking disabled" });
  };

  const inventoryEnabled = !!(org as any)?.inventory_enabled;

  const getAiAdvice = async () => {
    const products = items.filter((i) => i.type === "product");
    if (!products.length) { toast({ title: "No products", description: "Add some products first." }); return; }
    setAiOpen(true); setAiLoading(true); setAiAdvice("");
    const { data, error } = await supabase.functions.invoke("inventory-advisor", {
      body: {
        items: products.map((i) => ({ name: i.name, stock_quantity: i.stock_quantity, unit: i.unit, unit_price: i.unit_price, category: i.category })),
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
      // Services
      { name: "Web Design Package", description: "Landing page + 5 inner pages", sku: "SVC-WEB-01", category: "Services", type: "service" as const, unit: null, unit_price: 1800, stock_quantity: 0 },
      { name: "Cloud Hosting (Annual)", description: "Managed hosting with SSL", sku: "SVC-HOST-AN", category: "Services", type: "service" as const, unit: null, unit_price: 480, stock_quantity: 0 },
      { name: "SEO Audit", description: "Full site SEO report", sku: "SVC-SEO-01", category: "Services", type: "service" as const, unit: null, unit_price: 350, stock_quantity: 0 },
      // Products — hardware
      { name: "Wireless Keyboard K2", sku: "HW-KB-K2", category: "Hardware", type: "product" as const, unit: "pcs", unit_price: 89, stock_quantity: 142 },
      { name: "USB-C Hub Pro", sku: "HW-HUB-PRO", category: "Hardware", type: "product" as const, unit: "pcs", unit_price: 49, stock_quantity: 12 },
      { name: '27" 4K Monitor', sku: "HW-MON-27K", category: "Hardware", type: "product" as const, unit: "pcs", unit_price: 420, stock_quantity: 38 },
      { name: "Ergo Mouse", sku: "HW-MS-ERG", category: "Hardware", type: "product" as const, unit: "pcs", unit_price: 65, stock_quantity: 4 },
      { name: "Laptop Stand Aluminium", sku: "HW-STAND-AL", category: "Hardware", type: "product" as const, unit: "pcs", unit_price: 39, stock_quantity: 56 },
      { name: "Webcam 1080p", sku: "HW-CAM-1080", category: "Hardware", type: "product" as const, unit: "pcs", unit_price: 75, stock_quantity: 0 },
      { name: "Noise-Cancel Headphones", sku: "HW-HP-NC", category: "Hardware", type: "product" as const, unit: "pcs", unit_price: 199, stock_quantity: 21 },
      // Grocery / FMCG
      { name: "Basmati Rice (5kg)", sku: "RICE-5KG", category: "Grocery", type: "product" as const, unit: "bag", unit_price: 8, stock_quantity: 24 },
      { name: "Sunflower Oil (1L)", sku: "OIL-SUN-1L", category: "Grocery", type: "product" as const, unit: "ltr", unit_price: 2, stock_quantity: 3 },
      { name: "Tea Powder (500g)", sku: "TEA-500G", category: "Beverage", type: "product" as const, unit: "pcs", unit_price: 3, stock_quantity: 8 },
      { name: "Detergent Powder (1kg)", sku: "DET-1KG", category: "Household", type: "product" as const, unit: "kg", unit_price: 1.5, stock_quantity: 1 },
      { name: "LED Bulb 9W", sku: "LED-9W", category: "Electrical", type: "product" as const, unit: "pcs", unit_price: 1.2, stock_quantity: 6 },
      { name: "Notebook A5", sku: "NB-A5", category: "Stationery", type: "product" as const, unit: "pcs", unit_price: 0.7, stock_quantity: 80 },
    ];
    const rows = demo.map((d) => ({ ...d, org_id: org.id, is_active: true }));
    const { error } = await supabase.from("items").insert(rows);
    setSeedingDemo(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Demo data added", description: `${rows.length} sample items loaded.` });
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

  const statCards = [
    { label: "PRODUCTS", value: stats.products, icon: Package, tone: "" },
    { label: "SERVICES", value: stats.services, icon: Wrench, tone: "" },
    { label: "LOW STOCK", value: stats.low, icon: AlertTriangle, tone: stats.low > 0 ? "text-orange-600" : "" },
    { label: "INVENTORY VALUE", value: fmt(stats.stockValue), icon: Package, tone: "" },
  ];

  return (
    <div className="p-6 space-y-5">
      <SEO title="Inventory" description="Track products and services with stock levels, low-stock alerts, and AI-powered restock guidance." path="/inventory" />
      <PageHeader title="Inventory" description="Products auto-deduct from stock when invoices are sent">
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5">
          <Label htmlFor="inv-toggle" className="text-xs font-medium cursor-pointer">Tracking</Label>
          <Switch id="inv-toggle" checked={true} onCheckedChange={(v) => toggleInventory(v)} />
        </div>
        <Button variant="outline" size="sm" onClick={getAiAdvice}>
          <Sparkles className="mr-1.5 h-4 w-4" /> AI Advice
        </Button>
        <Button variant="outline" size="sm" onClick={seedDemoData} disabled={seedingDemo}>
          <Database className="mr-1.5 h-4 w-4" /> {seedingDemo ? "Loading..." : "Load Demo Data"}
        </Button>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <PackagePlus className="mr-1.5 h-4 w-4" /> Add Product
        </Button>
      </PageHeader>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="rounded-2xl border-border/60 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold tracking-wider text-muted-foreground">{s.label}</div>
                  <Icon className={`h-4 w-4 ${s.tone || "text-muted-foreground"}`} />
                </div>
                <div className={`text-2xl font-bold mt-2 ${s.tone}`}>{s.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="low">Low Stock</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name or SKU..."
            className="pl-10 h-10 rounded-xl bg-card border-border/60 shadow-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Package}
              title={items.length === 0 ? "No items yet" : "No items match your filter"}
              description={items.length === 0 ? "Add an item or load demo data to get started." : "Try a different tab or search."}
              actionLabel={items.length === 0 ? "Load Demo Data" : undefined}
              onAction={items.length === 0 ? seedDemoData : undefined}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px] tracking-wider text-muted-foreground">ITEM</TableHead>
                  <TableHead className="text-[11px] tracking-wider text-muted-foreground">SKU</TableHead>
                  <TableHead className="text-[11px] tracking-wider text-muted-foreground">TYPE</TableHead>
                  <TableHead className="text-[11px] tracking-wider text-muted-foreground text-right">PRICE</TableHead>
                  <TableHead className="text-[11px] tracking-wider text-muted-foreground text-right">STOCK</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => {
                  const isService = item.type === "service";
                  const stock = Number(item.stock_quantity || 0);
                  const isOut = !isService && stock <= 0;
                  const isLow = !isService && !isOut && stock <= threshold;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-semibold">{item.name}</div>
                        {item.description && (
                          <div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{item.sku || "—"}</TableCell>
                      <TableCell>
                        {isService ? (
                          <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100 border border-sky-200 uppercase text-[10px] tracking-wider">Service</Badge>
                        ) : (
                          <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 uppercase text-[10px] tracking-wider">Product</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">{fmt(Number(item.unit_price))}</TableCell>
                      <TableCell className="text-right">
                        {isService ? (
                          <InfinityIcon className="h-4 w-4 inline text-muted-foreground" />
                        ) : (
                          <button
                            onClick={() => openAdjust(item)}
                            className={`inline-flex items-center gap-1 font-medium hover:underline ${isOut ? "text-destructive" : isLow ? "text-orange-600" : ""}`}
                          >
                            {(isOut || isLow) && <AlertTriangle className="h-3.5 w-3.5" />}
                            {stock}
                          </button>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => isService ? navigate("/items") : openAdjust(item)} title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(item)} title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
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

      {/* Adjust stock dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Stock</DialogTitle>
          </DialogHeader>
          {target && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/40 p-3">
                <div className="font-medium">{target.name}</div>
                <div className="text-sm text-muted-foreground">
                  Current: <span className="font-semibold">{Number(target.stock_quantity)} {target.unit || ""}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>New Stock Level</Label>
                <Input type="number" min={0} step="0.01" value={adjustQty} onChange={(e) => setAdjustQty(parseFloat(e.target.value) || 0)} autoFocus />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>Cancel</Button>
            <Button onClick={saveAdjust}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.name}?</DialogTitle>
            <DialogDescription>
              This will permanently delete the item. Any invoice or estimate lines using it will be unlinked.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
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
              <div className="py-10 text-center text-muted-foreground text-sm">Analyzing your stock... ek minute ⏳</div>
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
