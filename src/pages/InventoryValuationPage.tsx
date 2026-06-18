import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/currency";

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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Inventory Valuation</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Total Items</div><div className="text-2xl font-semibold">{items.length}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Weighted Avg Value</div><div className="text-2xl font-semibold">{formatCurrency(totalWA, cur)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">FIFO Value</div><div className="text-2xl font-semibold">{formatCurrency(totalFIFO, cur)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Batches Tracked</div><div className="text-2xl font-semibold">{batchSummary.length}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="wa">
        <TabsList>
          <TabsTrigger value="wa">Weighted Avg</TabsTrigger>
          <TabsTrigger value="fifo">FIFO</TabsTrigger>
          <TabsTrigger value="batch">Batches</TabsTrigger>
          <TabsTrigger value="serial">Serials</TabsTrigger>
        </TabsList>

        <TabsContent value="wa">
          <Card><CardHeader><CardTitle className="text-base">Weighted Average Valuation</CardTitle></CardHeader>
            <CardContent>
              {loading ? <div className="py-8 text-center text-muted-foreground">Loading…</div> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Stock Qty</TableHead><TableHead className="text-right">Avg Cost</TableHead><TableHead className="text-right">Total Value</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {weightedAvg.map(r => (
                      <TableRow key={r.id}>
                        <TableCell>{r.name}</TableCell>
                        <TableCell className="text-right">{r.qty}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.avg, cur)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(r.value, cur)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fifo">
          <Card><CardHeader><CardTitle className="text-base">FIFO Valuation (per layer)</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Layers (qty @ cost)</TableHead><TableHead className="text-right">Total Qty</TableHead><TableHead className="text-right">Total Value</TableHead></TableRow></TableHeader>
                <TableBody>
                  {fifo.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.layers.length ? r.layers.map(l => `${l.qty}@${l.cost}`).join(", ") : "—"}</TableCell>
                      <TableCell className="text-right">{r.qty}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(r.value, cur)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="batch">
          <Card><CardHeader><CardTitle className="text-base">Batch Stock</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Batch #</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Expiry</TableHead></TableRow></TableHeader>
                <TableBody>
                  {batchSummary.map((b, i) => {
                    const expired = b.expiry && new Date(b.expiry) < new Date();
                    return (
                      <TableRow key={i}>
                        <TableCell>{b.item}</TableCell>
                        <TableCell className="font-mono">{b.batch}</TableCell>
                        <TableCell className="text-right">{b.qty}</TableCell>
                        <TableCell>{b.expiry ? (<span className={expired ? "text-destructive" : ""}>{b.expiry}{expired && " (expired)"}</span>) : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                  {!batchSummary.length && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No batch-tracked stock</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="serial">
          <Card><CardHeader><CardTitle className="text-base">Serial Numbers</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Serial #</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {serialSummary.map((s, i) => (
                    <TableRow key={i}>
                      <TableCell>{s.item}</TableCell>
                      <TableCell className="font-mono">{s.serial}</TableCell>
                      <TableCell><Badge variant={s.status === "in" ? "default" : "secondary"}>{s.status === "in" ? "In Stock" : "Issued"}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {!serialSummary.length && <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No serial-tracked stock</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
