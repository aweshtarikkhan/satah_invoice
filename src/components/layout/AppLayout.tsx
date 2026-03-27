import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { CommandPalette } from "@/components/shared/CommandPalette";

export function AppLayout() {
  const { profile } = useAuth();
  const setOrganization = useAppStore((s) => s.setOrganization);

  useEffect(() => {
    if (!profile?.org_id) return;

    const fetchOrg = async () => {
      const { data } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", profile.org_id!)
        .single();
      if (data) setOrganization(data as any);
    };
    fetchOrg();
  }, [profile?.org_id, setOrganization]);

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
