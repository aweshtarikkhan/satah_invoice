import {
  LayoutDashboard,
  Users,
  FileText,
  Package,
  CreditCard,
  Settings,
  Receipt,
  LogOut,
  ClipboardList,
  BarChart3,
  FileMinus2,
  Coins,
  Layout,
  FileSpreadsheet,
  ScrollText,
  SlidersHorizontal,
  Plus,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, addUrl: null },
  { title: "Invoices", url: "/invoices", icon: FileText, addUrl: "/invoices/new" },
  { title: "Estimates", url: "/estimates", icon: ClipboardList, addUrl: "/estimates/new" },
  { title: "Clients", url: "/clients", icon: Users, addUrl: "/clients?add=1" },
  { title: "Items", url: "/items", icon: Package, addUrl: "/items?add=1" },
  { title: "Credit Notes", url: "/credit-notes", icon: FileMinus2, addUrl: "/credit-notes/new" },
  { title: "Payments Received", url: "/payments", icon: CreditCard, addUrl: "/payments/new" },
  { title: "Expenses", url: "/expenses", icon: Coins, addUrl: "/expenses?add=1" },
  { title: "Statements", url: "/statements", icon: FileSpreadsheet, addUrl: null },
  { title: "Reports", url: "/reports", icon: BarChart3, addUrl: null },
  { title: "Templates", url: "/templates", icon: Layout, addUrl: null },
];

const settingsItems = [
  { title: "Templates", url: "/templates", icon: Layout },
  { title: "Custom Fields", url: "/custom-fields", icon: SlidersHorizontal },
  { title: "Audit Logs", url: "/audit-logs", icon: ScrollText },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            <Receipt className="h-4 w-4" />
          </div>
          {!collapsed && (
            <span className="text-base font-semibold text-sidebar-foreground">
              InvoiceApp
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title} className="group/item">
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink
                      to={item.url}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                  {!collapsed && item.addUrl && (
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(item.addUrl!); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 transition-opacity h-5 w-5 flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                      title={`New ${item.title.replace(/s$/, "")}`}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink
                      to={item.url}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={signOut}
              className="text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Sign Out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
