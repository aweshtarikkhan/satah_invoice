import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
import { Plus, FileText } from "lucide-react";

export default function CreditNotesPage() {
  const navigate = useNavigate();
  const org = useAppStore((s) => s.organization);
  const [creditNotes, setCreditNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!org?.id) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("credit_notes")
        .select("*, clients(display_name)")
        .eq("org_id", org.id)
        .order("created_at", { ascending: false });
      setCreditNotes(data || []);
      setLoading(false);
    };
    fetch();
  }, [org?.id]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: org?.currency_code || "USD" }).format(n);

  if (loading) return <div className="p-6 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Credit Notes" description="Manage credit notes issued to clients">
        <Button onClick={() => navigate("/credit-notes/new")}>
          <Plus className="mr-1 h-4 w-4" /> New Credit Note
        </Button>
      </PageHeader>

      {creditNotes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No credit notes yet"
          description="Issue credit notes against invoices"
          actionLabel="New Credit Note"
          onAction={() => navigate("/credit-notes/new")}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Credit Note #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creditNotes.map((cn) => (
                  <TableRow key={cn.id} className="cursor-pointer" onClick={() => navigate(`/credit-notes/${cn.id}`)}>
                    <TableCell className="font-medium">{cn.credit_note_number}</TableCell>
                    <TableCell>{(cn.clients as any)?.display_name}</TableCell>
                    <TableCell>{cn.issue_date}</TableCell>
                    <TableCell><StatusBadge status={cn.status} /></TableCell>
                    <TableCell className="text-right">{fmt(Number(cn.total))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
