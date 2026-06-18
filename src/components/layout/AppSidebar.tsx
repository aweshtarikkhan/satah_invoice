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
  RefreshCw,
  PieChart,
  Boxes,
  UserCog,
  CalendarCheck,
  FileBarChart2,
  Truck,
  PackageCheck,
  BookOpen,
  Building2,
  Percent,
  Calculator,
  Landmark,
} from "lucide-react";
import { useAppStore } from "@/store/app-store";
import logoImg from "@/assets/logo.png";
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

const salesItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, addUrl: null },
  { title: "Invoices", url: "/invoices", icon: FileText, addUrl: "/invoices/new" },
  { title: "Estimates", url: "/estimates", icon: ClipboardList, addUrl: "/estimates/new" },
  { title: "Clients", url: "/clients", icon: Users, addUrl: "/clients?add=1" },
  { title: "Credit Notes", url: "/credit-notes", icon: FileMinus2, addUrl: "/credit-notes/new" },
  { title: "Payments Received", url: "/payments", icon: CreditCard, addUrl: "/payments/new" },
  { title: "Delivery Challans", url: "/delivery-challans", icon: Truck, addUrl: "/delivery-challans/new" },
  { title: "Recurring", url: "/recurring-invoices", icon: RefreshCw, addUrl: null },
];

const purchaseItems = [
  { title: "Vendors", url: "/vendors", icon: Truck, addUrl: null },
  { title: "Purchase Orders", url: "/purchase-orders", icon: ClipboardList, addUrl: "/purchase-orders/new" },
  { title: "Goods Receipt (GRN)", url: "/grns", icon: PackageCheck, addUrl: "/grns/new" },
  { title: "Bills", url: "/bills", icon: Receipt, addUrl: "/bills/new" },
  { title: "Expenses", url: "/expenses", icon: Coins, addUrl: "/expenses?add=1" },
];

const accountingItems = [
  { title: "Chart of Accounts", url: "/accounts", icon: BookOpen, addUrl: null },
  { title: "Journal Entries", url: "/journal", icon: Calculator, addUrl: null },
  { title: "Bank & Cash", url: "/bank-accounts", icon: Landmark, addUrl: null },
  { title: "Cash Flow", url: "/cash-flow", icon: PieChart, addUrl: null },
  { title: "Branches", url: "/branches", icon: Building2, addUrl: null },
  { title: "TDS", url: "/tds", icon: Percent, addUrl: null },
  { title: "Accounting Reports", url: "/accounting-reports", icon: Landmark, addUrl: null },
];

const catalogItems = [
  { title: "Items", url: "/items", icon: Package, addUrl: "/items?add=1" },
];

const peopleItems = [
  { title: "Employees", url: "/employees", icon: UserCog, addUrl: null },
  { title: "Attendance", url: "/attendance", icon: CalendarCheck, addUrl: null },
  { title: "Leaves", url: "/leaves", icon: ClipboardList, addUrl: null },
  { title: "Shifts", url: "/shifts", icon: CalendarCheck, addUrl: null },
  { title: "Documents", url: "/employee-documents", icon: ScrollText, addUrl: null },
  { title: "Payroll", url: "/payroll", icon: Calculator, addUrl: null },
];

const reportItems = [
  { title: "Statements", url: "/statements", icon: FileSpreadsheet, addUrl: null },
  { title: "Reports", url: "/reports", icon: BarChart3, addUrl: null },
  { title: "Profit & Loss", url: "/profit-loss", icon: PieChart, addUrl: null },
  { title: "GST Returns", url: "/gst-returns", icon: FileBarChart2, addUrl: null },
  { title: "Inventory Valuation", url: "/inventory-valuation", icon: Boxes, addUrl: null },
];

const crmItems = [
  { title: "Leads", url: "/leads", icon: Users, addUrl: "/leads?add=1" },
  { title: "Pipeline", url: "/pipeline", icon: BarChart3, addUrl: null },
  { title: "Activities", url: "/activities", icon: ClipboardList, addUrl: null },
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
  const org = useAppStore((s) => s.organization);
  const inventoryEnabled = (org as any)?.inventory_enabled;

  const catalogVisible = catalogItems.flatMap((it) => {
    if (it.url === "/items" && inventoryEnabled) {
      return [it, { title: "Inventory", url: "/inventory", icon: Boxes, addUrl: null }];
    }
    return [it];
  });

  const groups = [
    { label: "Sales", items: salesItems },
    { label: "Purchases", items: purchaseItems },
    { label: "Accounting", items: accountingItems },
    { label: "Catalog", items: catalogVisible },
    { label: "People", items: peopleItems },
    { label: "Reports", items: reportItems },
  ];

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-2 py-3">
        <NavLink to="/dashboard" className="flex items-center justify-center hover:opacity-90 transition-opacity">
          <img
            src={logoImg}
            alt="Satah Invoice"
            className={collapsed ? "h-10 w-10 object-contain" : "h-20 w-auto object-contain"}
          />
        </NavLink>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => (
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
        ))}

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
