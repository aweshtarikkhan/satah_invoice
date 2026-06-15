import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
import { SEO } from "@/components/shared/SEO";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, RefreshCw, Trash2, Play, Pause, Zap } from "lucide-react";
import { format } from "date-fns";
import { generateRecurringInvoice } from "@/lib/recurring";

export default function RecurringInvoicesPage() {
  const navigate = useNavigate();
  const org = useAppStore((s) => s.organization);
  const [recurring, setRecurring] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const { toast } = useToast();

  const [form, setForm] = useState({
    client_id: "",
    frequency: "monthly",
    next_run_date: format(new Date(), "yyyy-MM-dd"),
    template_invoice_id: "",
    is_active: true,
    notes: "",
  });

  const fetchData = async () => {
    if (!org?.id) return;
    setLoading(true);
    const [rec, cl, inv] = await Promise.all([
      supabase.from("recurring_invoices").select("*, clients(display_name)").eq("org_id", org.id).order("created_at", { ascending: false }),
      supabase.from("clients").select("id, display_name").eq("org_id", org.id).eq("status", "active").order("display_name"),
      supabase.from("invoices").select("id, invoice_number, client_id, total").eq("org_id", org.id).order("created_at", { ascending: false }).limit(50),
    ]);
    setRecurring(rec.data || []);
    setClients(cl.data || []);
    setInvoices(inv.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [org?.id]);

  const resetForm = () => {
    setForm({ client_id: "", frequency: "monthly", next_run_date: format(new Date(), "yyyy-MM-dd"), template_invoice_id: "", is_active: true, notes: "" });
    setEditItem(null);
  };

  const handleSave = async () => {
    if (!form.client_id) { toast({ title: "Select a client", variant: "destructive" }); return; }
    const payload = {
      ...form,
      org_id: org!.id,
      template_invoice_id: form.template_invoice_id || null,
      currency_code: org?.currency_code || "USD",
    };
    if (editItem) {
      const { error } = await supabase.from("recurring_invoices").update(payload).eq("id", editItem.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Schedule updated" });
    } else {
      const { error } = await supabase.from("recurring_invoices").insert(payload);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Recurring invoice created" });
    }
    setDialogOpen(false);
    resetForm();
    fetchData();
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    await supabase.from("recurring_invoices").update({ is_active: !isActive }).eq("id", id);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("recurring_invoices").delete().eq("id", id);
    toast({ title: "Deleted" });
    fetchData();
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setForm({
      client_id: item.client_id,
      frequency: item.frequency,
      next_run_date: item.next_run_date,
      template_invoice_id: item.template_invoice_id || "",
      is_active: item.is_active,
      notes: item.notes || "",
    });
    setDialogOpen(true);
  };

  const freqLabel: Record<string, string> = { weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly" };

  return (
    <div className="p-6 space-y-6">
      <SEO title="Recurring Invoices" description="Automate billing with scheduled recurring invoices for subscriptions and retainers." path="/recurring-invoices" />
      <PageHeader title="Recurring Invoices" description="Automate invoice generation on a schedule">
        <Button onClick={() => { resetForm(); setDialogOpen(true); }} size="sm">
          <Plus className="mr-1 h-4 w-4" /> New Schedule
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : recurring.length === 0 ? (
            <EmptyState icon={RefreshCw} title="No recurring invoices" description="Set up automated invoice generation." actionLabel="Create Schedule" onAction={() => { resetForm(); setDialogOpen(true); }} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Next Run</TableHead>
                  <TableHead>Last Generated</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recurring.map((item) => (
                  <TableRow key={item.id} className="cursor-pointer" onClick={() => openEdit(item)}>
                    <TableCell className="font-medium">{(item as any).clients?.display_name || "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{freqLabel[item.frequency] || item.frequency}</Badge></TableCell>
                    <TableCell>{format(new Date(item.next_run_date), "dd MMM yyyy")}</TableCell>
                    <TableCell>{item.last_generated_at ? format(new Date(item.last_generated_at), "dd MMM yyyy") : "Never"}</TableCell>
                    <TableCell>
                      <Badge variant={item.is_active ? "default" : "secondary"}>
                        {item.is_active ? "Active" : "Paused"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleActive(item.id, item.is_active)}>
                          {item.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
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
            <DialogTitle>{editItem ? "Edit Schedule" : "New Recurring Invoice"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Client *</Label>
              <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Next Run Date</Label>
                <Input type="date" value={form.next_run_date} onChange={(e) => setForm({ ...form, next_run_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Template Invoice (optional)</Label>
              <Select value={form.template_invoice_id || "none"} onValueChange={(v) => setForm({ ...form, template_invoice_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No template</SelectItem>
                  {invoices.filter(i => !form.client_id || i.client_id === form.client_id).map(i => (
                    <SelectItem key={i.id} value={i.id}>{i.invoice_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editItem ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
