import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ImportDialog, ImportField } from "@/components/shared/ImportDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, FileText, Search, Upload } from "lucide-react";

const invoiceImportFields: ImportField[] = [
  { key: "invoice_number", label: "Invoice #", required: true },
  { key: "client_name", label: "Client Name", required: true },
  { key: "issue_date", label: "Issue Date" },
  { key: "due_date", label: "Due Date" },
  { key: "total", label: "Total Amount" },
  { key: "status", label: "Status" },
  { key: "notes", label: "Notes" },
];

const statusTabs = ["all", "draft", "sent", "overdue", "paid"] as const;

export default function InvoicesPage() {
  const navigate = useNavigate();
  const org = useAppStore((s) => s.organization);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<string>("all");
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    if (!org?.id) return;
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("invoices")
        .select("*, clients(display_name)")
        .eq("org_id", org.id)
        .order("created_at", { ascending: false });
      setInvoices(data || []);
      setLoading(false);
    };
    fetch();
  }, [org?.id]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: org?.currency_code || "USD" }).format(n);

  const filtered = invoices
    .filter((i) => tab === "all" || i.status === tab)
    .filter((i) =>
      [i.invoice_number, (i.clients as any)?.display_name]
        .filter(Boolean)
        .some((f) => f.toLowerCase().includes(search.toLowerCase()))
    );

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Invoices" description="Create and manage invoices">
        <Button onClick={() => navigate("/invoices/new")} size="sm">
          <Plus className="mr-1 h-4 w-4" /> New Invoice
        </Button>
      </PageHeader>

      <div className="flex flex-col sm:flex-row gap-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            {statusTabs.map((s) => (
              <TabsTrigger key={s} value={s} className="capitalize">{s}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search invoices..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No invoices found"
              description="Create your first invoice to get started."
              actionLabel="New Invoice"
              onAction={() => navigate("/invoices/new")}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Balance Due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inv) => (
                  <TableRow key={inv.id} className="cursor-pointer" onClick={() => navigate(`/invoices/${inv.id}`)}>
                    <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                    <TableCell>{(inv.clients as any)?.display_name}</TableCell>
                    <TableCell>{inv.issue_date}</TableCell>
                    <TableCell>{inv.due_date}</TableCell>
                    <TableCell className="text-right">{fmt(Number(inv.total))}</TableCell>
                    <TableCell className="text-right">{fmt(Number(inv.balance_due))}</TableCell>
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
