import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, ArrowLeft, PackageCheck, Printer, Download } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { format } from "date-fns";
import { stateCodeFromGstin, calculateTaxBreakdown } from "@/lib/gst";
import { CompactBillTemplate } from "@/components/invoice/CompactBillTemplate";
import { PosBillTemplate } from "@/components/invoice/PosBillTemplate";
import { StyledInvoiceTemplate } from "@/components/invoice/StyledInvoiceTemplate";
import { getDocumentPreviewClass } from "@/lib/document-templates";

export default function PurchaseOrderDetailPage() {
  const org = useAppStore((s) => s.organization);
  const { id } = useParams();
  const navigate = useNavigate();
  const [po, setPo] = useState<any>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [grns, setGrns] = useState<any[]>([]);
  const invoiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data: p } = await (supabase as any).from("purchase_orders").select("*, vendors(*), branches(name), warehouses(name)").eq("id", id).maybeSingle();
      const { data: l } = await (supabase as any).from("purchase_order_lines").select("*").eq("po_id", id).order("sort_order");
      const { data: g } = await (supabase as any).from("grns").select("id,grn_number,grn_date,status").eq("po_id", id).order("grn_date", { ascending: false });
      setPo(p); setLines(l || []); setGrns(g || []);
    })();
  }, [id]);

  const mappedPoForTemplate = useMemo(() => {
    if (!po) return null;
    const vendor = po.vendors;
    return {
      ...po,
      invoice_number: po.po_number,
      issue_date: po.po_date,
      total_tax: po.tax_total || po.tax_amount || 0,
      total_discount: 0,
      adjustment: 0,
      shipping_charge: 0,
      clients: {
        display_name: vendor?.name || "",
        tax_number: vendor?.gstin || "",
        billing_address: vendor?.billing_address || "",
        email: vendor?.email || "",
        phone: vendor?.phone || ""
      }
    };
  }, [po]);

  const taxBreakdown = useMemo(() => {
    if (!po || !org) return [];
    const vendor = po.vendors;
    const orgState = org.gst_number ? stateCodeFromGstin(org.gst_number) : null;
    let vendorState = null;
    if (vendor?.gstin) vendorState = stateCodeFromGstin(vendor.gstin);
    const isInterstate = Boolean(orgState && vendorState && orgState !== vendorState);
    const enhancedLines = (lines || []).map(l => {
      const q = Number(l.quantity) || 0;
      const r = Number(l.rate) || 0;
      const tr = Number(l.tax_rate) || 0;
      const tax_amount = l.tax_amount || (q * r * (tr / 100));
      return { ...l, tax_amount, tax_rate: tr };
    });
    
    let breakdown = calculateTaxBreakdown(enhancedLines, [], isInterstate);
    
    // Fallback for old POs where line.tax_amount wasn't saved properly
    if (breakdown.length === 0 && (po.tax_total > 0 || po.tax_amount > 0)) {
      const totalTax = Number(po.tax_total || po.tax_amount || 0);
      const subtotal = Number(po.subtotal || 0);
      const assumedRate = subtotal > 0 ? Math.round((totalTax / subtotal) * 100) : 0;
      
      if (isInterstate) {
        breakdown = [{ id: `IGST_${assumedRate}`, name: assumedRate > 0 ? `IGST @ ${assumedRate}%` : 'IGST', rate: assumedRate, amount: totalTax }];
      } else {
        const halfRate = assumedRate / 2;
        breakdown = [
          { id: `CGST_${halfRate}`, name: halfRate > 0 ? `CGST @ ${halfRate}%` : 'CGST', rate: halfRate, amount: totalTax / 2 },
          { id: `SGST_${halfRate}`, name: halfRate > 0 ? `SGST @ ${halfRate}%` : 'SGST', rate: halfRate, amount: totalTax / 2 }
        ];
      }
    }
    return breakdown;
  }, [po, lines, org]);

  const handlePrint = () => {
    window.print();
  };

  const statusColor: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    sent: "bg-blue-100 text-blue-700",
    partial: "bg-amber-100 text-amber-700",
    received: "bg-emerald-100 text-emerald-700",
    closed: "bg-slate-200 text-slate-700",
    cancelled: "bg-red-100 text-red-700",
  };

  if (!po) return <div className="p-6 text-muted-foreground">Loading…</div>;
  const cur = po.currency || (org as any)?.currency || "INR";
  const fmt = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: cur }).format(n);

  return (
    <div className="space-y-4 max-w-5xl mx-auto print:p-0 print:m-0 print:max-w-none print:w-full print:bg-white print:space-y-0">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Button size="icon" variant="ghost" onClick={() => navigate("/purchase-orders")}><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-2xl font-semibold">{po.po_number}</h1>
          <Badge variant="outline" className={statusColor[po.status] || ""}>{po.status}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}><Printer className="h-4 w-4 mr-1" />Print / Download PDF</Button>
          <Button variant="outline" onClick={() => navigate(`/purchase-orders/${id}/edit`)}><Pencil className="h-4 w-4 mr-1" />Edit</Button>
          <Button onClick={() => navigate(`/grns/new?po=${id}`)}><PackageCheck className="h-4 w-4 mr-1" />Receive (GRN)</Button>
        </div>
      </div>

      <div ref={invoiceRef} className="print:m-0 print:shadow-none print:border-none">
        {mappedPoForTemplate && (
          org?.template_style === "compact" ? (
            <div className={getDocumentPreviewClass("compact", org?.template_paper_size)}>
              <CompactBillTemplate org={org} invoice={mappedPoForTemplate} lines={lines} fmt={fmt} type="po" taxBreakdown={taxBreakdown} />
            </div>
          ) : org?.template_style === "pos" ? (
            <div className={getDocumentPreviewClass("pos", org?.template_paper_size || "pos80")}>
              <PosBillTemplate org={org} invoice={mappedPoForTemplate} lines={lines} fmt={fmt} type="po" taxBreakdown={taxBreakdown} />
            </div>
          ) : (
            <div className={getDocumentPreviewClass("modern", org?.template_paper_size)}>
              <StyledInvoiceTemplate org={org} invoice={mappedPoForTemplate} lines={lines} fmt={fmt} type="po" taxBreakdown={taxBreakdown} />
            </div>
          )
        )}
      </div>

      {grns.length > 0 && (
        <div className="print:hidden mt-8">
          <h2 className="text-lg font-medium mb-3">Goods Receipt Notes</h2>
          <div className="bg-white border rounded-md shadow-sm">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground border-b">
                <tr>
                  <th className="px-4 py-2 font-medium">GRN #</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {grns.map(g => (
                  <tr key={g.id} className="border-b last:border-0 cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/grns/${g.id}`)}>
                    <td className="px-4 py-2 font-medium">{g.grn_number}</td>
                    <td className="px-4 py-2">{format(new Date(g.grn_date), "dd MMM yyyy")}</td>
                    <td className="px-4 py-2"><Badge variant="outline">{g.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
