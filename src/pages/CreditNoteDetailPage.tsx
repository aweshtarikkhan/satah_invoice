import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Edit, Ban, Share2, FileDown } from "lucide-react";
import { getDocumentPreviewClass, getPaperSizeLabel, getPrintPageCSS } from "@/lib/document-templates";

export default function CreditNoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const org = useAppStore((s) => s.organization);
  const { toast } = useToast();

  const [cn, setCn] = useState<any>(null);
  const [lines, setLines] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    const fetch = async () => {
      const { data } = await supabase.from("credit_notes").select("*, clients(display_name, email)").eq("id", id).single();
      setCn(data);
      const { data: lineData } = await supabase.from("credit_note_lines").select("*").eq("credit_note_id", id).order("sort_order");
      setLines(lineData || []);
    };
    fetch();
  }, [id]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);

  const handleVoid = async () => {
    await supabase.from("credit_notes").update({ status: "void" }).eq("id", id!);
    toast({ title: "Credit note voided" });
    setCn((prev: any) => ({ ...prev, status: "void" }));
  };

  const handleShareLink = async () => {
    // Create or get portal token
    const { data: existing } = await supabase
      .from("portal_tokens")
      .select("token")
      .eq("entity_type", "credit_note")
      .eq("entity_id", id!)
      .maybeSingle();

    let token = existing?.token;
    if (!token) {
      const { data } = await supabase.from("portal_tokens").insert({
        org_id: org!.id, entity_type: "credit_note", entity_id: id!,
      }).select("token").single();
      token = data?.token;
    }

    if (token) {
      const url = `${window.location.origin}/portal/${token}`;
      await navigator.clipboard.writeText(url);
      toast({ title: "Portal link copied to clipboard!" });
    }
  };

  if (!cn) return <div className="p-6 text-center text-muted-foreground">Loading...</div>;

  const printCSS = getPrintPageCSS(org?.template_paper_size);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <style dangerouslySetInnerHTML={{ __html: printCSS }} />

      <PageHeader title={`Credit Note ${cn.credit_note_number}`}>
        <Button variant="outline" size="sm" onClick={() => navigate(`/credit-notes/${id}/edit`)}>
          <Edit className="mr-1 h-4 w-4" /> Edit
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <FileDown className="mr-1 h-4 w-4" /> Save PDF
        </Button>
        {cn.status !== "void" && (
          <Button variant="outline" size="sm" onClick={handleVoid}>
            <Ban className="mr-1 h-4 w-4" /> Void
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={handleShareLink}>
          <Share2 className="mr-1 h-4 w-4" /> Share Link
        </Button>
      </PageHeader>

      <div className="flex items-center gap-4">
        <StatusBadge status={cn.status} />
        <span className="text-sm text-muted-foreground">
          {(cn.clients as any)?.display_name} • {cn.issue_date}
        </span>
      </div>

      <Card className={getDocumentPreviewClass(org?.template_style, org?.template_paper_size)}>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg">{org?.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{org?.email}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{fmt(Number(cn.total))}</p>
              <p className="text-xs text-muted-foreground">Template: {org?.template_style || "classic"} • {getPaperSizeLabel(org?.template_paper_size)}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>
                    <div className="font-medium">{line.name}</div>
                    {line.description && <div className="text-xs text-muted-foreground">{line.description}</div>}
                  </TableCell>
                  <TableCell className="text-right">{line.quantity}</TableCell>
                  <TableCell className="text-right">{fmt(Number(line.rate))}</TableCell>
                  <TableCell className="text-right">{fmt(Number(line.tax_amount))}</TableCell>
                  <TableCell className="text-right">{fmt(Number(line.amount))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmt(Number(cn.subtotal))}</span></div>
            {Number(cn.total_discount) > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="text-destructive">-{fmt(Number(cn.total_discount))}</span></div>
            )}
            {Number(cn.total_tax) > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>+{fmt(Number(cn.total_tax))}</span></div>
            )}
            <div className="flex justify-between border-t pt-1 font-bold text-base">
              <span>Total Credit</span><span>{fmt(Number(cn.total))}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
