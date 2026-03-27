import { Outlet, useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { CommandPalette } from "@/components/shared/CommandPalette";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

function OrgSetup({ onComplete }: { onComplete: () => void }) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !profile) return;
    setSaving(true);
    const { data: org, error } = await supabase
      .from("organizations")
      .insert({ name: name.trim() })
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    // Link profile to org
    await supabase.from("profiles").update({ org_id: org.id }).eq("user_id", profile.user_id);

    // Assign owner role
    await supabase.from("user_roles").insert({ user_id: profile.user_id, role: "owner" });

    toast({ title: "Organization created!" });
    onComplete();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome! Set up your organization</CardTitle>
          <CardDescription>Enter your business name to get started</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Organization Name *</Label>
            <Input
              placeholder="e.g. Acme Inc."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
          </div>
          <Button className="w-full" onClick={handleCreate} disabled={!name.trim() || saving}>
            {saving ? "Creating..." : "Continue"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function AppLayout() {
  const { profile } = useAuth();
  const setOrganization = useAppStore((s) => s.setOrganization);
  const org = useAppStore((s) => s.organization);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [checking, setChecking] = useState(true);

  const loadOrg = async () => {
    if (!profile) return;
    if (profile.org_id) {
      const { data } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", profile.org_id)
        .single();
      if (data) {
        setOrganization(data as any);
        setNeedsSetup(false);
      } else {
        setNeedsSetup(true);
      }
    } else {
      setNeedsSetup(true);
    }
    setChecking(false);
  };

  useEffect(() => {
    loadOrg();
  }, [profile?.org_id]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (needsSetup) {
    return <OrgSetup onComplete={() => window.location.reload()} />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-4 border-b px-4 bg-background">
            <SidebarTrigger />
            <div className="flex-1" />
            <CommandPalette />
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                {profile?.first_name?.[0] || "U"}
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
