import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ImportDialog, ImportField } from "@/components/shared/ImportDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CreditCard, Search, Upload } from "lucide-react";

const paymentImportFields: ImportField[] = [
  { key: "payment_number", label: "Payment #", required: true },
  { key: "client_name", label: "Client Name", required: true },
  { key: "amount", label: "Amount", required: true },
  { key: "payment_date", label: "Payment Date" },
  { key: "payment_mode", label: "Payment Mode" },
  { key: "reference_number", label: "Reference #" },
  { key: "notes", label: "Notes" },
];

export default function PaymentsPage() {
  const org = useAppStore((s) => s.organization);
  const [payments, setPayments] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);

  const fetchPayments = async () => {
    if (!org?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("payments")
      .select("*, clients(display_name), invoices(invoice_number)")
      .eq("org_id", org.id)
      .order("payment_date", { ascending: false });
    setPayments(data || []);
    setLoading(false);
  };
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!org?.id) return;
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("payments")
        .select("*, clients(display_name), invoices(invoice_number)")
        .eq("org_id", org.id)
        .order("payment_date", { ascending: false });
      setPayments(data || []);
      setLoading(false);
    };
    fetch();
  }, [org?.id]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: org?.currency_code || "USD" }).format(n);

  const filtered = payments.filter((p) =>
    [p.payment_number, (p.clients as any)?.display_name, p.reference_number]
      .filter(Boolean)
      .some((f) => f.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Payments" description="Payment history" />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search payments..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={CreditCard} title="No payments yet" description="Payments will appear here when recorded against invoices." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.payment_number}</TableCell>
                    <TableCell>{p.payment_date}</TableCell>
                    <TableCell>{(p.clients as any)?.display_name}</TableCell>
                    <TableCell>{(p.invoices as any)?.invoice_number || "—"}</TableCell>
                    <TableCell className="capitalize">{p.payment_mode.replace("_", " ")}</TableCell>
                    <TableCell className="text-right">{fmt(Number(p.amount))}</TableCell>
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
