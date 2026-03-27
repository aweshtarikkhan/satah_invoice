import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

interface AddClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClientAdded: (client: { id: string; display_name: string }) => void;
}

export function AddClientDialog({ open, onOpenChange, onClientAdded }: AddClientDialogProps) {
  const org = useAppStore((s) => s.organization);
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const reset = () => {
    setDisplayName("");
    setCompanyName("");
    setEmail("");
    setPhone("");
    setNotes("");
  };

  const handleSave = async () => {
    if (!displayName.trim() || !org?.id) {
      toast({ title: "Display name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.from("clients").insert({
      org_id: org.id,
      display_name: displayName.trim(),
      company_name: companyName.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      notes: notes.trim() || null,
    }).select("id, display_name").single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else if (data) {
      toast({ title: "Client added!" });
      onClientAdded(data);
      reset();
      onOpenChange(false);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Client</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Display Name *</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Client name" autoFocus />
          </div>
          <div className="space-y-2">
            <Label>Company Name</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Add Client"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
