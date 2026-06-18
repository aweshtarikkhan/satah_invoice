import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { logStockMovements } from "@/lib/stock";

interface Line {
  item_id: string;
  po_line_id: string | null;
  description: string;
  quantity: string;
  unit_cost: string;
  batch_no: string;
  serial_no: string;
  expiry_date: string;
}
const emptyLine = (): Line => ({ item_id: "", po_line_id: null, description: "", quantity: "0", unit_cost: "0", batch_no: "", serial_no: "", expiry_date: "" });

export default function GrnBuilderPage() {
  const org = useAppStore((s) => s.organization);
  const { user } = useAuth();
  const { id } = useParams();
  const [sp] = useSearchParams();
  const poFromQuery = sp.get("po");
  const navigate = useNavigate();
  const { toast } = useToast();
  const [vendors, setVendors] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const [poId, setPoId] = useState<string>("");
  const [vendorId, setVendorId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [grnNumber, setGrnNumber] = useState("");
  const [grnDate, setGrnDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [transporter, setTransporter] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!org?.id) return;
    (async () => {
      const [v, it, wh, br, p, o] = await Promise.all([
        (supabase as any).from("vendors").select("id,name").eq("org_id", org.id).order("name"),
        (supabase as any).from("items").select("id,name,track_batches,track_serials,purchase_price").eq("org_id", org.id).order("name"),
        (supabase as any).from("warehouses").select("id,name").eq("org_id", org.id),
        (supabase as any).from("branches").select("id,name,is_default").eq("org_id", org.id),
        (supabase as any).from("purchase_orders").select("id,po_number,vendor_id,warehouse_id,branch_id").eq("org_id", org.id).in("status", ["sent", "partial", "draft"]).order("po_date", { ascending: false }),
        (supabase as any).from("organizations").select("grn_next_number,grn_prefix").eq("id", org.id).maybeSingle(),
      ]);
      setVendors(v.data || []);
      setItems(it.data || []);
      setWarehouses(wh.data || []);
      setBranches(br.data || []);
      setPos(p.data || []);
      const def = (br.data || []).find((x: any) => x.is_default);
      if (def) setBranchId(def.id);
      if (!id) {
        const prefix = o.data?.grn_prefix || "GRN-";
        const next = o.data?.grn_next_number || 1;
        setGrnNumber(`${prefix}${String(next).padStart(4, "0")}`);
        if (poFromQuery) await loadFromPo(poFromQuery);
      } else {
        loadGrn();
      }
    })();
  }, [org?.id, id]);

  const loadFromPo = async (poid: string) => {
    setPoId(poid);
    const { data: po } = await (supabase as any).from("purchase_orders").select("*").eq("id", poid).maybeSingle();
    const { data: pl } = await (supabase as any).from("purchase_order_lines").select("*").eq("po_id", poid).order("sort_order");
    if (po) {
      setVendorId(po.vendor_id || "");
      setWarehouseId(po.warehouse_id || "");
      setBranchId(po.branch_id || "");
    }
    if (pl) setLines(pl.map((l: any) => ({
      item_id: l.item_id || "", po_line_id: l.id,
      description: l.description,
      quantity: String(Math.max(0, Number(l.quantity) - Number(l.received_quantity || 0))),
      unit_cost: String(l.rate || 0),
      batch_no: "", serial_no: "", expiry_date: "",
    })));
  };

  const loadGrn = async () => {
    const { data: g } = await (supabase as any).from("grns").select("*").eq("id", id).maybeSingle();
    const { data: gl } = await (supabase as any).from("grn_lines").select("*").eq("grn_id", id).order("sort_order");
    if (g) {
      setPoId(g.po_id || "");
      setVendorId(g.vendor_id || "");
      setWarehouseId(g.warehouse_id || "");
      setBranchId(g.branch_id || "");
      setGrnNumber(g.grn_number);
      setGrnDate(g.grn_date);
      setVehicleNumber(g.vehicle_number || "");
      setTransporter(g.transporter || "");
      setNotes(g.notes || "");
    }
    if (gl) setLines(gl.map((l: any) => ({
      item_id: l.item_id || "", po_line_id: l.po_line_id, description: l.description,
      quantity: String(l.quantity), unit_cost: String(l.unit_cost),
      batch_no: l.batch_no || "", serial_no: l.serial_no || "", expiry_date: l.expiry_date || "",
    })));
  };

  const total = useMemo(() => lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0), 0), [lines]);

  const pickItem = (idx: number, itemId: string) => {
    const it = items.find(x => x.id === itemId);
    const x = [...lines];
    x[idx].item_id = itemId;
    if (it) { x[idx].description = it.name; x[idx].unit_cost = String(it.purchase_price || 0); }
    setLines(x);
  };

  const save = async () => {
    if (!org?.id || !vendorId) { toast({ title: "Vendor required", variant: "destructive" }); return; }
    if (!lines.some(l => l.item_id && Number(l.quantity) > 0)) { toast({ title: "Add at least one received line", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const payload: any = {
        org_id: org.id, vendor_id: vendorId, po_id: poId || null,
        warehouse_id: warehouseId || null, branch_id: branchId || null,
        grn_number: grnNumber, grn_date: grnDate, status: "received",
        vehicle_number: vehicleNumber || null, transporter: transporter || null,
        notes: notes || null, created_by: user?.id || null,
      };
      let grnId = id;
      if (id) {
        const { error } = await (supabase as any).from("grns").update(payload).eq("id", id);
        if (error) throw error;
        await (supabase as any).from("grn_lines").delete().eq("grn_id", id);
      } else {
        const { data, error } = await (supabase as any).from("grns").insert(payload).select().single();
        if (error) throw error;
        grnId = data.id;
        const { data: o } = await (supabase as any).from("organizations").select("grn_next_number").eq("id", org.id).maybeSingle();
        await (supabase as any).from("organizations").update({ grn_next_number: (o?.grn_next_number || 1) + 1 }).eq("id", org.id);
      }
      const linePayloads = lines.filter(l => l.item_id && Number(l.quantity) > 0).map((l, idx) => ({
        org_id: org.id, grn_id: grnId, po_line_id: l.po_line_id, item_id: l.item_id,
        description: l.description,
        quantity: Number(l.quantity), unit_cost: Number(l.unit_cost),
        amount: Number(l.quantity) * Number(l.unit_cost),
        batch_no: l.batch_no || null, serial_no: l.serial_no || null,
        expiry_date: l.expiry_date || null, sort_order: idx,
      }));
      const { error: lErr } = await (supabase as any).from("grn_lines").insert(linePayloads);
      if (lErr) throw lErr;

      // Only post stock movements + update item stock + PO received qty on first save (new GRN)
      if (!id) {
        // Update item stock_quantity and post stock movements
        for (const lp of linePayloads) {
          const { data: it } = await (supabase as any).from("items").select("stock_quantity").eq("id", lp.item_id).maybeSingle();
          const newQty = Number(it?.stock_quantity || 0) + Number(lp.quantity);
          await (supabase as any).from("items").update({ stock_quantity: newQty }).eq("id", lp.item_id);
          await logStockMovements([{
            orgId: org.id, itemId: lp.item_id!, changeQty: Number(lp.quantity),
            balanceAfter: newQty, reason: `GRN ${grnNumber}`,
            refType: "manual", refId: grnId!, refNumber: grnNumber, createdBy: user?.id || null,
          }]);
          // record batch/serial/cost/warehouse on the latest movement
          await (supabase as any).from("stock_movements").update({
            batch_no: lp.batch_no, serial_no: lp.serial_no, expiry_date: lp.expiry_date,
            unit_cost: lp.unit_cost, warehouse_id: warehouseId || null,
          }).eq("ref_id", grnId).eq("item_id", lp.item_id);
        }
        // Update PO line received_quantity
        for (const lp of linePayloads) {
          if (!lp.po_line_id) continue;
          const { data: pl } = await (supabase as any).from("purchase_order_lines").select("received_quantity,quantity").eq("id", lp.po_line_id).maybeSingle();
          const recv = Number(pl?.received_quantity || 0) + Number(lp.quantity);
          await (supabase as any).from("purchase_order_lines").update({ received_quantity: recv }).eq("id", lp.po_line_id);
        }
        // Update PO status
        if (poId) {
          const { data: allLines } = await (supabase as any).from("purchase_order_lines").select("quantity,received_quantity").eq("po_id", poId);
          const allReceived = (allLines || []).every((x: any) => Number(x.received_quantity) >= Number(x.quantity));
          const anyReceived = (allLines || []).some((x: any) => Number(x.received_quantity) > 0);
          await (supabase as any).from("purchase_orders").update({ status: allReceived ? "received" : anyReceived ? "partial" : "sent" }).eq("id", poId);
        }
      }

      toast({ title: id ? "GRN updated" : "GRN created — stock updated" });
      navigate(`/grns/${grnId}`);
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{id ? "Edit GRN" : "New Goods Receipt"}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/grns")}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save GRN"}</Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label>Purchase Order</Label>
            <Select value={poId} onValueChange={loadFromPo}>
              <SelectTrigger><SelectValue placeholder="Select PO (optional)" /></SelectTrigger>
              <SelectContent>{pos.map(p => <SelectItem key={p.id} value={p.id}>{p.po_number}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Vendor *</Label>
            <Select value={vendorId} onValueChange={setVendorId}>
              <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
              <SelectContent>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Warehouse</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger><SelectValue placeholder="Warehouse" /></SelectTrigger>
              <SelectContent>{warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Branch</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger><SelectValue placeholder="Branch" /></SelectTrigger>
              <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>GRN #</Label><Input value={grnNumber} onChange={e => setGrnNumber(e.target.value)} /></div>
          <div><Label>GRN Date</Label><Input type="date" value={grnDate} onChange={e => setGrnDate(e.target.value)} /></div>
          <div><Label>Vehicle #</Label><Input value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} placeholder="MH-12-AB-1234" /></div>
          <div><Label>Transporter</Label><Input value={transporter} onChange={e => setTransporter(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Received Items</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setLines([...lines, emptyLine()])}><Plus className="h-4 w-4 mr-1" /> Add Line</Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="min-w-48">Item</TableHead><TableHead>Description</TableHead>
              <TableHead className="w-20">Qty</TableHead><TableHead className="w-24">Unit Cost</TableHead>
              <TableHead className="w-28">Batch #</TableHead><TableHead className="w-28">Serial #</TableHead>
              <TableHead className="w-32">Expiry</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {lines.map((l, i) => {
                const it = items.find(x => x.id === l.item_id);
                return (
                  <TableRow key={i}>
                    <TableCell>
                      <Select value={l.item_id} onValueChange={(v) => pickItem(i, v)}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Item" /></SelectTrigger>
                        <SelectContent>{items.map(x => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Input value={l.description} onChange={e => { const x = [...lines]; x[i].description = e.target.value; setLines(x); }} /></TableCell>
                    <TableCell><Input type="number" value={l.quantity} onChange={e => { const x = [...lines]; x[i].quantity = e.target.value; setLines(x); }} /></TableCell>
                    <TableCell><Input type="number" value={l.unit_cost} onChange={e => { const x = [...lines]; x[i].unit_cost = e.target.value; setLines(x); }} /></TableCell>
                    <TableCell><Input value={l.batch_no} onChange={e => { const x = [...lines]; x[i].batch_no = e.target.value; setLines(x); }} disabled={!it?.track_batches} placeholder={it?.track_batches ? "" : "—"} /></TableCell>
                    <TableCell><Input value={l.serial_no} onChange={e => { const x = [...lines]; x[i].serial_no = e.target.value; setLines(x); }} disabled={!it?.track_serials} placeholder={it?.track_serials ? "" : "—"} /></TableCell>
                    <TableCell><Input type="date" value={l.expiry_date} onChange={e => { const x = [...lines]; x[i].expiry_date = e.target.value; setLines(x); }} /></TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="mt-4 text-right text-sm">Total Inventory Value: <span className="font-semibold">{total.toFixed(2)}</span></div>
        </CardContent>
      </Card>

      <Card><CardContent className="pt-5"><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></CardContent></Card>
    </div>
  );
}
