import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { Plus, Trash2, Printer } from "lucide-react";
import { format } from "date-fns";

interface Line {
  item_id: string;
  description: string;
  quantity: string;
  unit: string;
  batch_no: string;
  serial_no: string;
}
const emptyLine = (): Line => ({ item_id: "", description: "", quantity: "1", unit: "", batch_no: "", serial_no: "" });

export default function DeliveryChallanBuilderPage() {
  const org = useAppStore((s) => s.organization);
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [clients, setClients] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [clientId, setClientId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [number, setNumber] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [status, setStatus] = useState("dispatched");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [transporter, setTransporter] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [ewayBill, setEwayBill] = useState("");
  const [destination, setDestination] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!org?.id) return;
    (async () => {
      const [c, it, wh, o] = await Promise.all([
        (supabase as any).from("clients").select("id,name").eq("org_id", org.id).order("name"),
        (supabase as any).from("items").select("id,name,unit,track_batches,track_serials").eq("org_id", org.id).order("name"),
        (supabase as any).from("warehouses").select("id,name").eq("org_id", org.id),
        (supabase as any).from("organizations").select("dc_next_number,dc_prefix").eq("id", org.id).maybeSingle(),
      ]);
      setClients(c.data || []);
      setItems(it.data || []);
      setWarehouses(wh.data || []);
      if (!id) {
        const prefix = o.data?.dc_prefix || "DC-";
        const next = o.data?.dc_next_number || 1;
        setNumber(`${prefix}${String(next).padStart(4, "0")}`);
      } else {
        const { data: d } = await (supabase as any).from("delivery_challans").select("*").eq("id", id).maybeSingle();
        const { data: l } = await (supabase as any).from("delivery_challan_lines").select("*").eq("dc_id", id).order("sort_order");
        if (d) {
          setClientId(d.client_id || ""); setWarehouseId(d.warehouse_id || "");
          setNumber(d.challan_number); setDate(d.challan_date); setStatus(d.status);
          setVehicleNumber(d.vehicle_number || ""); setTransporter(d.transporter || "");
          setDriverName(d.driver_name || ""); setDriverPhone(d.driver_phone || "");
          setEwayBill(d.eway_bill_number || ""); setDestination(d.destination || "");
          setNotes(d.notes || "");
        }
        if (l) setLines(l.map((x: any) => ({
          item_id: x.item_id || "", description: x.description, quantity: String(x.quantity),
          unit: x.unit || "", batch_no: x.batch_no || "", serial_no: x.serial_no || "",
        })));
      }
    })();
  }, [org?.id, id]);

  const pickItem = (i: number, itemId: string) => {
    const it = items.find(x => x.id === itemId);
    const x = [...lines]; x[i].item_id = itemId;
    if (it) { x[i].description = it.name; x[i].unit = it.unit || ""; }
    setLines(x);
  };

  const save = async () => {
    if (!org?.id || !clientId) { toast({ title: "Client required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const payload: any = {
        org_id: org.id, client_id: clientId, warehouse_id: warehouseId || null,
        challan_number: number, challan_date: date, status,
        vehicle_number: vehicleNumber || null, transporter: transporter || null,
        driver_name: driverName || null, driver_phone: driverPhone || null,
        eway_bill_number: ewayBill || null, destination: destination || null,
        notes: notes || null, created_by: user?.id || null,
      };
      let dcId = id;
      if (id) {
        const { error } = await (supabase as any).from("delivery_challans").update(payload).eq("id", id);
        if (error) throw error;
        await (supabase as any).from("delivery_challan_lines").delete().eq("dc_id", id);
      } else {
        const { data, error } = await (supabase as any).from("delivery_challans").insert(payload).select().single();
        if (error) throw error;
        dcId = data.id;
        const { data: o } = await (supabase as any).from("organizations").select("dc_next_number").eq("id", org.id).maybeSingle();
        await (supabase as any).from("organizations").update({ dc_next_number: (o?.dc_next_number || 1) + 1 }).eq("id", org.id);
      }
      const payloads = lines.filter(l => l.description).map((l, idx) => ({
        org_id: org.id, dc_id: dcId, item_id: l.item_id || null,
        description: l.description, quantity: Number(l.quantity) || 0, unit: l.unit || null,
        batch_no: l.batch_no || null, serial_no: l.serial_no || null, sort_order: idx,
      }));
      const { error: lErr } = await (supabase as any).from("delivery_challan_lines").insert(payloads);
      if (lErr) throw lErr;
      toast({ title: id ? "Challan updated" : "Challan created" });
      navigate("/delivery-challans");
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{id ? "Edit Delivery Challan" : "New Delivery Challan"}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/delivery-challans")}>Cancel</Button>
          {id && <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Print</Button>}
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Challan"}</Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label>Client *</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Warehouse</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger><SelectValue placeholder="From warehouse" /></SelectTrigger>
              <SelectContent>{warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Challan #</Label><Input value={number} onChange={e => setNumber(e.target.value)} /></div>
          <div><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div><Label>Vehicle #</Label><Input value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} placeholder="MH-12-AB-1234" /></div>
          <div><Label>Transporter</Label><Input value={transporter} onChange={e => setTransporter(e.target.value)} /></div>
          <div><Label>Driver Name</Label><Input value={driverName} onChange={e => setDriverName(e.target.value)} /></div>
          <div><Label>Driver Phone</Label><Input value={driverPhone} onChange={e => setDriverPhone(e.target.value)} /></div>
          <div><Label>E-way Bill #</Label><Input value={ewayBill} onChange={e => setEwayBill(e.target.value)} /></div>
          <div className="md:col-span-2"><Label>Destination</Label><Input value={destination} onChange={e => setDestination(e.target.value)} placeholder="Delivery address / city" /></div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="dispatched">Dispatched</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Items Dispatched</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setLines([...lines, emptyLine()])}><Plus className="h-4 w-4 mr-1" /> Add Line</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-48">Item</TableHead><TableHead>Description</TableHead>
              <TableHead className="w-20">Qty</TableHead><TableHead className="w-20">Unit</TableHead>
              <TableHead className="w-28">Batch</TableHead><TableHead className="w-28">Serial</TableHead><TableHead></TableHead>
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
                    <TableCell><Input value={l.unit} onChange={e => { const x = [...lines]; x[i].unit = e.target.value; setLines(x); }} /></TableCell>
                    <TableCell><Input value={l.batch_no} onChange={e => { const x = [...lines]; x[i].batch_no = e.target.value; setLines(x); }} disabled={!it?.track_batches} /></TableCell>
                    <TableCell><Input value={l.serial_no} onChange={e => { const x = [...lines]; x[i].serial_no = e.target.value; setLines(x); }} disabled={!it?.track_serials} /></TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card><CardContent className="pt-5"><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></CardContent></Card>
    </div>
  );
}
