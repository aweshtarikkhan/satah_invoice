import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

const ENTITY_TYPES = [
  { value: "invoice", label: "Invoice" },
  { value: "estimate", label: "Estimate" },
  { value: "credit_note", label: "Credit Note" },
  { value: "client", label: "Client" },
  { value: "item", label: "Item" },
];

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "dropdown", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
];

export default function CustomFieldsPage() {
  const org = useAppStore((s) => s.organization);
  const { toast } = useToast();
  const [fields, setFields] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("invoice");
  const [form, setForm] = useState({
    field_name: "", field_type: "text", is_required: false, field_options: "",
  });

  const fetchFields = async () => {
    if (!org?.id) return;
    const { data } = await supabase
      .from("custom_field_definitions")
      .select("*")
      .eq("org_id", org.id)
      .order("sort_order");
    setFields(data || []);
  };

  useEffect(() => { fetchFields(); }, [org?.id]);

  const saveField = async () => {
    if (!form.field_name.trim()) return;
    const options = form.field_type === "dropdown" && form.field_options
      ? form.field_options.split(",").map((o) => o.trim()).filter(Boolean)
      : null;

    const { error } = await supabase.from("custom_field_definitions").insert({
      org_id: org!.id,
      entity_type: activeTab,
      field_name: form.field_name,
      field_type: form.field_type,
      is_required: form.is_required,
      field_options: options,
      sort_order: fields.filter((f) => f.entity_type === activeTab).length,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setDialogOpen(false);
      setForm({ field_name: "", field_type: "text", is_required: false, field_options: "" });
      fetchFields();
      toast({ title: "Custom field added!" });
    }
  };

  const deleteField = async (id: string) => {
    await supabase.from("custom_field_definitions").delete().eq("id", id);
    fetchFields();
    toast({ title: "Custom field deleted" });
  };

  const filteredFields = fields.filter((f) => f.entity_type === activeTab);

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <PageHeader title="Custom Fields" description="Define custom fields for your documents and entities">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Add Field
        </Button>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {ENTITY_TYPES.map((et) => (
            <TabsTrigger key={et.value} value={et.value}>
              {et.label}
              {fields.filter((f) => f.entity_type === et.value).length > 0 && (
                <span className="ml-1 text-xs text-muted-foreground">
                  ({fields.filter((f) => f.entity_type === et.value).length})
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {ENTITY_TYPES.map((et) => (
          <TabsContent key={et.value} value={et.value} className="mt-4">
            <Card>
              <CardContent className="p-0">
                {filteredFields.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No custom fields for {et.label.toLowerCase()}s yet.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Field Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Required</TableHead>
                        <TableHead>Options</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFields.map((f) => (
                        <TableRow key={f.id}>
                          <TableCell className="font-medium">{f.field_name}</TableCell>
                          <TableCell className="capitalize">{f.field_type}</TableCell>
                          <TableCell>{f.is_required ? "Yes" : "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {f.field_options ? (f.field_options as string[]).join(", ") : "—"}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => deleteField(f.id)}>
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
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Field to {ENTITY_TYPES.find((e) => e.value === activeTab)?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Field Name</Label>
              <Input value={form.field_name} onChange={(e) => setForm({ ...form, field_name: e.target.value })} placeholder="e.g. Project Code" />
            </div>
            <div className="space-y-2">
              <Label>Field Type</Label>
              <Select value={form.field_type} onValueChange={(v) => setForm({ ...form, field_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((ft) => <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.field_type === "dropdown" && (
              <div className="space-y-2">
                <Label>Options (comma-separated)</Label>
                <Input value={form.field_options} onChange={(e) => setForm({ ...form, field_options: e.target.value })} placeholder="Option 1, Option 2, Option 3" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Checkbox checked={form.is_required} onCheckedChange={(v) => setForm({ ...form, is_required: !!v })} />
              <Label>Required field</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveField}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
