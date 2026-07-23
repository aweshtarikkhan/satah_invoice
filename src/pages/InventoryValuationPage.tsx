import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { SEO } from "@/components/shared/SEO";
import { formatCurrency } from "@/lib/currency";
import { Boxes, Layers, Hash, PackageSearch, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";

interface MovementRow {
  item_id: string;
  item_name: string;
  change_qty: number;
  unit_cost: number;
  batch_no: string | null;
  serial_no: string | null;
  expiry_date: string | null;
  created_at: string;
}

export default function InventoryValuationPage() {
  const org = useAppStore((s) => s.organization);
  const cur = (org as any)?.currency || "INR";
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!org?.id) return;
    (async () => {
      setLoading(true);
      const [m, it] = await Promise.all([
        (supabase as any).from("stock_movements").select("item_id, change_qty, unit_cost, batch_no, serial_no, expiry_date, created_at, items(name)").eq("org_id", org.id).order("created_at"),
        (supabase as any).from("items").select("id,name,stock_quantity,purchase_price,sale_price,track_batches,track_serials,valuation_method").eq("org_id", org.id).eq("type", "product"),
      ]);
      setMovements((m.data || []).map((x: any) => ({ ...x, item_name: x.items?.name || "—" })));
      setItems(it.data || []);
      setLoading(false);
    })();
  }, [org?.id]);

  // Weighted Avg per item
  const weightedAvg = useMemo(() => {
    const map: Record<string, { name: string; qty: number; value: number; avg: number }> = {};
    items.forEach(it => { map[it.id] = { name: it.name, qty: Number(it.stock_quantity || 0), value: 0, avg: 0 }; });
    const totals: Record<string, { qty: number; value: number }> = {};
    movements.forEach(m => {
      if (!map[m.item_id]) return;
      if (!totals[m.item_id]) totals[m.item_id] = { qty: 0, value: 0 };
      const t = totals[m.item_id];
      const q = Number(m.change_qty);
      const c = Number(m.unit_cost || 0);
      if (q > 0) { // purchase / receipt
        t.qty += q; t.value += q * c;
      } else if (q < 0 && t.qty > 0) { // issue
        const avg = t.value / t.qty;
        t.value += q * avg; // q is negative
        t.qty += q;
      }
    });
    Object.keys(map).forEach(k => {
      const t = totals[k];
      if (t && t.qty > 0) { map[k].value = t.value; map[k].avg = t.value / t.qty; map[k].qty = t.qty; }
      else { map[k].value = map[k].qty * 0; }
    });
    return Object.entries(map).map(([id, v]) => ({ id, ...v }));
  }, [movements, items]);

  // FIFO per item: build layer queue
  const fifo = useMemo(() => {
    const result: { id: string; name: string; qty: number; value: number; layers: { qty: number; cost: number; batch?: string }[] }[] = [];
    items.forEach(it => {
      const movs = movements.filter(m => m.item_id === it.id);
      const layers: { qty: number; cost: number; batch?: string }[] = [];
      movs.forEach(m => {
        let q = Number(m.change_qty);
        if (q > 0) layers.push({ qty: q, cost: Number(m.unit_cost || 0), batch: m.batch_no || undefined });
        else {
          let need = -q;
          while (need > 0 && layers.length) {
            const top = layers[0];
            if (top.qty <= need) { need -= top.qty; layers.shift(); }
            else { top.qty -= need; need = 0; }
          }
        }
      });
      const qty = layers.reduce((s, l) => s + l.qty, 0);
      const value = layers.reduce((s, l) => s + l.qty * l.cost, 0);
      result.push({ id: it.id, name: it.name, qty, value, layers });
    });
    return result;
  }, [movements, items]);

  // Batch / serial summary
  const batchSummary = useMemo(() => {
    const out: { item: string; batch: string; qty: number; expiry: string | null }[] = [];
    const map: Record<string, { item: string; batch: string; qty: number; expiry: string | null }> = {};
    movements.forEach(m => {
      if (!m.batch_no) return;
      const k = `${m.item_id}::${m.batch_no}`;
      if (!map[k]) map[k] = { item: m.item_name, batch: m.batch_no, qty: 0, expiry: m.expiry_date };
      map[k].qty += Number(m.change_qty);
      if (m.expiry_date) map[k].expiry = m.expiry_date;
    });
    Object.values(map).forEach(v => { if (v.qty > 0) out.push(v); });
    return out.sort((a, b) => a.item.localeCompare(b.item));
  }, [movements]);

  const serialSummary = useMemo(() => {
    const out: { item: string; serial: string; status: "in" | "out" }[] = [];
    const map: Record<string, { item: string; serial: string; net: number }> = {};
    movements.forEach(m => {
      if (!m.serial_no) return;
      const k = `${m.item_id}::${m.serial_no}`;
      if (!map[k]) map[k] = { item: m.item_name, serial: m.serial_no, net: 0 };
      map[k].net += Number(m.change_qty);
    });
    Object.values(map).forEach(v => out.push({ item: v.item, serial: v.serial, status: v.net > 0 ? "in" : "out" }));
    return out.sort((a, b) => a.item.localeCompare(b.item));
  }, [movements]);

  const totalWA = weightedAvg.reduce((s, r) => s + r.value, 0);
  const totalFIFO = fifo.reduce((s, r) => s + r.value, 0);
  const totalStock = weightedAvg.reduce((s, r) => s + r.qty, 0);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <SEO title="Inventory Valuation" description="View stock valuation reports using Weighted Average and FIFO methods." path="/inventory-valuation" />
      <PageHeader
        title="Inventory Valuation"
        description="Analyze stock value using different costing methods"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Boxes className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-medium">Total Items</div>
                <div className="text-2xl font-bold">{items.length}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-medium">Weighted Avg Value</div>
                <div className="text-xl font-bold">{formatCurrency(totalWA, cur)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-violet-500">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <BarChart3 className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-medium">FIFO Value</div>
                <div className="text-xl font-bold">{formatCurrency(totalFIFO, cur)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <PackageSearch className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-medium">Total Stock Qty</div>
                <div className="text-2xl font-bold">{totalStock}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="wa" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="wa" className="gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Weighted Avg
          </TabsTrigger>
          <TabsTrigger value="fifo" className="gap-1.5">
            <Layers className="h-3.5 w-3.5" /> FIFO
          </TabsTrigger>
          <TabsTrigger value="batch" className="gap-1.5">
            <Boxes className="h-3.5 w-3.5" /> Batches
          </TabsTrigger>
          <TabsTrigger value="serial" className="gap-1.5">
            <Hash className="h-3.5 w-3.5" /> Serials
          </TabsTrigger>
        </TabsList>

        {/* Weighted Average Tab */}
        <TabsContent value="wa">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Weighted Average Valuation
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Stock valued using the weighted average cost of all purchases
              </p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-12 text-center text-muted-foreground">Loading…</div>
              ) : weightedAvg.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <PackageSearch className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>No product items found</p>
                  <p className="text-xs mt-1">Add items with type "Product" to see valuation data</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Item Name</TableHead>
                        <TableHead className="text-right">Stock Qty</TableHead>
                        <TableHead className="text-right">Avg Cost / Unit</TableHead>
                        <TableHead className="text-right">Total Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {weightedAvg.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={r.qty > 0 ? "default" : "secondary"} className="font-mono">
                              {r.qty}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">{formatCurrency(r.avg, cur)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(r.value, cur)}</TableCell>
                        </TableRow>
                      ))}
                      {/* Footer Total */}
                      <TableRow className="bg-muted/30 font-bold border-t-2">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">{totalStock}</TableCell>
                        <TableCell className="text-right"></TableCell>
                        <TableCell className="text-right text-primary">{formatCurrency(totalWA, cur)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* FIFO Tab */}
        <TabsContent value="fifo">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4 text-violet-500" />
                FIFO Valuation (per layer)
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                First-In-First-Out costing with remaining inventory layers
              </p>
            </CardHeader>
            <CardContent>
              {fifo.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Layers className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>No FIFO data available</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Item Name</TableHead>
                        <TableHead>Layers (qty @ cost)</TableHead>
                        <TableHead className="text-right">Total Qty</TableHead>
                        <TableHead className="text-right">Total Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fifo.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell>
                            {r.layers.length ? (
                              <div className="flex flex-wrap gap-1">
                                {r.layers.map((l, i) => (
                                  <Badge key={i} variant="outline" className="text-xs font-mono">
                                    {l.qty} @ {formatCurrency(l.cost, cur)}
                                    {l.batch ? ` (${l.batch})` : ""}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={r.qty > 0 ? "default" : "secondary"} className="font-mono">
                              {r.qty}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(r.value, cur)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/30 font-bold border-t-2">
                        <TableCell>Total</TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right">{fifo.reduce((s, r) => s + r.qty, 0)}</TableCell>
                        <TableCell className="text-right text-primary">{formatCurrency(totalFIFO, cur)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Batches Tab */}
        <TabsContent value="batch">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Boxes className="h-4 w-4 text-blue-500" />
                Batch Stock
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Track stock across batches with expiry monitoring
              </p>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Item Name</TableHead>
                      <TableHead>Batch #</TableHead>
                      <TableHead className="text-right">Qty in Stock</TableHead>
                      <TableHead>Expiry Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batchSummary.map((b, i) => {
                      const expired = b.expiry && new Date(b.expiry) < new Date();
                      const nearExpiry = b.expiry && !expired && new Date(b.expiry) < new Date(Date.now() + 30 * 86400000);
                      return (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{b.item}</TableCell>
                          <TableCell><code className="px-1.5 py-0.5 rounded bg-muted text-xs">{b.batch}</code></TableCell>
                          <TableCell className="text-right">
                            <Badge variant="default" className="font-mono">{b.qty}</Badge>
                          </TableCell>
                          <TableCell>
                            {b.expiry ? (
                              <Badge variant={expired ? "destructive" : nearExpiry ? "secondary" : "outline"}>
                                {b.expiry}{expired ? " — Expired" : nearExpiry ? " — Expiring soon" : ""}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!batchSummary.length && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                          <Boxes className="h-10 w-10 mx-auto mb-3 opacity-40" />
                          <p>No batch-tracked stock</p>
                          <p className="text-xs mt-1">Enable batch tracking on items to see data here</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Serials Tab */}
        <TabsContent value="serial">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Hash className="h-4 w-4 text-orange-500" />
                Serial Numbers
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Track individual serial numbers and their current status
              </p>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Item Name</TableHead>
                      <TableHead>Serial #</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {serialSummary.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{s.item}</TableCell>
                        <TableCell><code className="px-1.5 py-0.5 rounded bg-muted text-xs">{s.serial}</code></TableCell>
                        <TableCell>
                          <Badge
                            variant={s.status === "in" ? "default" : "secondary"}
                            className={s.status === "in" ? "bg-emerald-500/10 text-emerald-600 border-emerald-200" : ""}
                          >
                            {s.status === "in" ? (
                              <><TrendingUp className="h-3 w-3 mr-1" /> In Stock</>
                            ) : (
                              <><TrendingDown className="h-3 w-3 mr-1" /> Issued</>
                            )}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!serialSummary.length && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                          <Hash className="h-10 w-10 mx-auto mb-3 opacity-40" />
                          <p>No serial-tracked stock</p>
                          <p className="text-xs mt-1">Enable serial tracking on items to see data here</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
