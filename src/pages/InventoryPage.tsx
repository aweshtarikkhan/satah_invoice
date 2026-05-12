import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
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
import { Package, Search, Plus, Minus, AlertTriangle, PackageX } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function InventoryPage() {
  const org = useAppStore((s) => s.organization);
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

  if (!(org as any)?.inventory_enabled) {
    return (
      <div className="p-6">
        <PageHeader title="Inventory" description="Stock tracking is currently disabled" />
        <Card className="rounded-2xl border-border/60">
          <CardContent className="p-10 flex flex-col items-center text-center gap-4">
            <PackageX className="h-12 w-12 text-muted-foreground" />
            <div>
              <h3 className="font-semibold text-lg">Inventory tracking is off</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Turn on inventory tracking in Settings if you sell physical products. Service businesses can keep this disabled.
              </p>
            </div>
            <Button onClick={() => navigate("/settings")}>Go to Settings</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Inventory" description="Manage stock levels of your products">
        <Button variant="outline" size="sm" onClick={() => navigate("/items")}>
          <Package className="mr-1.5 h-4 w-4" /> Manage Items
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
              actionLabel={items.length === 0 ? "Add Item" : undefined}
              onAction={items.length === 0 ? () => navigate("/items?add=1") : undefined}
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
    </div>
  );
}
