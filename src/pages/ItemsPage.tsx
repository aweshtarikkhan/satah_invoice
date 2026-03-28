import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ImportDialog, ImportField } from "@/components/shared/ImportDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Package, Search, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const itemImportFields: ImportField[] = [
  { key: "name", label: "Item Name", required: true },
  { key: "description", label: "Description" },
  { key: "sku", label: "SKU" },
  { key: "type", label: "Product Type (service/product)" },
  { key: "unit_price", label: "Rate" },
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
  const { toast } = useToast();

  const [form, setForm] = useState({
    name: "", description: "", sku: "", type: "service" as "service" | "product",
    unit_price: 0, unit: "", tax_id: null as string | null,
  });

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
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, [org?.id]);

  const resetForm = () => {
    setForm({ name: "", description: "", sku: "", type: "service", unit_price: 0, unit: "", tax_id: null });
    setEditItem(null);
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (item: any) => {
    setEditItem(item);
    setForm({
      name: item.name, description: item.description || "", sku: item.sku || "",
      type: item.type, unit_price: Number(item.unit_price), unit: item.unit || "",
      tax_id: item.tax_id,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    const payload = { ...form, org_id: org!.id };
    if (editItem) {
      const { error } = await supabase.from("items").update(payload).eq("id", editItem.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Item updated" });
    } else {
      const { error } = await supabase.from("items").insert(payload);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Item created" });
    }
    setDialogOpen(false);
    resetForm();
    fetchItems();
  };

  const filtered = items.filter((i) =>
    [i.name, i.sku, i.description].filter(Boolean).some((f) => f.toLowerCase().includes(search.toLowerCase()))
  );

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: org?.currency_code || "USD" }).format(n);

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Items" description="Products and services catalog">
        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
          <Upload className="mr-1 h-4 w-4" /> Import
        </Button>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1 h-4 w-4" /> Add Item
        </Button>
      </PageHeader>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search items..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Package} title="No items yet" description="Add products or services to use in invoices." actionLabel="Add Item" onAction={openCreate} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead>Tax</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id} className="cursor-pointer" onClick={() => openEdit(item)}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.sku || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{item.type}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{fmt(Number(item.unit_price))}</TableCell>
                    <TableCell>{item.tax_rates ? `${item.tax_rates.name} (${item.tax_rates.rate}%)` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Item" : "Add Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="product">Product</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Rate</Label>
                <Input type="number" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
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
            <div className="space-y-2">
              <Label>Tax Rate</Label>
              <Select value={form.tax_id || "none"} onValueChange={(v) => setForm({ ...form, tax_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="No tax" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No tax</SelectItem>
                  {taxRates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name} ({t.rate}%)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editItem ? "Update" : "Create"}</Button>
          </DialogFooter>
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
            const { error } = await supabase.from("items").insert({
              org_id: org!.id,
              name: row.name || "Unnamed",
              description: row.description || null,
              sku: row.sku || null,
              type: row.type === "product" ? "product" : "service",
              unit_price: parseFloat(row.unit_price) || 0,
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
