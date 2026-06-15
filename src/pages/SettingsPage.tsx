import { useState, useEffect } from "react";
import { CURRENCIES } from "@/lib/currency";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
import { SEO } from "@/components/shared/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
  const org = useAppStore((s) => s.organization);
  const setOrganization = useAppStore((s) => s.setOrganization);
  const { toast } = useToast();

  // Org form
  const [orgForm, setOrgForm] = useState({
    name: "", email: "", phone: "", website: "",
    tax_number: "", tax_name: "", currency_code: "USD",
    invoice_prefix: "INV", payment_terms: 30,
    default_notes: "", default_terms: "",
    address: { street: "", city: "", state: "", zip: "", country: "" },
    gst_enabled: false, gst_number: "", show_client_gst: false, qr_code_enabled: false,
    upi_id: "",
    inventory_enabled: false, low_stock_threshold: 5,
    multi_warehouse_enabled: false,
  });

  // Tax rates
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [taxDialogOpen, setTaxDialogOpen] = useState(false);
  const [taxForm, setTaxForm] = useState({ name: "", rate: 0, is_default: false });

  useEffect(() => {
    if (!org) return;
    setOrgForm({
      name: org.name || "", email: org.email || "", phone: org.phone || "",
      website: org.website || "", tax_number: org.tax_number || "", tax_name: org.tax_name || "",
      currency_code: org.currency_code || "USD", invoice_prefix: org.invoice_prefix || "INV",
      payment_terms: org.payment_terms || 30, default_notes: org.default_notes || "",
      default_terms: org.default_terms || "",
      address: (org.address as any) || { street: "", city: "", state: "", zip: "", country: "" },
      gst_enabled: org.gst_enabled || false, gst_number: org.gst_number || "",
      show_client_gst: org.show_client_gst || false, qr_code_enabled: org.qr_code_enabled || false,
      upi_id: (org as any).upi_id || "",
      inventory_enabled: (org as any).inventory_enabled || false,
      low_stock_threshold: Number((org as any).low_stock_threshold ?? 5),
      multi_warehouse_enabled: (org as any).multi_warehouse_enabled || false,
    });
    fetchTaxRates();
  }, [org]);

  const fetchTaxRates = async () => {
    if (!org?.id) return;
    const { data } = await supabase.from("tax_rates").select("*").eq("org_id", org.id).order("name");
    setTaxRates(data || []);
  };

  const saveOrg = async () => {
    if (!org?.id) return;
    const { error } = await supabase.from("organizations").update(orgForm).eq("id", org.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setOrganization({ ...org, ...orgForm } as any);
      toast({ title: "Settings saved!" });
    }
  };

  const saveTaxRate = async () => {
    if (!taxForm.name.trim()) return;
    const { error } = await supabase.from("tax_rates").insert({
      org_id: org!.id,
      name: taxForm.name,
      rate: taxForm.rate,
      is_default: taxForm.is_default,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setTaxDialogOpen(false);
      setTaxForm({ name: "", rate: 0, is_default: false });
      fetchTaxRates();
      toast({ title: "Tax rate added!" });
    }
  };

  const deleteTaxRate = async (id: string) => {
    await supabase.from("tax_rates").delete().eq("id", id);
    fetchTaxRates();
    toast({ title: "Tax rate deleted" });
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <SEO title="Settings" description="Configure organization details, currency, tax rates, branding and document preferences." path="/settings" />
      <PageHeader title="Settings" description="Manage your organization and preferences" />

      <Tabs defaultValue="organization">
        <TabsList>
          <TabsTrigger value="organization">Organization</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="taxes">Tax Rates</TabsTrigger>
        </TabsList>

        <TabsContent value="organization" className="space-y-6 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Business Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Organization Name</Label>
                  <Input value={orgForm.name} onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={orgForm.email} onChange={(e) => setOrgForm({ ...orgForm, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={orgForm.phone} onChange={(e) => setOrgForm({ ...orgForm, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input value={orgForm.website} onChange={(e) => setOrgForm({ ...orgForm, website: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Street Address</Label>
                <Input value={orgForm.address.street} onChange={(e) => setOrgForm({ ...orgForm, address: { ...orgForm.address, street: e.target.value } })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input value={orgForm.address.city} onChange={(e) => setOrgForm({ ...orgForm, address: { ...orgForm.address, city: e.target.value } })} />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input value={orgForm.address.state} onChange={(e) => setOrgForm({ ...orgForm, address: { ...orgForm.address, state: e.target.value } })} />
                </div>
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input value={orgForm.address.country} onChange={(e) => setOrgForm({ ...orgForm, address: { ...orgForm.address, country: e.target.value } })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tax Name (e.g. GST, VAT)</Label>
                  <Input value={orgForm.tax_name} onChange={(e) => setOrgForm({ ...orgForm, tax_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Tax Number</Label>
                  <Input value={orgForm.tax_number} onChange={(e) => setOrgForm({ ...orgForm, tax_number: e.target.value })} />
                </div>
              </div>
              <Button onClick={saveOrg}>Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-6 mt-4">
          <Tabs defaultValue="preferences">
            <TabsList>
              <TabsTrigger value="preferences">Preferences</TabsTrigger>
              <TabsTrigger value="defaults">Defaults & Numbering</TabsTrigger>
            </TabsList>

            <TabsContent value="preferences" className="space-y-6 mt-4">
              <Card>
                <CardHeader><CardTitle className="text-base">General</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Checkbox id="edit-sent" />
                    <Label htmlFor="edit-sent">Allow editing of Sent Invoice?</Label>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Payments</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Checkbox id="notify-online" defaultChecked />
                    <Label htmlFor="notify-online">Get notified when customers pay online</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox id="receipt-thankyou" defaultChecked />
                    <Label htmlFor="receipt-thankyou">Include the payment receipt along with the Thank You note?</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox id="auto-thankyou" />
                    <Label htmlFor="auto-thankyou">Automate thank you note to customer on receipt of online payment</Label>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Zero-Value Line Items</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Checkbox id="hide-zero" />
                    <Label htmlFor="hide-zero">Hide zero-value line items</Label>
                  </div>
                  <p className="text-xs text-muted-foreground ml-7">
                    Choose whether to hide zero-value line items in an invoice's PDF and the Customer Portal. They will still be visible while editing an invoice.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Terms & Conditions</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Default Terms & Conditions</Label>
                    <Textarea value={orgForm.default_terms} onChange={(e) => setOrgForm({ ...orgForm, default_terms: e.target.value })} rows={4} />
                  </div>
                  <div className="space-y-2">
                    <Label>Customer Notes</Label>
                    <Textarea value={orgForm.default_notes} onChange={(e) => setOrgForm({ ...orgForm, default_notes: e.target.value })} placeholder="Thanks for your business." rows={4} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">GST Settings</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable GST</Label>
                      <p className="text-xs text-muted-foreground">Show GST details on invoices</p>
                    </div>
                    <Switch checked={orgForm.gst_enabled} onCheckedChange={(v) => setOrgForm({ ...orgForm, gst_enabled: v })} />
                  </div>
                  {orgForm.gst_enabled && (
                    <>
                      <div className="space-y-2">
                        <Label>Your GST Number</Label>
                        <Input value={orgForm.gst_number} onChange={(e) => setOrgForm({ ...orgForm, gst_number: e.target.value })} placeholder="e.g. 22AAAAA0000A1Z5" />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Show Client GST</Label>
                          <p className="text-xs text-muted-foreground">Include client's GST number on invoice for input tax credit claims</p>
                        </div>
                        <Switch checked={orgForm.show_client_gst} onCheckedChange={(v) => setOrgForm({ ...orgForm, show_client_gst: v })} />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">QR Code & UPI Payment</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Embed QR Code</Label>
                      <p className="text-xs text-muted-foreground">Add a UPI payment QR code to invoices with exact invoice amount</p>
                    </div>
                    <Switch checked={orgForm.qr_code_enabled} onCheckedChange={(v) => setOrgForm({ ...orgForm, qr_code_enabled: v })} />
                  </div>
                  {orgForm.qr_code_enabled && (
                    <div className="space-y-2">
                      <Label>UPI ID</Label>
                      <Input value={orgForm.upi_id} onChange={(e) => setOrgForm({ ...orgForm, upi_id: e.target.value })} placeholder="e.g. yourname@upi or 9999999999@paytm" />
                      <p className="text-xs text-muted-foreground">Enter your UPI ID to generate payment QR codes on invoices with the exact balance amount</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Inventory Management</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Inventory Tracking</Label>
                      <p className="text-xs text-muted-foreground">Turn on if you sell physical products. Stock auto-deducts on each invoice. Service businesses can leave this off.</p>
                    </div>
                    <Switch checked={orgForm.inventory_enabled} onCheckedChange={(v) => setOrgForm({ ...orgForm, inventory_enabled: v })} />
                  </div>
                  {orgForm.inventory_enabled && (
                    <div className="space-y-2">
                      <Label>Low Stock Alert Threshold</Label>
                      <Input type="number" min={0} value={orgForm.low_stock_threshold} onChange={(e) => setOrgForm({ ...orgForm, low_stock_threshold: parseFloat(e.target.value) || 0 })} />
                      <p className="text-xs text-muted-foreground">Items at or below this stock level appear in the dashboard low-stock alert.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Button onClick={saveOrg}>Save</Button>
            </TabsContent>

            <TabsContent value="defaults" className="space-y-6 mt-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Invoice Defaults</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Invoice Prefix</Label>
                      <Input value={orgForm.invoice_prefix} onChange={(e) => setOrgForm({ ...orgForm, invoice_prefix: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Currency</Label>
                      <Select value={orgForm.currency_code} onValueChange={(v) => setOrgForm({ ...orgForm, currency_code: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map((c) => (
                            <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Payment Terms (days)</Label>
                      <Input type="number" value={orgForm.payment_terms} onChange={(e) => setOrgForm({ ...orgForm, payment_terms: parseInt(e.target.value) || 30 })} />
                    </div>
                  </div>
                  <Button onClick={saveOrg}>Save Changes</Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="taxes" className="space-y-6 mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Tax Rates</CardTitle>
              <Button size="sm" onClick={() => setTaxDialogOpen(true)}>
                <Plus className="mr-1 h-4 w-4" /> Add Tax Rate
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {taxRates.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No tax rates configured. Add one to use in invoices.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Default</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {taxRates.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell>{t.rate}%</TableCell>
                        <TableCell>{t.is_default ? "Yes" : "—"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => deleteTaxRate(t.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Dialog open={taxDialogOpen} onOpenChange={setTaxDialogOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Tax Rate</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={taxForm.name} onChange={(e) => setTaxForm({ ...taxForm, name: e.target.value })} placeholder="e.g. GST, VAT" />
                </div>
                <div className="space-y-2">
                  <Label>Rate (%)</Label>
                  <Input type="number" step="0.01" value={taxForm.rate} onChange={(e) => setTaxForm({ ...taxForm, rate: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox checked={taxForm.is_default} onCheckedChange={(v) => setTaxForm({ ...taxForm, is_default: !!v })} />
                  <Label>Set as default</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTaxDialogOpen(false)}>Cancel</Button>
                <Button onClick={saveTaxRate}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
