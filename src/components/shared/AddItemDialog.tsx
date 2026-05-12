import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemAdded: (item: { id: string; name: string; unit_price: number; description: string | null; tax_id: string | null }) => void;
  taxRates?: any[];
  defaultType?: "service" | "product";
}

export function AddItemDialog({ open, onOpenChange, onItemAdded, taxRates = [], defaultType = "service" }: AddItemDialogProps) {
  const org = useAppStore((s) => s.organization);
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", sku: "", type: defaultType as "service" | "product",
    unit_price: 0, unit: "", tax_id: null as string | null,
  });

  const reset = () => {
    setForm({ name: "", description: "", sku: "", type: defaultType, unit_price: 0, unit: "", tax_id: null });
  };

  const handleSave = async () => {
    if (!form.name.trim() || !org?.id) {
      toast({ title: "Item name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.from("items").insert({
      org_id: org.id, name: form.name, description: form.description || null,
      sku: form.sku || null, type: form.type, unit_price: form.unit_price,
      unit: form.unit || null, tax_id: form.tax_id,
    }).select().single();

    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Item created" });
    onItemAdded({ id: data.id, name: data.name, unit_price: data.unit_price, description: data.description, tax_id: data.tax_id });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Item name" />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="service">Service</SelectItem>
                  <SelectItem value="product">Product</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Rate</Label>
              <Input type="number" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>SKU</Label>
              <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="Optional" />
            </div>
            <div className="space-y-1">
              <Label>Unit</Label>
              <Select value={form.unit || "pcs"} onValueChange={(v) => setForm({ ...form, unit: v })}>
                <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                <SelectContent>
                  {["pcs", "kg", "g", "ltr", "ml", "m", "cm", "ft", "inch", "box", "nos", "hrs", "days", "pair", "set", "sqft", "sqm", "ton", "dozen", "bundle", "roll", "bag", "carton"].map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {taxRates.length > 0 && (
            <div className="space-y-1">
              <Label>Tax Rate</Label>
              <Select value={form.tax_id || "none"} onValueChange={(v) => setForm({ ...form, tax_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="No tax" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No tax</SelectItem>
                  {taxRates.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name} ({t.rate}%)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Add Item"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
