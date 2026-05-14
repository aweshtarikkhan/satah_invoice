import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { SEO } from "@/components/shared/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, FileText, Palette } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DOCUMENT_TEMPLATES, PAPER_SIZES } from "@/lib/document-templates";

export default function InvoiceTemplatePage() {
  const org = useAppStore((s) => s.organization);
  const setOrganization = useAppStore((s) => s.setOrganization);
  const [selected, setSelected] = useState(org?.template_style || "classic");
  const [paperSize, setPaperSize] = useState(org?.template_paper_size || "a4");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSelect = async (templateId: string) => {
    if (!org) return;
    setSaving(true);
    const tpl = DOCUMENT_TEMPLATES.find((t) => t.id === templateId);
    const recommended = (tpl as any)?.recommendedPaperSize || "a4";
    // POS & Compact are size-locked; others adopt the recommended paper size.
    const enforcedSize =
      templateId === "pos" ? "pos80" :
      templateId === "compact" ? "a6" :
      recommended;
    const updates: any = { template_style: templateId, template_paper_size: enforcedSize };
    const { error } = await supabase.from("organizations").update(updates).eq("id", org.id);
    setSaving(false);
    if (error) {
      toast({ title: "Could not save template", description: error.message, variant: "destructive" });
      return;
    }
    setSelected(templateId);
    setPaperSize(enforcedSize);
    setOrganization({ ...org, ...updates } as any);
    const sizeName = PAPER_SIZES.find((s) => s.id === enforcedSize)?.name;
    toast({ title: `Template set to "${tpl?.name}"`, description: `Paper size: ${sizeName}` });
  };

  const handlePaperSizeChange = async (sizeId: string) => {
    if (!org) return;
    // Filter templates compatible with this paper size
    const compatible = DOCUMENT_TEMPLATES.filter(
      (t) => ((t as any).recommendedPaperSize || "a4") === sizeId
    );
    let newTemplate = selected;
    const currentTpl = DOCUMENT_TEMPLATES.find((t) => t.id === selected);
    const currentSize = (currentTpl as any)?.recommendedPaperSize || "a4";
    if (currentSize !== sizeId) {
      newTemplate = compatible[0]?.id || selected;
    }

    const updates: any = { template_paper_size: sizeId };
    if (newTemplate !== selected) updates.template_style = newTemplate;

    setSaving(true);
    const { error } = await supabase.from("organizations").update(updates).eq("id", org.id);
    setSaving(false);
    if (error) {
      toast({ title: "Could not save paper size", description: error.message, variant: "destructive" });
      return;
    }
    setPaperSize(sizeId);
    if (newTemplate !== selected) setSelected(newTemplate);
    setOrganization({ ...org, ...updates } as any);
    const sizeName = PAPER_SIZES.find((size) => size.id === sizeId)?.name;
    toast({
      title: `Paper size set to ${sizeName}`,
      description: newTemplate !== selected ? `Template switched to "${DOCUMENT_TEMPLATES.find(t => t.id === newTemplate)?.name}" for best fit.` : undefined,
    });
  };

  const visibleTemplates = DOCUMENT_TEMPLATES.filter(
    (t) => ((t as any).recommendedPaperSize || "a4") === paperSize
  );

  return (
    <div className="p-6 space-y-6">
      <SEO title="Invoice Templates" description="Choose and customize invoice templates that match your brand identity." path="/templates" />
      <PageHeader
        title="Invoice Templates"
        description="Choose a template style for your invoices, estimates, and credit notes"
      >
        <Button variant="outline" onClick={() => navigate("/templates/customize")}>
          <Palette className="mr-1 h-4 w-4" /> Customize Colors & Logo
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">PDF Paper Size</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            {PAPER_SIZES.map((size) => (
              <button
                key={size.id}
                type="button"
                disabled={saving}
                onClick={() => handlePaperSizeChange(size.id)}
                className={`rounded-lg border p-4 text-left transition-all ${paperSize === size.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{size.name}</div>
                    <div className="text-xs text-muted-foreground">{size.dimensions}</div>
                  </div>
                  {paperSize === size.id && <Check className="h-4 w-4 text-primary" />}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {DOCUMENT_TEMPLATES.map((tpl) => (
          <Card
            key={tpl.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selected === tpl.id ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => handleSelect(tpl.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {tpl.name}
                </CardTitle>
                {selected === tpl.id && (
                  <Badge variant="default" className="gap-1">
                    <Check className="h-3 w-3" /> Active
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{tpl.description}</p>
            </CardHeader>
            <CardContent>
              {/* Realistic mini invoice preview */}
              <div
                className={`rounded-lg border overflow-hidden bg-white text-[7px] leading-[1.3] text-slate-800 aspect-[1/1.2] p-3 flex flex-col gap-2 shadow-inner`}
                style={{ fontFamily: "Inter, system-ui, sans-serif" }}
              >
                {/* Header */}
                <div
                  className={`flex justify-between items-start ${
                    tpl.id === "modern" ? "bg-blue-600 text-white -mx-3 -mt-3 px-3 py-2" :
                    tpl.id === "professional" ? "border-b-2 border-slate-700 pb-1" :
                    tpl.id === "minimal" ? "" :
                    "border-b border-slate-300 pb-1"
                  }`}
                >
                  <div>
                    <div className="font-bold text-[9px]">ACME Corp.</div>
                    <div className="opacity-70">123 Business St.</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-[10px] tracking-wide">INVOICE</div>
                    <div className="opacity-70">#INV-001</div>
                  </div>
                </div>
                {/* Bill to */}
                <div className="flex justify-between gap-2">
                  <div>
                    <div className="opacity-60 uppercase text-[6px]">Bill To</div>
                    <div className="font-semibold">John Doe</div>
                    <div className="opacity-70">Doe Industries</div>
                  </div>
                  <div className="text-right">
                    <div className="opacity-60 uppercase text-[6px]">Date</div>
                    <div>12 May 2026</div>
                  </div>
                </div>
                {/* Items table */}
                <div className="flex-1">
                  <div className={`flex justify-between font-semibold py-1 px-1 ${tpl.id === "modern" ? "bg-blue-100" : "bg-slate-100"}`}>
                    <span>Item</span><span>Qty</span><span>Amt</span>
                  </div>
                  <div className="flex justify-between py-1 px-1 border-b border-slate-100">
                    <span>Web Design</span><span>1</span><span>₹500</span>
                  </div>
                  <div className="flex justify-between py-1 px-1 border-b border-slate-100">
                    <span>Hosting</span><span>2</span><span>₹200</span>
                  </div>
                </div>
                {/* Total */}
                <div className="flex justify-end">
                  <div className={`px-2 py-1 ${tpl.id === "modern" ? "bg-blue-600 text-white rounded" : tpl.id === "professional" ? "border-t-2 border-slate-700" : "border-t border-slate-300"}`}>
                    <span className="opacity-80 mr-1">Total:</span>
                    <span className="font-bold">₹700.00</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px]">
                    {PAPER_SIZES.find((s) => s.id === ((tpl as any).recommendedPaperSize || "a4"))?.name}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">recommended</span>
                </div>
                {selected === tpl.id && saving && <span className="text-xs text-muted-foreground">Saving...</span>}
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {tpl.features.map((f) => (
                  <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
