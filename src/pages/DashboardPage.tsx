import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
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
  BarChart, Bar, PieChart, Pie, Cell,
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

const AGING_COLORS = ["hsl(142, 71%, 45%)", "hsl(32, 95%, 44%)", "hsl(25, 95%, 53%)", "hsl(0, 84%, 60%)", "hsl(0, 72%, 51%)"];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const org = useAppStore((s) => s.organization);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [exporting, setExporting] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!org?.id) return;
    const fetchData = async () => {
      const [invRes, payRes, recentRes, clientRes] = await Promise.all([
        supabase.from("invoices").select("balance_due, status, due_date, total, issue_date, created_at, amount_paid, client_id").eq("org_id", org.id).neq("status", "void"),
        supabase.from("payments").select("amount, payment_date, payment_mode, client_id").eq("org_id", org.id),
        supabase.from("invoices").select("*, clients(display_name)").eq("org_id", org.id).order("created_at", { ascending: false }).limit(10),
        supabase.from("clients").select("id, display_name").eq("org_id", org.id),
      ]);
      setInvoices(invRes.data || []);
      setPayments(payRes.data || []);
      setRecentInvoices(recentRes.data || []);
      setClients(clientRes.data || []);
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

  const paymentModeData = useMemo(() => {
    const modeMap: Record<string, number> = {};
    payments.forEach((p) => {
      const mode = (p.payment_mode || "other").replace(/_/g, " ");
      modeMap[mode] = (modeMap[mode] || 0) + Number(p.amount);
    });
    return Object.entries(modeMap)
      .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
      .sort((a, b) => b.value - a.value);
  }, [payments]);

  const PIE_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#8b5cf6", "#06b6d4", "#ec4899"];

  const totalSales = invoices.reduce((s, i) => s + Number(i.total), 0);
  const totalReceipts = payments.reduce((s, p) => s + Number(p.amount), 0);
  const totalPaid = invoices.filter((i) => i.status === "paid").length;
  const totalOverdue = invoices.filter((i) => i.status === "overdue").length;
  const collectionRate = totalSales > 0 ? ((totalReceipts / totalSales) * 100).toFixed(1) : "0";

  // PDF Export
  const handleExportPDF = async () => {
    if (!dashboardRef.current) return;
    setExporting(true);

    try {
      // Create a hidden container for PDF content
      const pdfContainer = document.createElement("div");
      pdfContainer.style.cssText = "position:absolute;left:-9999px;top:0;width:1100px;background:white;color:#1a1a1a;padding:40px;font-family:Inter,system-ui,sans-serif;";
      document.body.appendChild(pdfContainer);

      const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

      pdfContainer.innerHTML = `
        <div style="margin-bottom:30px;border-bottom:3px solid #2563eb;padding-bottom:20px;">
          <h1 style="font-size:28px;font-weight:800;color:#1a1a1a;margin:0;">${org?.name || "Organization"}</h1>
          <p style="font-size:14px;color:#6b7280;margin:4px 0 0;">Financial Dashboard Report — Generated on ${today}</p>
          ${org?.email ? `<p style="font-size:12px;color:#6b7280;margin:2px 0 0;">${org.email}${org.phone ? ` • ${org.phone}` : ""}</p>` : ""}
        </div>

        <!-- KPI Summary -->
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

        <!-- Invoice Summary -->
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

        <!-- Receivables Aging -->
        <div style="margin-bottom:30px;">
          <h2 style="font-size:18px;font-weight:700;color:#1a1a1a;margin:0 0 12px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">📊 Receivables Aging Summary</h2>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#f3f4f6;">
                <th style="text-align:left;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Aging Bucket</th>
                <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Amount</th>
                <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">% of Total</th>
              </tr>
            </thead>
            <tbody>
              ${agingData.map((b, idx) => `
                <tr style="background:${idx % 2 === 0 ? "#fff" : "#f9fafb"};">
                  <td style="padding:10px 12px;font-size:13px;border:1px solid #e5e7eb;">${b.label}</td>
                  <td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;font-weight:600;color:${idx === 0 ? "#16a34a" : "#dc2626"};">${fmt(b.amount)}</td>
                  <td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;">${totalReceivable > 0 ? ((b.amount / totalReceivable) * 100).toFixed(1) : "0"}%</td>
                </tr>
              `).join("")}
              <tr style="background:#f3f4f6;font-weight:700;">
                <td style="padding:10px 12px;font-size:13px;border:1px solid #e5e7eb;">Total Outstanding</td>
                <td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;">${fmt(totalReceivable)}</td>
                <td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;">100%</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Sales, Receipts & Dues -->
        <div style="margin-bottom:30px;">
          <h2 style="font-size:18px;font-weight:700;color:#1a1a1a;margin:0 0 12px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">💰 Sales, Receipts & Dues</h2>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#f3f4f6;">
                <th style="text-align:left;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Period</th>
                <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Sales</th>
                <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Receipts</th>
                <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Due</th>
              </tr>
            </thead>
            <tbody>
              ${salesReceiptsDues.map((row, idx) => `
                <tr style="background:${idx % 2 === 0 ? "#fff" : "#f9fafb"};">
                  <td style="padding:10px 12px;font-size:13px;border:1px solid #e5e7eb;font-weight:500;">${row.label}</td>
                  <td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;color:#16a34a;">${fmt(row.sales)}</td>
                  <td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;color:#2563eb;">${fmt(row.receipts)}</td>
                  <td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;color:#dc2626;font-weight:600;">${fmt(row.due)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>

        <!-- Monthly Trends -->
        <div style="margin-bottom:30px;">
          <h2 style="font-size:18px;font-weight:700;color:#1a1a1a;margin:0 0 12px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">📈 Monthly Sales & Collections (Last 6 Months)</h2>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#f3f4f6;">
                <th style="text-align:left;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Month</th>
                <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Sales</th>
                <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Collections</th>
                <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Difference</th>
              </tr>
            </thead>
            <tbody>
              ${monthlyData.map((m, idx) => `
                <tr style="background:${idx % 2 === 0 ? "#fff" : "#f9fafb"};">
                  <td style="padding:10px 12px;font-size:13px;border:1px solid #e5e7eb;font-weight:500;">${m.month}</td>
                  <td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;">${fmt(m.invoiced)}</td>
                  <td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;">${fmt(m.collected)}</td>
                  <td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;color:${m.invoiced - m.collected > 0 ? "#dc2626" : "#16a34a"};font-weight:600;">${fmt(m.invoiced - m.collected)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>

        <!-- Invoice Status Breakdown -->
        <div style="margin-bottom:30px;">
          <h2 style="font-size:18px;font-weight:700;color:#1a1a1a;margin:0 0 12px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">📋 Invoice Status Breakdown</h2>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#f3f4f6;">
                <th style="text-align:left;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Status</th>
                <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Count</th>
                <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">% of Total</th>
              </tr>
            </thead>
            <tbody>
              ${statusData.map((s, idx) => `
                <tr style="background:${idx % 2 === 0 ? "#fff" : "#f9fafb"};">
                  <td style="padding:10px 12px;font-size:13px;border:1px solid #e5e7eb;">
                    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${s.color};margin-right:8px;"></span>
                    ${s.name}
                  </td>
                  <td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;font-weight:600;">${s.value}</td>
                  <td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;">${invoices.length > 0 ? ((s.value / invoices.length) * 100).toFixed(1) : "0"}%</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>

        <!-- Payment Mode Breakdown -->
        ${paymentModeData.length > 0 ? `
        <div style="margin-bottom:30px;">
          <h2 style="font-size:18px;font-weight:700;color:#1a1a1a;margin:0 0 12px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">💳 Payment Mode Breakdown</h2>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#f3f4f6;">
                <th style="text-align:left;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Payment Mode</th>
                <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Amount</th>
                <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">% of Total</th>
              </tr>
            </thead>
            <tbody>
              ${paymentModeData.map((m, idx) => `
                <tr style="background:${idx % 2 === 0 ? "#fff" : "#f9fafb"};">
                  <td style="padding:10px 12px;font-size:13px;border:1px solid #e5e7eb;">${m.name}</td>
                  <td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;font-weight:600;">${fmt(m.value)}</td>
                  <td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;">${totalReceipts > 0 ? ((m.value / totalReceipts) * 100).toFixed(1) : "0"}%</td>
                </tr>
              `).join("")}
              <tr style="background:#f3f4f6;font-weight:700;">
                <td style="padding:10px 12px;font-size:13px;border:1px solid #e5e7eb;">Total</td>
                <td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;">${fmt(totalReceipts)}</td>
                <td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
        ` : ""}

        <!-- Top Clients -->
        ${topClients.length > 0 ? `
        <div style="margin-bottom:30px;">
          <h2 style="font-size:18px;font-weight:700;color:#1a1a1a;margin:0 0 12px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">👥 Top Clients by Outstanding</h2>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#f3f4f6;">
                <th style="text-align:left;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">#</th>
                <th style="text-align:left;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Client Name</th>
                <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              ${topClients.map((c, idx) => `
                <tr style="background:${idx % 2 === 0 ? "#fff" : "#f9fafb"};">
                  <td style="padding:10px 12px;font-size:13px;border:1px solid #e5e7eb;">${idx + 1}</td>
                  <td style="padding:10px 12px;font-size:13px;border:1px solid #e5e7eb;font-weight:500;">${c.name}</td>
                  <td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;font-weight:600;color:#dc2626;">${fmt(c.amount)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
        ` : ""}

        <!-- Overdue Clients (30+ Days) -->
        ${overdueClients.length > 0 ? `
        <div style="margin-bottom:30px;">
          <h2 style="font-size:18px;font-weight:700;color:#dc2626;margin:0 0 12px;border-bottom:2px solid #fecaca;padding-bottom:8px;">⚠️ Overdue Clients — Payment Due 30+ Days</h2>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#fef2f2;">
                <th style="text-align:left;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Client Name</th>
                <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Outstanding</th>
                <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Overdue Invoices</th>
                <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Max Overdue Days</th>
                <th style="text-align:center;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Risk Level</th>
              </tr>
            </thead>
            <tbody>
              ${overdueClients.map((c, idx) => {
                const riskColor = c.maxOverdueDays >= 90 ? "#dc2626" : c.maxOverdueDays >= 60 ? "#f59e0b" : "#fb923c";
                const riskBg = c.maxOverdueDays >= 90 ? "#fef2f2" : c.maxOverdueDays >= 60 ? "#fffbeb" : "#fff7ed";
                const riskLabel = c.maxOverdueDays >= 90 ? "🔴 Critical (90+ Days)" : c.maxOverdueDays >= 60 ? "🟠 High Risk (60+ Days)" : "🟡 Warning (30+ Days)";
                return `
                <tr style="background:${riskBg};border-left:4px solid ${riskColor};">
                  <td style="padding:10px 12px;font-size:13px;border:1px solid #e5e7eb;font-weight:600;">${c.name}</td>
                  <td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;font-weight:700;color:${riskColor};">${fmt(c.totalDue)}</td>
                  <td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;">${c.invoiceCount}</td>
                  <td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;font-weight:700;color:${riskColor};">${c.maxOverdueDays} days</td>
                  <td style="padding:10px 12px;font-size:12px;text-align:center;border:1px solid #e5e7eb;font-weight:600;color:${riskColor};">${riskLabel}</td>
                </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
        ` : ""}

        <!-- Recent Invoices -->
        ${recentInvoices.length > 0 ? `
        <div style="margin-bottom:30px;">
          <h2 style="font-size:18px;font-weight:700;color:#1a1a1a;margin:0 0 12px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">🧾 Recent Invoices</h2>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#f3f4f6;">
                <th style="text-align:left;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Invoice #</th>
                <th style="text-align:left;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Client</th>
                <th style="text-align:left;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Date</th>
                <th style="text-align:left;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Due Date</th>
                <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Amount</th>
                <th style="text-align:left;padding:10px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${recentInvoices.map((inv, idx) => `
                <tr style="background:${idx % 2 === 0 ? "#fff" : "#f9fafb"};">
                  <td style="padding:10px 12px;font-size:13px;border:1px solid #e5e7eb;font-weight:600;">${inv.invoice_number}</td>
                  <td style="padding:10px 12px;font-size:13px;border:1px solid #e5e7eb;">${(inv.clients as any)?.display_name || ""}</td>
                  <td style="padding:10px 12px;font-size:13px;border:1px solid #e5e7eb;">${inv.issue_date}</td>
                  <td style="padding:10px 12px;font-size:13px;border:1px solid #e5e7eb;">${inv.due_date}</td>
                  <td style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #e5e7eb;font-weight:600;">${fmt(Number(inv.total))}</td>
                  <td style="padding:10px 12px;font-size:13px;border:1px solid #e5e7eb;"><span style="padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;background:${STATUS_COLORS[inv.status] || "#6b7280"}20;color:${STATUS_COLORS[inv.status] || "#6b7280"};">${inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
        ` : ""}

        <!-- Footer -->
        <div style="border-top:2px solid #e5e7eb;padding-top:16px;margin-top:30px;text-align:center;">
          <p style="font-size:11px;color:#9ca3af;margin:0;">Generated by ${org?.name || "BillFlow"} • ${today}</p>
          <p style="font-size:10px;color:#d1d5db;margin:4px 0 0;">This is an auto-generated report. All amounts are in ${org?.currency_code || "USD"}.</p>
        </div>
      `;

      // Capture charts from the live dashboard
      const chartCards = dashboardRef.current?.querySelectorAll(".recharts-wrapper");
      const chartImages: { img: string; title: string }[] = [];
      const chartTitles = ["Sales and Collections", "Invoice Status Distribution", "Payment Mode Breakdown"];

      if (chartCards) {
        for (let ci = 0; ci < chartCards.length; ci++) {
          const chartEl = chartCards[ci];
          try {
            const canvas = await html2canvas(chartEl as HTMLElement, { backgroundColor: "#ffffff", scale: 2 });
            chartImages.push({ img: canvas.toDataURL("image/png"), title: chartTitles[ci] || `Chart ${ci + 1}` });
          } catch {
            // skip
          }
        }
      }

      // Render tables page to canvas
      const tablesCanvas = await html2canvas(pdfContainer, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
      });

      document.body.removeChild(pdfContainer);

      // Create PDF
      const imgWidth = 210; // A4 width mm
      const pageHeight = 297; // A4 height mm
      const pdf = new jsPDF("p", "mm", "a4");

      // Page 1+: Table data
      const tablesImgHeight = (tablesCanvas.height * imgWidth) / tablesCanvas.width;
      let heightLeft = tablesImgHeight;
      let position = 0;

      pdf.addImage(tablesCanvas.toDataURL("image/png"), "PNG", 0, position, imgWidth, tablesImgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = -(tablesImgHeight - heightLeft);
        pdf.addPage();
        pdf.addImage(tablesCanvas.toDataURL("image/png"), "PNG", 0, position, imgWidth, tablesImgHeight);
        heightLeft -= pageHeight;
      }

      // Build legend data for each chart
      const chartLegends: { label: string; color: string; value: string }[][] = [
        // Chart 0: Sales and Collections (bar chart)
        monthlyData.map((m) => ({ label: m.month, color: "", value: `Sales: ${fmt(m.invoiced)} | Collected: ${fmt(m.collected)}` })),
        // Chart 1: Invoice Status (pie)
        statusData.map((s) => ({ label: s.name, color: s.color, value: `${s.value} invoices (${invoices.length > 0 ? ((s.value / invoices.length) * 100).toFixed(1) : "0"}%)` })),
        // Chart 2: Payment Mode (pie)
        paymentModeData.map((m, i) => ({ label: m.name, color: PIE_COLORS[i % PIE_COLORS.length], value: `${fmt(m.value)} (${totalReceipts > 0 ? ((m.value / totalReceipts) * 100).toFixed(1) : "0"}%)` })),
      ];

      // Each chart gets its own full page with legend
      for (let ci = 0; ci < chartImages.length; ci++) {
        const chart = chartImages[ci];
        pdf.addPage();
        // Title
        pdf.setFontSize(18);
        pdf.setTextColor(26, 26, 26);
        pdf.text(chart.title, 105, 25, { align: "center" });
        pdf.setDrawColor(37, 99, 235);
        pdf.setLineWidth(0.5);
        pdf.line(20, 30, 190, 30);

        // Chart image
        const chartW = 170;
        const chartH = 110;
        const chartX = (210 - chartW) / 2;
        const chartY = 38;
        pdf.addImage(chart.img, "PNG", chartX, chartY, chartW, chartH);

        // Legend table below chart
        const legends = chartLegends[ci] || [];
        if (legends.length > 0) {
          let legendY = chartY + chartH + 12;
          pdf.setFontSize(12);
          pdf.setTextColor(26, 26, 26);
          pdf.text("Legend & Values", 20, legendY);
          legendY += 6;
          pdf.setDrawColor(229, 231, 235);
          pdf.setLineWidth(0.3);

          // For bar chart (index 0), show as simple table
          if (ci === 0) {
            // Header
            pdf.setFillColor(243, 244, 246);
            pdf.rect(20, legendY, 170, 8, "F");
            pdf.setFontSize(9);
            pdf.setTextColor(75, 85, 99);
            pdf.text("Month", 25, legendY + 5.5);
            pdf.text("Sales", 100, legendY + 5.5);
            pdf.text("Collections", 145, legendY + 5.5);
            legendY += 9;
            pdf.setTextColor(26, 26, 26);
            for (const item of legends) {
              const parts = item.value.split(" | ");
              pdf.setFontSize(9);
              pdf.text(item.label, 25, legendY + 5);
              pdf.setTextColor(22, 163, 74);
              pdf.text(parts[0]?.replace("Sales: ", "") || "", 100, legendY + 5);
              pdf.setTextColor(37, 99, 235);
              pdf.text(parts[1]?.replace("Collected: ", "") || "", 145, legendY + 5);
              pdf.setTextColor(26, 26, 26);
              legendY += 7;
            }
          } else {
            // Pie chart legends with color dots
            for (const item of legends) {
              // Color dot
              const hex = item.color || "#6b7280";
              const r = parseInt(hex.slice(1, 3), 16);
              const g = parseInt(hex.slice(3, 5), 16);
              const b = parseInt(hex.slice(5, 7), 16);
              pdf.setFillColor(r, g, b);
              pdf.circle(25, legendY + 2.5, 2.5, "F");
              // Label
              pdf.setFontSize(10);
              pdf.setTextColor(26, 26, 26);
              pdf.text(item.label, 32, legendY + 4);
              // Value
              pdf.setFontSize(9);
              pdf.setTextColor(107, 114, 128);
              pdf.text(item.value, 80, legendY + 4);
              legendY += 8;
            }
          }
        }

        // Footer
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

      {/* Total Receivables with Aging */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Total Receivables</CardTitle>
            <Button size="sm" variant="outline" onClick={() => navigate("/invoices/new")}>
              <Plus className="mr-1 h-4 w-4" /> New
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Total Receivables {fmt(totalReceivable)}</p>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${overduePercent}%`,
                  background: overduePercent > 50 ? "hsl(0, 72%, 51%)" : "hsl(32, 95%, 44%)",
                }}
              />
            </div>
          </div>
          <div className="grid grid-cols-5 gap-4 pt-2">
            {agingData.map((bucket, idx) => (
              <div key={bucket.label} className="text-center">
                <p className="text-xs font-medium mb-1" style={{ color: AGING_COLORS[idx] }}>
                  {idx === 0 ? "CURRENT" : "OVERDUE"}
                </p>
                <p className="text-lg font-bold">{fmt(bucket.amount)}</p>
                <p className="text-xs text-muted-foreground">{bucket.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sales & Expenses Chart + Sales/Receipts/Dues Table */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
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

        <Card>
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

      {/* Invoice Status + Payment Mode */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoice Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No invoices yet</p>
            ) : (
              <div className="flex items-center">
                <ResponsiveContainer width="60%" height={240}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Mode Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentModeData.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No payments recorded yet</p>
            ) : (
              <div className="flex items-center">
                <ResponsiveContainer width="60%" height={240}>
                  <PieChart>
                    <Pie data={paymentModeData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" label={false}>
                      {paymentModeData.map((_, idx) => (
                        <Cell key={idx} fill={AGING_COLORS[idx % AGING_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--card-foreground))" }} formatter={(value: number) => fmt(value)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {paymentModeData.map((entry, idx) => (
                    <div key={entry.name} className="flex items-center gap-2 text-sm">
                      <div className="h-3 w-3 rounded-sm" style={{ background: AGING_COLORS[idx % AGING_COLORS.length] }} />
                      <span className="text-muted-foreground">{entry.name}</span>
                      <span className="ml-auto font-medium">{fmt(entry.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Invoices */}
      <Card>
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
