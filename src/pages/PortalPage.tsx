import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Receipt } from "lucide-react";
import { SEO } from "@/components/shared/SEO";

export default function PortalPage() {
  const { token } = useParams();
  const [portalData, setPortalData] = useState<any>(null);
  const [entity, setEntity] = useState<any>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [org, setOrg] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      const { data, error: rpcError } = await supabase.rpc("get_portal_bundle", { p_token: token });

      if (rpcError || !data) {
        setError("Invalid or expired link");
        setLoading(false);
        return;
      }

      const bundle: any = data;
      if (bundle.error === "expired") {
        setError("This link has expired");
        setLoading(false);
        return;
      }
      if (!bundle.token || !bundle.entity || !bundle.org) {
        setError("Invalid or expired link");
        setLoading(false);
        return;
      }

      setPortalData(bundle.token);
      setOrg(bundle.org);
      const entityWithClient = { ...bundle.entity, clients: bundle.client };
      setEntity(entityWithClient);
      setLines(bundle.lines || []);

      // Mark as viewed (fire-and-forget)
      if (bundle.token.entity_type === "invoice" || bundle.token.entity_type === "estimate") {
        if (!bundle.entity.viewed_at) {
          supabase.rpc("mark_portal_viewed", { p_token: token });
        }
      }

      setLoading(false);
    };
    load();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-lg font-semibold text-destructive">{error}</p>
            <p className="text-sm text-muted-foreground mt-2">Please contact the sender for a new link.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!entity || !org) return null;

  const currency = entity.currency_code || org.currency_code || "INR";
  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

  const entityLabel = portalData.entity_type === "invoice" ? "Invoice" : portalData.entity_type === "estimate" ? "Estimate" : "Credit Note";
  const entityNumber = entity.invoice_number || entity.estimate_number || entity.credit_note_number;

  return (
    <>
      <SEO
        title={`${entityLabel} ${entityNumber} from ${org.name}`}
        description={`View ${entityLabel.toLowerCase()} ${entityNumber} from ${org.name}. Total ${fmt(entity.total || 0)}.`}
        noIndex
      />
      <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{org.name}</h1>
            {org.email && <p className="text-sm text-muted-foreground">{org.email}</p>}
          </div>
        </div>

        {/* Document */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg">{entityLabel} {entityNumber}</CardTitle>
                <div className="flex items-center gap-3 mt-2">
                  <StatusBadge status={entity.status} />
                  <span className="text-sm text-muted-foreground">
                    {(entity.clients as any)?.display_name}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{fmt(Number(entity.total))}</p>
                {entity.balance_due !== undefined && (
                  <p className="text-sm text-muted-foreground">Balance: {fmt(Number(entity.balance_due))}</p>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
              <div>
                <span className="text-muted-foreground">Issue Date:</span> {entity.issue_date}
              </div>
              {entity.due_date && (
                <div>
                  <span className="text-muted-foreground">Due Date:</span> {entity.due_date}
                </div>
              )}
              {entity.expiry_date && (
                <div>
                  <span className="text-muted-foreground">Expiry Date:</span> {entity.expiry_date}
                </div>
              )}
            </div>

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
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmt(Number(entity.subtotal))}</span></div>
              {Number(entity.total_discount) > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="text-destructive">-{fmt(Number(entity.total_discount))}</span></div>
              )}
              {Number(entity.total_tax) > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>+{fmt(Number(entity.total_tax))}</span></div>
              )}
              {Number(entity.shipping_charge || 0) > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>+{fmt(Number(entity.shipping_charge))}</span></div>
              )}
              <div className="flex justify-between border-t pt-1 font-bold text-base">
                <span>Total</span><span>{fmt(Number(entity.total))}</span>
              </div>
              {entity.amount_paid !== undefined && (
                <>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Amount Paid</span><span>{fmt(Number(entity.amount_paid))}</span>
                  </div>
                  <div className="flex justify-between font-bold text-primary">
                    <span>Balance Due</span><span>{fmt(Number(entity.balance_due))}</span>
                  </div>
                </>
              )}
            </div>

            {entity.notes && (
              <div className="mt-6 pt-4 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                <p className="text-sm">{entity.notes}</p>
              </div>
            )}
            {entity.terms_conditions && (
              <div className="mt-4">
                <p className="text-xs font-medium text-muted-foreground mb-1">Terms & Conditions</p>
                <p className="text-sm">{entity.terms_conditions}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Powered by InvoiceApp • This is a secure document link
        </p>
      </div>
    </div>
    </>
  );
}
