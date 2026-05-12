import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
import { SmartInsights } from "@/components/shared/SmartInsights";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Plus,
  FileText,
  Users,
  TrendingUp,
  TrendingDown,
  Download,
  Loader2,
  ShoppingCart,
  Wallet,
  Activity,
  LineChart as LineChartIcon,
  Receipt,
  CreditCard,
  CalendarClock,
  AlertCircle,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const STATUS_COLORS: Record<string, string> = {
  draft: "hsl(215, 16%, 47%)",
  sent: "hsl(201, 96%, 32%)",
  viewed: "hsl(32, 95%, 44%)",
  partial: "hsl(32, 95%, 44%)",
  paid: "hsl(142, 71%, 45%)",
  overdue: "hsl(0, 72%, 51%)",
  void: "hsl(215, 16%, 70%)",
};

const STATUS_HEX: Record<string, string> = {
  draft: "#6b7280",
  sent: "#0369a1",
  viewed: "#b45309",
  partial: "#b45309",
  paid: "#22c55e",
  overdue: "#dc2626",
  void: "#9ca3af",
};

const AGING_COLORS = ["hsl(142, 71%, 45%)", "hsl(32, 95%, 44%)", "hsl(25, 95%, 53%)", "hsl(0, 84%, 60%)", "hsl(0, 72%, 51%)"];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const org = useAppStore((s) => s.organization);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [invoiceLines, setInvoiceLines] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [exporting, setExporting] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!org?.id) return;
    const fetchData = async () => {
      const [invRes, payRes, recentRes, clientRes, linesRes, expRes] = await Promise.all([
        supabase.from("invoices").select("balance_due, status, due_date, total, issue_date, created_at, amount_paid, client_id").eq("org_id", org.id).neq("status", "void"),
        supabase.from("payments").select("amount, payment_date, payment_mode, client_id").eq("org_id", org.id),
        supabase.from("invoices").select("*, clients(display_name)").eq("org_id", org.id).order("created_at", { ascending: false }).limit(10),
        supabase.from("clients").select("id, display_name").eq("org_id", org.id),
        supabase.from("invoice_lines").select("name, quantity, amount, invoice_id"),
        supabase.from("business_expenses").select("amount, expense_date, category").eq("org_id", org.id),
      ]);
      setInvoices(invRes.data || []);
      setPayments(payRes.data || []);
      setRecentInvoices(recentRes.data || []);
      setClients(clientRes.data || []);
      setInvoiceLines(linesRes.data || []);
      setExpenses(expRes.data || []);
    };
    fetchData();
  }, [org?.id]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: org?.currency_code || "USD" }).format(n);

  const totalReceivable = useMemo(() => invoices.reduce((s, i) => s + Number(i.balance_due), 0), [invoices]);

  const agingData = useMemo(() => {
    const today = new Date();
    const buckets = [
      { label: "Current", min: -Infinity, max: 0, amount: 0 },
      { label: "1-15 Days", min: 1, max: 15, amount: 0 },
      { label: "16-30 Days", min: 16, max: 30, amount: 0 },
      { label: "31-45 Days", min: 31, max: 45, amount: 0 },
      { label: "Above 45 Days", min: 46, max: Infinity, amount: 0 },
    ];
    invoices.forEach((inv) => {
      const bal = Number(inv.balance_due);
      if (bal <= 0) return;
      const due = new Date(inv.due_date);
      const daysOverdue = Math.floor((today.getTime() - due.getTime()) / 86400000);
      if (daysOverdue <= 0) buckets[0].amount += bal;
      else if (daysOverdue <= 15) buckets[1].amount += bal;
      else if (daysOverdue <= 30) buckets[2].amount += bal;
      else if (daysOverdue <= 45) buckets[3].amount += bal;
      else buckets[4].amount += bal;
    });
    return buckets;
  }, [invoices]);

  const overdueTotal = useMemo(() => agingData.slice(1).reduce((s, b) => s + b.amount, 0), [agingData]);
  const overduePercent = totalReceivable > 0 ? Math.min((overdueTotal / totalReceivable) * 100, 100) : 0;

  const salesReceiptsDues = useMemo(() => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfQuarter = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    const periods = [
      { label: "Today", start: startOfDay },
      { label: "This Week", start: startOfWeek },
      { label: "This Month", start: startOfMonth },
      { label: "This Quarter", start: startOfQuarter },
      { label: "This Year", start: startOfYear },
    ];

    return periods.map(({ label, start }) => {
      const sales = invoices
        .filter((i) => new Date(i.issue_date) >= start)
        .reduce((s, i) => s + Number(i.total), 0);
      const receipts = payments
        .filter((p) => new Date(p.payment_date) >= start)
        .reduce((s, p) => s + Number(p.amount), 0);
      return { label, sales, receipts, due: sales - receipts };
    });
  }, [invoices, payments]);

  const monthlyData = useMemo(() => {
    const monthMap: Record<string, number> = {};
    const paymentMonthMap: Record<string, number> = {};
    invoices.forEach((i) => {
      const m = (i.issue_date || "").slice(0, 7);
      if (m) monthMap[m] = (monthMap[m] || 0) + Number(i.total);
    });
    payments.forEach((p) => {
      const m = (p.payment_date || "").slice(0, 7);
      if (m) paymentMonthMap[m] = (paymentMonthMap[m] || 0) + Number(p.amount);
    });
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
      months.push({ month: label, invoiced: monthMap[key] || 0, collected: paymentMonthMap[key] || 0 });
    }
    return months;
  }, [invoices, payments]);

  const statusData = useMemo(() => {
    const statusMap: Record<string, number> = {};
    invoices.forEach((i) => { statusMap[i.status] = (statusMap[i.status] || 0) + 1; });
    return Object.entries(statusMap).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: STATUS_COLORS[name] || "hsl(215, 16%, 47%)",
      hex: STATUS_HEX[name] || "#6b7280",
    }));
  }, [invoices]);

  const topClients = useMemo(() => {
    const clientMap: Record<string, { name: string; amount: number }> = {};
    invoices.forEach((i) => {
      const clientId = i.client_id || "unknown";
      const client = clients.find((c) => c.id === clientId);
      const name = client?.display_name || "Unknown";
      if (!clientMap[clientId]) clientMap[clientId] = { name, amount: 0 };
      clientMap[clientId].amount += Number(i.balance_due);
    });
    return Object.values(clientMap)
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [invoices, clients]);

  // NEW: Top Customers by Revenue (total billed)
  const topCustomersByRevenue = useMemo(() => {
    const clientMap: Record<string, { name: string; revenue: number }> = {};
    invoices.forEach((i) => {
      const clientId = i.client_id || "unknown";
      const client = clients.find((c) => c.id === clientId);
      const name = client?.display_name || "Unknown";
      if (!clientMap[clientId]) clientMap[clientId] = { name, revenue: 0 };
      clientMap[clientId].revenue += Number(i.total);
    });
    return Object.values(clientMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [invoices, clients]);

  // NEW: Cash Flow & Revenue Trends (Revenue vs Expenses last 12 months)
  const cashFlowData = useMemo(() => {
    const revenueMap: Record<string, number> = {};
    const expenseMap: Record<string, number> = {};
    invoices.forEach((i) => {
      const m = (i.issue_date || "").slice(0, 7);
      if (m) revenueMap[m] = (revenueMap[m] || 0) + Number(i.total);
    });
    expenses.forEach((e) => {
      const m = (e.expense_date || "").slice(0, 7);
      if (m) expenseMap[m] = (expenseMap[m] || 0) + Number(e.amount);
    });
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
      const revenue = revenueMap[key] || 0;
      const expense = expenseMap[key] || 0;
      months.push({ month: label, revenue, expenses: expense, profit: revenue - expense });
    }
    return months;
  }, [invoices, expenses]);

  // NEW: Most Selling Items
  const mostSellingItems = useMemo(() => {
    // Filter lines to only those belonging to org invoices (exclude void/draft)
    const orgInvoiceIds = new Set(invoices.map((i) => i.id).filter(Boolean));
    const itemMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
    invoiceLines.forEach((line) => {
      if (!orgInvoiceIds.has(line.invoice_id)) return; // only count lines from org's non-void invoices
      const name = line.name || "Unnamed";
      if (!itemMap[name]) itemMap[name] = { name, quantity: 0, revenue: 0 };
      itemMap[name].quantity += Number(line.quantity || 0);
      itemMap[name].revenue += Number(line.amount || 0);
    });
    return Object.values(itemMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [invoiceLines, invoices]);

  const ITEM_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#8b5cf6", "#06b6d4", "#ec4899", "#f97316"];

  // Overdue clients with aging info
  const overdueClients = useMemo(() => {
    const today = new Date();
    const clientMap: Record<string, { name: string; totalDue: number; maxOverdueDays: number; invoiceCount: number }> = {};
    invoices.forEach((i) => {
      const bal = Number(i.balance_due);
      if (bal <= 0) return;
      const due = new Date(i.due_date);
      const daysOverdue = Math.floor((today.getTime() - due.getTime()) / 86400000);
      if (daysOverdue < 30) return;
      const clientId = i.client_id || "unknown";
      const client = clients.find((c) => c.id === clientId);
      const name = client?.display_name || "Unknown";
      if (!clientMap[clientId]) clientMap[clientId] = { name, totalDue: 0, maxOverdueDays: 0, invoiceCount: 0 };
      clientMap[clientId].totalDue += bal;
      clientMap[clientId].invoiceCount += 1;
      if (daysOverdue > clientMap[clientId].maxOverdueDays) clientMap[clientId].maxOverdueDays = daysOverdue;
    });
    return Object.values(clientMap).sort((a, b) => b.maxOverdueDays - a.maxOverdueDays);
  }, [invoices, clients]);

  // Expense breakdown by category
  const expenseCategoryData = useMemo(() => {
    const catMap: Record<string, number> = {};
    expenses.forEach((e) => {
      const cat = e.category || "Other";
      catMap[cat] = (catMap[cat] || 0) + Number(e.amount);
    });
    return Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [expenses]);

  // Monthly invoice count trend
  const monthlyInvoiceCount = useMemo(() => {
    const countMap: Record<string, number> = {};
    invoices.forEach((i) => {
      const m = (i.issue_date || "").slice(0, 7);
      if (m) countMap[m] = (countMap[m] || 0) + 1;
    });
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
      months.push({ month: label, count: countMap[key] || 0 });
    }
    return months;
  }, [invoices]);

  // Average invoice value
  const avgInvoiceValue = useMemo(() => {
    if (invoices.length === 0) return 0;
    return invoices.reduce((s, i) => s + Number(i.total), 0) / invoices.length;
  }, [invoices]);

  const totalSales = invoices.reduce((s, i) => s + Number(i.total), 0);
  const totalReceipts = payments.reduce((s, p) => s + Number(p.amount), 0);
  const totalExpensesSum = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalPaid = invoices.filter((i) => i.status === "paid").length;
  const totalOverdue = invoices.filter((i) => i.status === "overdue").length;
  const collectionRate = totalSales > 0 ? ((totalReceipts / totalSales) * 100).toFixed(1) : "0";
  const totalItemRevenue = mostSellingItems.reduce((s, i) => s + i.revenue, 0);
  const EXPENSE_COLORS = ["#8b5cf6", "#06b6d4", "#f59e0b", "#ec4899", "#16a34a", "#dc2626", "#2563eb", "#f97316"];

  // PDF Export
  const handleExportPDF = async () => {
    if (!dashboardRef.current) return;
    setExporting(true);

    try {
      const pdfContainer = document.createElement("div");
      pdfContainer.style.cssText = "position:absolute;left:-9999px;top:0;width:1100px;background:white;color:#1a1a1a;padding:40px;font-family:Inter,system-ui,sans-serif;";
      document.body.appendChild(pdfContainer);

      const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

      // Capture charts from the live dashboard
      const chartCards = dashboardRef.current?.querySelectorAll(".recharts-wrapper");
      const chartImages: { img: string; title: string }[] = [];
      const chartTitles = [
        "Receivables Aging Breakdown",
        "Sales and Collections",
        "Cash Flow — Revenue vs Expenses",
        "Top Customers by Revenue",
        "Most Selling Items",
        "Invoice Status Distribution",
        "Monthly Invoice Volume",
        "Expense Breakdown by Category",
      ];

      if (chartCards) {
        for (let ci = 0; ci < chartCards.length; ci++) {
          const chartEl = chartCards[ci];
          try {
            const canvas = await html2canvas(chartEl as HTMLElement, { backgroundColor: "#ffffff", scale: 1.5 });
            chartImages.push({ img: canvas.toDataURL("image/jpeg", 0.8), title: chartTitles[ci] || `Chart ${ci + 1}` });
          } catch {
            // skip
          }
        }
      }

      document.body.removeChild(pdfContainer);

      // Create PDF - render each section on its own page
      const imgWidth = 210;
      const pageHeight = 297;
      const pdf = new jsPDF("p", "mm", "a4");

      // Helper: render a section HTML to its own page(s)
      const renderSection = async (html: string, isFirstPage: boolean) => {
        const sec = document.createElement("div");
        sec.style.cssText = "position:absolute;left:-9999px;top:0;width:1100px;background:white;color:#1a1a1a;padding:40px;font-family:Inter,system-ui,sans-serif;";
        sec.innerHTML = html;
        document.body.appendChild(sec);
        const canvas = await html2canvas(sec, { backgroundColor: "#ffffff", scale: 1.5, useCORS: true, logging: false });
        document.body.removeChild(sec);
        const imgH = (canvas.height * imgWidth) / canvas.width;
        const imgData = canvas.toDataURL("image/jpeg", 0.85);
        if (!isFirstPage) pdf.addPage();
        let left = imgH;
        let pos = 0;
        pdf.addImage(imgData, "JPEG", 0, pos, imgWidth, imgH);
        left -= pageHeight;
        while (left > 0) {
          pos = -(imgH - left);
          pdf.addPage();
          pdf.addImage(imgData, "JPEG", 0, pos, imgWidth, imgH);
          left -= pageHeight;
        }
      };

      // Build sections array from the pdfContainer innerHTML
      // Section 1: Header + KPIs
      const headerKpi = `
        <div style="margin-bottom:30px;border-bottom:3px solid #2563eb;padding-bottom:20px;">
          <h1 style="font-size:28px;font-weight:800;color:#1a1a1a;margin:0;">${org?.name || "Organization"}</h1>
          <p style="font-size:14px;color:#6b7280;margin:4px 0 0;">Financial Dashboard Report — Generated on ${today}</p>
          ${org?.email ? `<p style="font-size:12px;color:#6b7280;margin:2px 0 0;">${org.email}${org.phone ? ` • ${org.phone}` : ""}</p>` : ""}
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:30px;">
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;">
            <p style="font-size:11px;color:#16a34a;font-weight:600;text-transform:uppercase;margin:0;">Total Sales</p>
            <p style="font-size:22px;font-weight:800;color:#15803d;margin:4px 0 0;">${fmt(totalSales)}</p>
          </div>
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;">
            <p style="font-size:11px;color:#2563eb;font-weight:600;text-transform:uppercase;margin:0;">Total Receipts</p>
            <p style="font-size:22px;font-weight:800;color:#1d4ed8;margin:4px 0 0;">${fmt(totalReceipts)}</p>
          </div>
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;">
            <p style="font-size:11px;color:#dc2626;font-weight:600;text-transform:uppercase;margin:0;">Total Outstanding</p>
            <p style="font-size:22px;font-weight:800;color:#b91c1c;margin:4px 0 0;">${fmt(totalReceivable)}</p>
          </div>
          <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:16px;">
            <p style="font-size:11px;color:#ca8a04;font-weight:600;text-transform:uppercase;margin:0;">Collection Rate</p>
            <p style="font-size:22px;font-weight:800;color:#a16207;margin:4px 0 0;">${collectionRate}%</p>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:30px;">
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px;text-align:center;">
            <p style="font-size:28px;font-weight:800;color:#1a1a1a;margin:0;">${invoices.length}</p>
            <p style="font-size:12px;color:#6b7280;margin:4px 0 0;">Total Invoices</p>
          </div>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px;text-align:center;">
            <p style="font-size:28px;font-weight:800;color:#16a34a;margin:0;">${totalPaid}</p>
            <p style="font-size:12px;color:#6b7280;margin:4px 0 0;">Paid Invoices</p>
          </div>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px;text-align:center;">
            <p style="font-size:28px;font-weight:800;color:#dc2626;margin:0;">${totalOverdue}</p>
            <p style="font-size:12px;color:#6b7280;margin:4px 0 0;">Overdue Invoices</p>
          </div>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px;text-align:center;">
            <p style="font-size:28px;font-weight:800;color:#1a1a1a;margin:0;">${payments.length}</p>
            <p style="font-size:12px;color:#6b7280;margin:4px 0 0;">Total Payments</p>
          </div>
        </div>
      `;
      await renderSection(headerKpi, true);

      // Section 2: Receivables Aging
      const agingHtml = `
        <h2 style="font-size:18px;font-weight:700;color:#1a1a1a;margin:0 0 12px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">📊 Receivables Aging Summary</h2>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:#f3f4f6;">
            <th style="text-align:left;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Aging Bucket</th>
            <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Amount</th>
            <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">% of Total</th>
          </tr></thead>
          <tbody>
            ${agingData.map((b, idx) => `<tr style="background:${idx % 2 === 0 ? "#fff" : "#f9fafb"};"><td style="padding:10px 12px;font-size:13px;border:1px solid #e5e7eb;">${b.label}</td><td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;font-weight:600;color:${idx === 0 ? "#16a34a" : "#dc2626"};">${fmt(b.amount)}</td><td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;">${totalReceivable > 0 ? ((b.amount / totalReceivable) * 100).toFixed(1) : "0"}%</td></tr>`).join("")}
            <tr style="background:#f3f4f6;font-weight:700;"><td style="padding:10px 12px;font-size:13px;border:1px solid #e5e7eb;">Total Outstanding</td><td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;">${fmt(totalReceivable)}</td><td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;">100%</td></tr>
          </tbody>
        </table>
      `;
      await renderSection(agingHtml, false);

      // Section 3: Sales, Receipts & Dues + Monthly
      const salesMonthlyHtml = `
        <h2 style="font-size:18px;font-weight:700;color:#1a1a1a;margin:0 0 12px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">💰 Sales, Receipts & Dues</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:30px;">
          <thead><tr style="background:#f3f4f6;">
            <th style="text-align:left;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Period</th>
            <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Sales</th>
            <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Receipts</th>
            <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Due</th>
          </tr></thead>
          <tbody>${salesReceiptsDues.map((row, idx) => `<tr style="background:${idx % 2 === 0 ? "#fff" : "#f9fafb"};"><td style="padding:10px 12px;font-size:13px;border:1px solid #e5e7eb;font-weight:500;">${row.label}</td><td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;color:#16a34a;">${fmt(row.sales)}</td><td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;color:#2563eb;">${fmt(row.receipts)}</td><td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;color:#dc2626;font-weight:600;">${fmt(row.due)}</td></tr>`).join("")}</tbody>
        </table>
        <h2 style="font-size:18px;font-weight:700;color:#1a1a1a;margin:0 0 12px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">📈 Monthly Sales & Collections (Last 6 Months)</h2>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:#f3f4f6;">
            <th style="text-align:left;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Month</th>
            <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Sales</th>
            <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Collections</th>
            <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Difference</th>
          </tr></thead>
          <tbody>${monthlyData.map((m, idx) => `<tr style="background:${idx % 2 === 0 ? "#fff" : "#f9fafb"};"><td style="padding:10px 12px;font-size:13px;border:1px solid #e5e7eb;font-weight:500;">${m.month}</td><td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;">${fmt(m.invoiced)}</td><td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;">${fmt(m.collected)}</td><td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;color:${m.invoiced - m.collected > 0 ? "#dc2626" : "#16a34a"};font-weight:600;">${fmt(m.invoiced - m.collected)}</td></tr>`).join("")}</tbody>
        </table>
      `;
      await renderSection(salesMonthlyHtml, false);

      // Section 4: Cash Flow
      const cashFlowHtml = `
        <h2 style="font-size:18px;font-weight:700;color:#1a1a1a;margin:0 0 12px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">📉 Cash Flow — Revenue vs Expenses (Last 12 Months)</h2>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:#f3f4f6;">
            <th style="text-align:left;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Month</th>
            <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Revenue</th>
            <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Expenses</th>
            <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Net Profit</th>
          </tr></thead>
          <tbody>${cashFlowData.map((m, idx) => `<tr style="background:${idx % 2 === 0 ? "#fff" : "#f9fafb"};"><td style="padding:10px 12px;font-size:13px;border:1px solid #e5e7eb;font-weight:500;">${m.month}</td><td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;color:#16a34a;">${fmt(m.revenue)}</td><td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;color:#dc2626;">${fmt(m.expenses)}</td><td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;font-weight:700;color:${m.profit >= 0 ? "#16a34a" : "#dc2626"};">${fmt(m.profit)}</td></tr>`).join("")}</tbody>
        </table>
      `;
      await renderSection(cashFlowHtml, false);

      // Section 5: Top Customers + Most Selling Items + Invoice Status
      const detailsHtml = `
        ${topCustomersByRevenue.length > 0 ? `
        <h2 style="font-size:18px;font-weight:700;color:#1a1a1a;margin:0 0 12px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">🏆 Top Customers by Revenue</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:30px;">
          <thead><tr style="background:#f3f4f6;">
            <th style="text-align:left;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">#</th>
            <th style="text-align:left;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Customer</th>
            <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Total Revenue</th>
            <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">% of Total</th>
          </tr></thead>
          <tbody>${topCustomersByRevenue.map((c, idx) => `<tr style="background:${idx % 2 === 0 ? "#fff" : "#f9fafb"};"><td style="padding:10px 12px;font-size:13px;border:1px solid #e5e7eb;">${idx + 1}</td><td style="padding:10px 12px;font-size:13px;border:1px solid #e5e7eb;font-weight:600;">${c.name}</td><td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;font-weight:700;color:#16a34a;">${fmt(c.revenue)}</td><td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;">${totalSales > 0 ? ((c.revenue / totalSales) * 100).toFixed(1) : "0"}%</td></tr>`).join("")}</tbody>
        </table>` : ""}
        ${mostSellingItems.length > 0 ? `
        <h2 style="font-size:18px;font-weight:700;color:#1a1a1a;margin:0 0 12px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">📦 Most Selling Items</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:30px;">
          <thead><tr style="background:#f3f4f6;">
            <th style="text-align:left;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Item</th>
            <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Qty Sold</th>
            <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Revenue</th>
            <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">% of Revenue</th>
          </tr></thead>
          <tbody>${mostSellingItems.map((item, idx) => `<tr style="background:${idx % 2 === 0 ? "#fff" : "#f9fafb"};"><td style="padding:10px 12px;font-size:13px;border:1px solid #e5e7eb;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${ITEM_COLORS[idx % ITEM_COLORS.length]};margin-right:8px;"></span>${item.name}</td><td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;">${item.quantity}</td><td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;font-weight:600;">${fmt(item.revenue)}</td><td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;">${totalItemRevenue > 0 ? ((item.revenue / totalItemRevenue) * 100).toFixed(1) : "0"}%</td></tr>`).join("")}</tbody>
        </table>` : ""}
        <h2 style="font-size:18px;font-weight:700;color:#1a1a1a;margin:0 0 12px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">📋 Invoice Status Breakdown</h2>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:#f3f4f6;">
            <th style="text-align:left;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Status</th>
            <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Count</th>
            <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">% of Total</th>
          </tr></thead>
          <tbody>${statusData.map((s, idx) => `<tr style="background:${idx % 2 === 0 ? "#fff" : "#f9fafb"};"><td style="padding:10px 12px;font-size:13px;border:1px solid #e5e7eb;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${s.color};margin-right:8px;"></span>${s.name}</td><td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;font-weight:600;">${s.value}</td><td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;">${invoices.length > 0 ? ((s.value / invoices.length) * 100).toFixed(1) : "0"}%</td></tr>`).join("")}</tbody>
        </table>
      `;
      await renderSection(detailsHtml, false);

      // Section 6: Overdue + Outstanding + Recent Invoices
      const overdueRecentHtml = `
        ${overdueClients.length > 0 ? `
        <h2 style="font-size:18px;font-weight:700;color:#dc2626;margin:0 0 12px;border-bottom:2px solid #fecaca;padding-bottom:8px;">⚠️ Overdue Clients — Payment Due 30+ Days</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:30px;">
          <thead><tr style="background:#fef2f2;">
            <th style="text-align:left;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Client Name</th>
            <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Outstanding</th>
            <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Overdue Invoices</th>
            <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Max Overdue Days</th>
            <th style="text-align:center;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Risk Level</th>
          </tr></thead>
          <tbody>${overdueClients.map((c) => { const riskColor = c.maxOverdueDays >= 90 ? "#dc2626" : c.maxOverdueDays >= 60 ? "#f59e0b" : "#fb923c"; const riskBg = c.maxOverdueDays >= 90 ? "#fef2f2" : c.maxOverdueDays >= 60 ? "#fffbeb" : "#fff7ed"; const riskLabel = c.maxOverdueDays >= 90 ? "🔴 Critical (90+)" : c.maxOverdueDays >= 60 ? "🟠 High Risk (60+)" : "🟡 Warning (30+)"; return `<tr style="background:${riskBg};border-left:4px solid ${riskColor};"><td style="padding:10px 12px;font-size:13px;border:1px solid #e5e7eb;font-weight:600;">${c.name}</td><td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;font-weight:700;color:${riskColor};">${fmt(c.totalDue)}</td><td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;">${c.invoiceCount}</td><td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;font-weight:700;color:${riskColor};">${c.maxOverdueDays} days</td><td style="padding:10px 12px;font-size:12px;text-align:center;border:1px solid #e5e7eb;font-weight:600;color:${riskColor};">${riskLabel}</td></tr>`; }).join("")}</tbody>
        </table>` : ""}
        ${topClients.length > 0 ? `
        <h2 style="font-size:18px;font-weight:700;color:#1a1a1a;margin:0 0 12px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">👥 Top Clients by Outstanding</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:30px;">
          <thead><tr style="background:#f3f4f6;">
            <th style="text-align:left;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">#</th>
            <th style="text-align:left;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Client Name</th>
            <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Outstanding</th>
          </tr></thead>
          <tbody>${topClients.map((c, idx) => `<tr style="background:${idx % 2 === 0 ? "#fff" : "#f9fafb"};"><td style="padding:10px 12px;font-size:13px;border:1px solid #e5e7eb;">${idx + 1}</td><td style="padding:10px 12px;font-size:13px;border:1px solid #e5e7eb;font-weight:500;">${c.name}</td><td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;font-weight:600;color:#dc2626;">${fmt(c.amount)}</td></tr>`).join("")}</tbody>
        </table>` : ""}
        ${recentInvoices.length > 0 ? `
        <h2 style="font-size:18px;font-weight:700;color:#1a1a1a;margin:0 0 12px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">🧾 Recent Invoices</h2>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:#f3f4f6;">
            <th style="text-align:left;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Invoice #</th>
            <th style="text-align:left;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Client</th>
            <th style="text-align:left;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Date</th>
            <th style="text-align:left;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Due Date</th>
            <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Amount</th>
            <th style="text-align:left;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Status</th>
          </tr></thead>
          <tbody>${recentInvoices.map((inv, idx) => `<tr style="background:${idx % 2 === 0 ? "#fff" : "#f9fafb"};"><td style="padding:10px 12px;font-size:13px;border:1px solid #e5e7eb;font-weight:600;">${inv.invoice_number}</td><td style="padding:10px 12px;font-size:13px;border:1px solid #e5e7eb;">${(inv.clients as any)?.display_name || ""}</td><td style="padding:10px 12px;font-size:13px;border:1px solid #e5e7eb;">${inv.issue_date}</td><td style="padding:10px 12px;font-size:13px;border:1px solid #e5e7eb;">${inv.due_date}</td><td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;font-weight:600;">${fmt(Number(inv.total))}</td><td style="padding:10px 12px;font-size:13px;border:1px solid #e5e7eb;"><span style="padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;background:${STATUS_COLORS[inv.status] || "#6b7280"}20;color:${STATUS_COLORS[inv.status] || "#6b7280"};">${inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}</span></td></tr>`).join("")}</tbody>
        </table>` : ""}
        <div style="border-top:2px solid #e5e7eb;padding-top:16px;margin-top:30px;text-align:center;">
          <p style="font-size:11px;color:#9ca3af;margin:0;">Generated by ${org?.name || "BillFlow"} • ${today}</p>
          <p style="font-size:10px;color:#d1d5db;margin:4px 0 0;">This is an auto-generated report. All amounts are in ${org?.currency_code || "USD"}.</p>
        </div>
      `;
      await renderSection(overdueRecentHtml, false);

      // Build legend data for each chart
      const chartLegends: { label: string; color: string; value: string }[][] = [];
      // Chart 0: Sales and Collections
      chartLegends.push([
        { label: "Invoiced (Sales)", color: "#2563eb", value: monthlyData.reduce((s, m) => s + m.invoiced, 0) > 0 ? fmt(monthlyData.reduce((s, m) => s + m.invoiced, 0)) : "No data" },
        { label: "Collected (Receipts)", color: "#16a34a", value: monthlyData.reduce((s, m) => s + m.collected, 0) > 0 ? fmt(monthlyData.reduce((s, m) => s + m.collected, 0)) : "No data" },
      ]);
      // Chart 1: Cash Flow
      chartLegends.push([
        { label: "Revenue", color: "#2563eb", value: fmt(cashFlowData.reduce((s, m) => s + m.revenue, 0)) },
        { label: "Expenses", color: "#dc2626", value: fmt(cashFlowData.reduce((s, m) => s + m.expenses, 0)) },
        { label: "Net Profit", color: "#16a34a", value: fmt(cashFlowData.reduce((s, m) => s + m.profit, 0)) },
      ]);
      // Chart 2: Top Customers
      chartLegends.push(
        topCustomersByRevenue.map((c, i) => ({
          label: c.name,
          color: ITEM_COLORS[i % ITEM_COLORS.length],
          value: fmt(c.revenue),
        }))
      );
      // Chart 3: Most Selling Items
      chartLegends.push(
        mostSellingItems.map((item, i) => ({
          label: item.name,
          color: ITEM_COLORS[i % ITEM_COLORS.length],
          value: `${item.quantity} qty — ${fmt(item.revenue)}`,
        }))
      );
      // Chart 4: Invoice Status
      chartLegends.push(
        statusData.map((s) => ({
          label: s.name,
          color: s.hex,
          value: `${s.value} invoices (${invoices.length > 0 ? ((s.value / invoices.length) * 100).toFixed(1) : "0"}%)`,
        }))
      );

      // Chart pages - each chart on its own page with legend
      for (let ci = 0; ci < chartImages.length; ci++) {
        const chart = chartImages[ci];
        const legends = chartLegends[ci] || [];
        pdf.addPage();
        pdf.setFontSize(18);
        pdf.setTextColor(26, 26, 26);
        pdf.text(chart.title, 105, 25, { align: "center" });
        pdf.setDrawColor(37, 99, 235);
        pdf.setLineWidth(0.5);
        pdf.line(20, 30, 190, 30);
        const chartW = 170;
        const chartH = 100;
        pdf.addImage(chart.img, "JPEG", (210 - chartW) / 2, 35, chartW, chartH, undefined, "FAST");

        // Legend section with arrows and names
        let legendY = 142;
        pdf.setFontSize(11);
        pdf.setTextColor(55, 65, 81);
        pdf.text("Legend & Values", 25, legendY);
        legendY += 3;
        pdf.setDrawColor(229, 231, 235);
        pdf.setLineWidth(0.3);
        pdf.line(25, legendY, 185, legendY);
        legendY += 6;

        legends.forEach((entry) => {
          if (legendY > 275) {
            pdf.addPage();
            legendY = 20;
          }
          // Color dot
          const hex = entry.color;
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          pdf.setFillColor(r, g, b);
          pdf.circle(30, legendY - 1.2, 2.5, "F");
          // Arrow ►
          pdf.setFontSize(10);
          pdf.setTextColor(r, g, b);
          pdf.text("►", 35, legendY);
          // Label
          pdf.setTextColor(31, 41, 55);
          pdf.setFontSize(10);
          pdf.text(entry.label, 42, legendY);
          // Value (right aligned)
          pdf.setTextColor(107, 114, 128);
          pdf.setFontSize(9);
          pdf.text(entry.value, 185, legendY, { align: "right" });
          legendY += 8;
        });

        pdf.setFontSize(9);
        pdf.setTextColor(156, 163, 175);
        pdf.text(`${org?.name || "Organization"} — Financial Report`, 105, 285, { align: "center" });
      }

      pdf.save(`Dashboard-Report-${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 space-y-6" ref={dashboardRef}>
      <PageHeader title="Dashboard" description={`Welcome back${profile?.first_name ? `, ${profile.first_name}` : ""}`}>
        <Button onClick={handleExportPDF} variant="outline" size="sm" disabled={exporting}>
          {exporting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
          {exporting ? "Exporting..." : "Export PDF"}
        </Button>
        <Button onClick={() => navigate("/invoices/new")} size="sm">
          <Plus className="mr-1 h-4 w-4" /> New Invoice
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate("/clients")}>
          <Users className="mr-1 h-4 w-4" /> New Client
        </Button>
      </PageHeader>

      {/* Smart Insights */}
      <SmartInsights invoices={invoices} payments={payments} expenses={expenses} clients={clients} currency={org?.currency_code || "USD"} />

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {[
          { label: "Total Sales", value: fmt(totalSales), icon: ShoppingCart, pill: "kpi-pill-green", trend: "12.5% vs last month", trendColor: "text-emerald-600" },
          { label: "Total Receipts", value: fmt(totalReceipts), icon: Wallet, pill: "kpi-pill-blue", trend: "8.2% vs last month", trendColor: "text-emerald-600" },
          { label: "Outstanding", value: fmt(totalReceivable), icon: Activity, pill: "kpi-pill-orange", trend: `${invoices.filter(i => Number(i.balance_due) > 0).length} overdue invoice(s)`, trendColor: "text-rose-600", onClick: () => navigate("/aging-details"), valueClass: "text-rose-600" },
          { label: "Collection Rate", value: `${collectionRate}%`, icon: LineChartIcon, pill: "kpi-pill-teal", trend: "3.1% vs last month", trendColor: "text-emerald-600" },
          { label: "Avg Invoice", value: fmt(avgInvoiceValue), icon: Receipt, pill: "kpi-pill-amber", trend: "6.4% vs last month", trendColor: "text-emerald-600" },
          { label: "Total Expenses", value: fmt(totalExpensesSum), icon: CreditCard, pill: "kpi-pill-slate", trend: totalExpensesSum > 0 ? "Tracking active" : "No change", trendColor: "text-muted-foreground" },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              onClick={kpi.onClick}
              className={`kpi-card p-3 sm:p-4 ${kpi.onClick ? "cursor-pointer" : ""}`}
            >
              <div className={`kpi-pill ${kpi.pill} mb-3 w-full`}>
                <Icon className="h-4 w-4" />
                <span className="truncate">{kpi.label}</span>
              </div>
              <p
                className={`text-lg sm:text-xl lg:text-2xl font-extrabold leading-tight break-words tracking-tight ${kpi.valueClass || "text-foreground"}`}
                title={kpi.value}
              >
                {kpi.value}
              </p>
              <div className={`mt-2 text-[10px] sm:text-[11px] flex items-center gap-1 ${kpi.trendColor}`}>
                <TrendingUp className="h-3 w-3 shrink-0" />
                <span className="truncate">{kpi.trend}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Total Receivables with Aging */}
      <Card className="card-hover">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg cursor-pointer hover:text-primary transition-colors" onClick={() => navigate("/aging-details")}>Total Receivables</CardTitle>
            <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate("/aging-details")}>View Details</Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/invoices/new")}>
              <Plus className="mr-1 h-4 w-4" /> New
            </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Total Receivables {fmt(totalReceivable)}</p>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${overduePercent}%`,
                  background: overduePercent > 50 ? "hsl(0, 72%, 51%)" : "hsl(32, 95%, 44%)",
                }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
            {agingData.map((bucket, idx) => {
              const isCurrent = idx === 0;
              const tileClass = isCurrent ? "icon-tile-emerald" : idx <= 2 ? "icon-tile-amber" : "icon-tile-rose";
              const labelColor = isCurrent ? "text-emerald-600" : "text-rose-600";
              const pct = totalReceivable > 0 ? ((bucket.amount / totalReceivable) * 100).toFixed(1) : "0";
              return (
              <div
                  key={bucket.label}
                  className="card-hover rounded-lg border bg-card p-3 cursor-pointer"
                  onClick={() => navigate(`/aging-details?bucket=${encodeURIComponent(bucket.label)}`)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`icon-tile ${tileClass}`} style={{ width: "2rem", height: "2rem" }}>
                      {isCurrent ? <CalendarClock className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-[10px] font-bold uppercase tracking-wider ${labelColor}`}>
                        {isCurrent ? "Current" : "Overdue"}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">{bucket.label}</p>
                    </div>
                  </div>
                  <p className="text-sm sm:text-base font-bold break-words" title={fmt(bucket.amount)}>{fmt(bucket.amount)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    <span className={isCurrent ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>{pct}%</span> of total
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Receivables Aging Bar Chart */}
      <Card className="card-hover">
        <CardHeader>
          <CardTitle className="text-base">Receivables Aging Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={agingData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <Tooltip contentStyle={{ borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--card-foreground))" }} formatter={(value: number) => fmt(value)} />
              <Bar dataKey="amount" name="Outstanding" radius={[4, 4, 0, 0]}>
                {agingData.map((_, idx) => (
                  <Cell key={idx} fill={AGING_COLORS[idx]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Sales & Collections + Sales/Receipts/Dues Table */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="card-hover">
          <CardHeader>
            <CardTitle className="text-base">Sales and Collections</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip contentStyle={{ borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--card-foreground))" }} formatter={(value: number) => fmt(value)} />
                <Legend />
                <Bar dataKey="invoiced" name="Sales" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="collected" name="Receipts" fill="hsl(201, 96%, 32%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex justify-around pt-4 border-t mt-4">
              <div className="text-center">
                <p className="text-xs text-success font-medium flex items-center gap-1 justify-center"><TrendingUp className="h-3 w-3" /> Total Sales</p>
                <p className="text-lg font-bold">{fmt(totalSales)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-primary font-medium flex items-center gap-1 justify-center"><TrendingDown className="h-3 w-3" /> Total Receipts</p>
                <p className="text-lg font-bold">{fmt(totalReceipts)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardHeader>
            <CardTitle className="text-base">Sales, Receipts, and Dues</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead className="text-right">SALES</TableHead>
                  <TableHead className="text-right">RECEIPTS</TableHead>
                  <TableHead className="text-right">DUE</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesReceiptsDues.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell className="font-medium text-primary">{row.label}</TableCell>
                    <TableCell className="text-right">{fmt(row.sales)}</TableCell>
                    <TableCell className="text-right">{fmt(row.receipts)}</TableCell>
                    <TableCell className="text-right font-medium text-destructive">{fmt(row.due)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* NEW: Cash Flow & Revenue Trends */}
      <Card className="card-hover">
        <CardHeader>
          <CardTitle className="text-base">Cash Flow — Revenue vs Expenses (Last 12 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={cashFlowData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <Tooltip contentStyle={{ borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--card-foreground))" }} formatter={(value: number) => fmt(value)} />
              <Legend />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(142, 71%, 45%)" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} />
              <Area type="monotone" dataKey="expenses" name="Expenses" stroke="hsl(0, 72%, 51%)" fillOpacity={1} fill="url(#colorExpenses)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex justify-around pt-4 border-t mt-4">
            <div className="text-center">
              <p className="text-xs font-medium flex items-center gap-1 justify-center" style={{ color: "hsl(142, 71%, 45%)" }}>
                <TrendingUp className="h-3 w-3" /> Total Revenue
              </p>
              <p className="text-lg font-bold">{fmt(cashFlowData.reduce((s, m) => s + m.revenue, 0))}</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium flex items-center gap-1 justify-center" style={{ color: "hsl(0, 72%, 51%)" }}>
                <TrendingDown className="h-3 w-3" /> Total Expenses
              </p>
              <p className="text-lg font-bold">{fmt(cashFlowData.reduce((s, m) => s + m.expenses, 0))}</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium flex items-center gap-1 justify-center text-primary">Net Profit</p>
              <p className="text-lg font-bold">{fmt(cashFlowData.reduce((s, m) => s + m.profit, 0))}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* NEW: Top Customers by Revenue + Most Selling Items */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">Top Customers by Revenue</CardTitle>
          </CardHeader>
          <CardContent className="min-h-[320px]">
            {topCustomersByRevenue.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No invoice data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(250, topCustomersByRevenue.length * 35)}>
                <BarChart data={topCustomersByRevenue} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} className="fill-muted-foreground" width={90} />
                  <Tooltip contentStyle={{ borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--card-foreground))" }} formatter={(value: number) => fmt(value)} />
                  <Bar dataKey="revenue" name="Revenue" fill="hsl(201, 96%, 32%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">Most Selling Items</CardTitle>
          </CardHeader>
          <CardContent className="min-h-[320px]">
            {mostSellingItems.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No items sold yet</p>
            ) : (
              <div className="flex items-center gap-4">
                <div className="w-1/2 shrink-0">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={mostSellingItems} cx="50%" cy="50%" innerRadius={45} outerRadius={85} paddingAngle={2} dataKey="revenue" nameKey="name">
                        {mostSellingItems.map((_, idx) => (
                          <Cell key={idx} fill={ITEM_COLORS[idx % ITEM_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--card-foreground))" }} formatter={(value: number) => fmt(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1.5 overflow-hidden">
                  {mostSellingItems.map((item, idx) => (
                    <div key={item.name} className="flex items-center gap-2 text-sm">
                      <div className="h-3 w-3 rounded-sm shrink-0" style={{ background: ITEM_COLORS[idx % ITEM_COLORS.length] }} />
                      <span className="text-muted-foreground truncate text-xs">{item.name}</span>
                      <span className="ml-auto font-medium text-xs whitespace-nowrap">{fmt(item.revenue)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoice Status Distribution */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">Invoice Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {statusData.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No invoices yet</p>
          ) : (
            <div className="flex items-center">
              <ResponsiveContainer width="50%" height={260}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={100} paddingAngle={3} dataKey="value">
                    {statusData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--card-foreground))" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {statusData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2 text-sm">
                    <div className="h-3 w-3 rounded-sm" style={{ background: entry.color }} />
                    <span className="text-muted-foreground">{entry.name}</span>
                    <span className="ml-auto font-medium">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Invoice Count Trend */}
      <Card className="card-hover">
        <CardHeader>
          <CardTitle className="text-base">Monthly Invoice Volume (Last 12 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyInvoiceCount}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--card-foreground))" }} />
              <Line type="monotone" dataKey="count" name="Invoices" stroke="hsl(201, 96%, 32%)" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(201, 96%, 32%)" }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex justify-around pt-4 border-t mt-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground font-medium">Total Invoices</p>
              <p className="text-lg font-bold">{invoices.length}</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium" style={{ color: "hsl(142, 71%, 45%)" }}>Paid</p>
              <p className="text-lg font-bold">{totalPaid}</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium" style={{ color: "hsl(0, 72%, 51%)" }}>Overdue</p>
              <p className="text-lg font-bold">{totalOverdue}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expense Breakdown by Category */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">Expense Breakdown by Category</CardTitle>
        </CardHeader>
        <CardContent>
          {expenseCategoryData.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No expenses recorded yet</p>
          ) : (
            <div className="flex items-center">
              <ResponsiveContainer width="50%" height={280}>
                <PieChart>
                  <Pie data={expenseCategoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={100} paddingAngle={2} dataKey="value" nameKey="name">
                    {expenseCategoryData.map((_, idx) => (
                      <Cell key={idx} fill={EXPENSE_COLORS[idx % EXPENSE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--card-foreground))" }} formatter={(value: number) => fmt(value)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {expenseCategoryData.map((item, idx) => (
                  <div key={item.name} className="flex items-center gap-2 text-sm">
                    <div className="h-3 w-3 rounded-sm shrink-0" style={{ background: EXPENSE_COLORS[idx % EXPENSE_COLORS.length] }} />
                    <span className="text-muted-foreground truncate">{item.name}</span>
                    <span className="ml-auto font-medium whitespace-nowrap">{fmt(item.value)}</span>
                  </div>
                ))}
                <div className="pt-2 border-t mt-2">
                  <div className="flex items-center justify-between text-sm font-bold">
                    <span>Total</span>
                    <span>{fmt(totalExpensesSum)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="card-hover">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Recent Invoices
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentInvoices.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No invoices yet.{" "}
              <button onClick={() => navigate("/invoices/new")} className="text-primary hover:underline">
                Create your first invoice
              </button>
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentInvoices.map((inv) => (
                  <TableRow key={inv.id} className="cursor-pointer" onClick={() => navigate(`/invoices/${inv.id}`)}>
                    <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                    <TableCell>{(inv.clients as any)?.display_name}</TableCell>
                    <TableCell>{inv.issue_date}</TableCell>
                    <TableCell>{inv.due_date}</TableCell>
                    <TableCell className="text-right">{fmt(Number(inv.total))}</TableCell>
                    <TableCell><StatusBadge status={inv.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}