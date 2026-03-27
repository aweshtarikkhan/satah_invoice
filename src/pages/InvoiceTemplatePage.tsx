import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, FileText, Palette } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { useToast } from "@/hooks/use-toast";

const templates = [
  {
    id: "classic",
    name: "Classic",
    description: "Traditional business invoice with clean layout",
    preview: "bg-background border",
    features: ["Company logo", "Line items table", "Notes section"],
  },
  {
    id: "modern",
    name: "Modern",
    description: "Contemporary design with accent colors and bold typography",
    preview: "bg-primary/5 border-primary/20",
    features: ["Colored header", "Rounded elements", "Status badges"],
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Clean and simple with maximum whitespace",
    preview: "bg-muted/30 border-muted",
    features: ["Minimalist layout", "Subtle borders", "Compact totals"],
  },
  {
    id: "professional",
    name: "Professional",
    description: "Corporate-grade template with detailed sections",
    preview: "bg-accent/10 border-accent/30",
    features: ["Dual address blocks", "Payment details", "Tax breakdown"],
  },
];

export default function InvoiceTemplatePage() {
  const [selected, setSelected] = useState("classic");
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSelect = (templateId: string) => {
    setSelected(templateId);
    localStorage.setItem("invoice_template", templateId);
    toast({ title: `Template set to "${templates.find(t => t.id === templateId)?.name}"` });
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Invoice Templates"
        description="Choose a template style for your invoices, estimates, and credit notes"
      >
        <Button variant="outline" onClick={() => navigate("/templates/customize")}>
          <Palette className="mr-1 h-4 w-4" /> Customize Colors & Logo
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {templates.map((tpl) => (
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
              {/* Template preview mock */}
              <div className={`rounded-lg border p-4 ${tpl.preview} space-y-3`}>
                {/* Header */}
                <div className="flex justify-between items-start">
                  <div>
                    <div className={`h-3 w-24 rounded ${tpl.id === "modern" ? "bg-primary/30" : "bg-muted-foreground/20"}`} />
                    <div className="h-2 w-16 rounded bg-muted-foreground/10 mt-1" />
                  </div>
                  <div className="text-right">
                    <div className={`h-4 w-20 rounded ml-auto ${tpl.id === "modern" ? "bg-primary/20" : "bg-muted-foreground/15"}`} />
                    <div className="h-2 w-12 rounded bg-muted-foreground/10 mt-1 ml-auto" />
                  </div>
                </div>
                {/* Lines */}
                <div className="space-y-1">
                  <div className="h-2 w-full rounded bg-muted-foreground/10" />
                  <div className="h-2 w-3/4 rounded bg-muted-foreground/10" />
                  <div className="h-2 w-5/6 rounded bg-muted-foreground/10" />
                </div>
                {/* Totals */}
                <div className="flex justify-end">
                  <div className="space-y-1">
                    <div className="h-2 w-20 rounded bg-muted-foreground/10" />
                    <div className={`h-3 w-24 rounded ${tpl.id === "modern" ? "bg-primary/25" : "bg-muted-foreground/20"}`} />
                  </div>
                </div>
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
