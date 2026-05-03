import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Download, MessageCircle, X } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { toast } from "@/hooks/use-toast";

interface AgingInvoice {
  id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  status: string;
  total: number;
  balance_due: number;
  client_name: string;
  client_phone: string | null;
  age_days: number;
  bucket: string;
}

const BUCKET_CONFIGS = [
  { label: "1 - 15 Days", min: 1, max: 15 },
  { label: "16 - 30 Days", min: 16, max: 30 },
  { label: "31 - 60 Days", min: 31, max: 60 },
  { label: "61 - 90 Days", min: 61, max: 90 },
  { label: "Above 90 Days", min: 91, max: Infinity },
];

// Map dashboard bucket labels -> aging-details bucket labels
const DASHBOARD_TO_DETAILS_BUCKET: Record<string, string[]> = {
  "Current": ["Current"],
  "1-15 Days": ["1 - 15 Days"],
  "16-30 Days": ["16 - 30 Days"],
  "31-45 Days": ["31 - 60 Days"], // closest match
  "Above 45 Days": ["31 - 60 Days", "61 - 90 Days", "Above 90 Days"],
};

export default function AgingDetailsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const org = useAppStore((s) => s.organization);
  const [invoices, setInvoices] = useState<AgingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [agingBy, setAgingBy] = useState("due_date");
  const [sortField, setSortField] = useState<"issue_date" | "due_date" | "age_days" | "total" | "balance_due">("due_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const bucketFilter = searchParams.get("bucket");
  const allowedBuckets = bucketFilter ? (DASHBOARD_TO_DETAILS_BUCKET[bucketFilter] || [bucketFilter]) : null;

  const currency = org?.currency_code || "USD";
  const fmt = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(n);

  useEffect(() => {
    if (!org?.id) return;
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("invoices")
        .select("id, invoice_number, issue_date, due_date, status, total, balance_due, client_id, clients(display_name, phone, mobile)")
        .eq("org_id", org.id)
        .not("status", "in", '("paid","void","draft")');

      const today = new Date();
      const rows: AgingInvoice[] = (data || [])
        .filter((inv: any) => Number(inv.balance_due) > 0)
        .map((inv: any) => {
          const dateField = agingBy === "due_date" ? inv.due_date : inv.issue_date;
          const ageDays = Math.max(0, differenceInDays(today, new Date(dateField)));
          let bucket = "Current";
          for (const b of BUCKET_CONFIGS) {
            if (ageDays >= b.min && ageDays <= b.max) { bucket = b.label; break; }
          }
          if (ageDays <= 0) bucket = "Current";
          const c = (inv.clients as any) || {};
          return {
            id: inv.id,
            invoice_number: inv.invoice_number,
            issue_date: inv.issue_date,
            due_date: inv.due_date,
            status: inv.status,
            total: Number(inv.total),
            balance_due: Number(inv.balance_due),
            client_name: c.display_name || "Unknown",
            client_phone: c.mobile || c.phone || null,
            age_days: ageDays,
            bucket,
          };
        });
      setInvoices(rows);
      setLoading(false);
    };
    fetch();
  }, [org?.id, agingBy]);

  const filteredInvoices = useMemo(() => {
    if (!allowedBuckets) return invoices;
    return invoices.filter((inv) => allowedBuckets.includes(inv.bucket));
  }, [invoices, allowedBuckets]);

  const grouped = useMemo(() => {
    const bucketOrder = ["Current", ...BUCKET_CONFIGS.map((b) => b.label)];
    const groups: Record<string, AgingInvoice[]> = {};
    bucketOrder.forEach((b) => { groups[b] = []; });
    filteredInvoices.forEach((inv) => {
      if (!groups[inv.bucket]) groups[inv.bucket] = [];
      groups[inv.bucket].push(inv);
    });
    Object.values(groups).forEach((arr) => {
      arr.sort((a, b) => {
        const av = a[sortField] as any;
        const bv = b[sortField] as any;
        if (typeof av === "number") return sortDir === "asc" ? av - bv : bv - av;
        return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      });
    });
    return Object.entries(groups).filter(([, arr]) => arr.length > 0);
  }, [filteredInvoices, sortField, sortDir]);

  const totalAmount = filteredInvoices.reduce((s, i) => s + i.total, 0);
  const totalBalance = filteredInvoices.reduce((s, i) => s + i.balance_due, 0);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const clearBucketFilter = () => {
    searchParams.delete("bucket");
    setSearchParams(searchParams);
  };

  const sendWhatsAppReminder = (inv: AgingInvoice, e: React.MouseEvent) => {
    e.stopPropagation();
    const orgName = org?.name || "Our Company";
    const message =
      `Hi ${inv.client_name},\n\n` +
      `This is a friendly payment reminder from ${orgName}.\n\n` +
      `Invoice: ${inv.invoice_number}\n` +
      `Due Date: ${format(new Date(inv.due_date), "dd/MM/yyyy")}\n` +
      `Amount Due: ${fmt(inv.balance_due)}\n` +
      `Overdue by: ${inv.age_days} days\n\n` +
      `Kindly arrange the payment at your earliest convenience.\n\n` +
      `Thank you!`;

    // Normalize phone: digits only, prepend default country code (91/India) if missing
    let phone = (inv.client_phone || "").replace(/[^\d]/g, "");
    if (phone && phone.length === 10) phone = "91" + phone; // assume India if 10-digit local
    if (phone && phone.startsWith("0")) phone = "91" + phone.replace(/^0+/, "");

    const encoded = encodeURIComponent(message);
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

    // Desktop: use web.whatsapp.com (works in browser without redirect blocks)
    // Mobile: use wa.me (opens native WhatsApp app)
    let url: string;
    if (!phone) {
      url = isMobile ? `https://wa.me/?text=${encoded}` : `https://web.whatsapp.com/send?text=${encoded}`;
    } else {
      url = isMobile
        ? `https://wa.me/${phone}?text=${encoded}`
        : `https://web.whatsapp.com/send?phone=${phone}&text=${encoded}`;
    }

    window.open(url, "_blank", "noopener,noreferrer");

    if (!phone) {
      toast({
        title: "No phone number",
        description: `${inv.client_name} has no phone saved. Pick a contact in WhatsApp.`,
      });
    }
  };

  const downloadCSV = () => {
    const headers = ["Aging Bucket", "Date", "Due Date", "Invoice#", "Status", "Customer Name", "Age (Days)", "Amount", "Balance Due"];
    const rows = filteredInvoices.map((inv) => [
      inv.bucket, inv.issue_date, inv.due_date, inv.invoice_number, inv.status,
      inv.client_name, inv.age_days, inv.total, inv.balance_due,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AR-Aging-Details-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sortIcon = (field: typeof sortField) =>
    sortField === field ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  const getStatusColor = (status: string) => {
    switch (status) {
      case "overdue": return "text-destructive font-semibold";
      case "partial": return "text-orange-500 font-semibold";
      case "sent": return "text-blue-600 font-medium";
      case "viewed": return "text-amber-600 font-medium";
      default: return "text-muted-foreground";
    }
  };

  const getAgeColor = (days: number) => {
    if (days <= 15) return "text-amber-600";
    if (days <= 30) return "text-orange-500";
    if (days <= 60) return "text-orange-600 font-semibold";
    return "text-destructive font-bold";
  };

  if (loading) return <div className="p-6">Loading aging details...</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">Receivables</p>
          <h1 className="text-xl font-bold">AR Aging Details By {agingBy === "due_date" ? "Invoice Due Date" : "Invoice Date"}</h1>
          <p className="text-xs text-muted-foreground">As of {format(new Date(), "dd/MM/yyyy")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadCSV}>
          <Download className="mr-1 h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground font-medium">Aging By:</span>
          <Select value={agingBy} onValueChange={setAgingBy}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="due_date">Invoice Due Date</SelectItem>
              <SelectItem value="issue_date">Invoice Date</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {bucketFilter && (
          <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
            Filtered: {bucketFilter}
            <button onClick={clearBucketFilter} className="ml-1 hover:bg-primary/20 rounded-full p-0.5">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        <div className="ml-auto flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">Total Invoices: <strong className="text-foreground">{filteredInvoices.length}</strong></span>
          <span className="text-muted-foreground">Total Outstanding: <strong className="text-destructive">{fmt(totalBalance)}</strong></span>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead
                    className="cursor-pointer hover:text-foreground w-[110px]"
                    onClick={() => handleSort("issue_date")}
                  >
                    DATE{sortIcon("issue_date")}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:text-foreground w-[110px]"
                    onClick={() => handleSort("due_date")}
                  >
                    DUE DATE{sortIcon("due_date")}
                  </TableHead>
                  <TableHead className="w-[130px]">TRANSACTION#</TableHead>
                  <TableHead className="w-[80px]">TYPE</TableHead>
                  <TableHead className="w-[90px]">STATUS</TableHead>
                  <TableHead>CUSTOMER NAME</TableHead>
                  <TableHead
                    className="cursor-pointer hover:text-foreground w-[90px] text-center"
                    onClick={() => handleSort("age_days")}
                  >
                    AGE{sortIcon("age_days")}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:text-foreground text-right w-[120px]"
                    onClick={() => handleSort("total")}
                  >
                    AMOUNT{sortIcon("total")}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:text-foreground text-right w-[120px]"
                    onClick={() => handleSort("balance_due")}
                  >
                    BALANCE DUE{sortIcon("balance_due")}
                  </TableHead>
                  <TableHead className="w-[140px] text-center">REMINDER</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped.map(([bucket, items]) => {
                  const bucketTotal = items.reduce((s, i) => s + i.total, 0);
                  const bucketBalance = items.reduce((s, i) => s + i.balance_due, 0);
                  return (
                    <>
                      <TableRow key={`bucket-${bucket}`} className="bg-muted/30 hover:bg-muted/40">
                        <TableCell colSpan={7} className="font-bold text-sm py-2">
                          {bucket}
                        </TableCell>
                        <TableCell className="text-right font-bold text-sm py-2">
                          {fmt(bucketTotal)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-sm py-2">
                          {fmt(bucketBalance)}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                      {items.map((inv) => (
                        <TableRow
                          key={inv.id}
                          className="cursor-pointer hover:bg-muted/20"
                          onClick={() => navigate(`/invoices/${inv.id}`)}
                        >
                          <TableCell className="text-sm">
                            {format(new Date(inv.issue_date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(inv.due_date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="text-sm text-primary font-medium">
                            {inv.invoice_number}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">Invoice</TableCell>
                          <TableCell className={`text-sm capitalize ${getStatusColor(inv.status)}`}>
                            {inv.status}
                          </TableCell>
                          <TableCell className="text-sm text-primary font-medium">
                            {inv.client_name}
                          </TableCell>
                          <TableCell className={`text-sm text-center ${getAgeColor(inv.age_days)}`}>
                            {inv.age_days} Days
                          </TableCell>
                          <TableCell className="text-sm text-right font-medium">
                            {fmt(inv.total)}
                          </TableCell>
                          <TableCell className="text-sm text-right font-medium text-destructive">
                            {fmt(inv.balance_due)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1 border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950"
                              onClick={(e) => sendWhatsAppReminder(inv, e)}
                              title={inv.client_phone ? `Send to ${inv.client_phone}` : "No phone — pick contact"}
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              WhatsApp
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  );
                })}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={7} className="text-sm py-3">Grand Total</TableCell>
                  <TableCell className="text-right text-sm py-3">{fmt(totalAmount)}</TableCell>
                  <TableCell className="text-right text-sm py-3 text-destructive">{fmt(totalBalance)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {filteredInvoices.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No outstanding invoices found{bucketFilter ? ` in "${bucketFilter}"` : ""}.
        </div>
      )}
    </div>
  );
}
