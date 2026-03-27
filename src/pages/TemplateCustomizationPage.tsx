import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Upload, Check, FileText, Palette } from "lucide-react";
import { PAPER_SIZES } from "@/lib/document-templates";

const TEMPLATE_STYLES = [
  { id: "classic", name: "Classic", description: "Traditional business layout" },
  { id: "modern", name: "Modern", description: "Contemporary with accent colors" },
  { id: "minimal", name: "Minimal", description: "Clean and simple" },
  { id: "professional", name: "Professional", description: "Corporate-grade" },
  { id: "asperiores", name: "Asperiores", description: "Bold executive with striking contrasts" },
  { id: "magnam", name: "Magnam", description: "Elegant with refined spacing" },
  { id: "quisquam", name: "Quisquam", description: "Compact data-dense layout" },
  { id: "nobis", name: "Nobis", description: "Creative asymmetric design" },
];

const FONTS = [
  "Inter", "Arial", "Helvetica", "Georgia", "Times New Roman",
  "Roboto", "Open Sans", "Lato", "Montserrat",
];

const ACCENT_COLORS = [
  "#2563eb", "#0891b2", "#059669", "#d97706", "#dc2626",
  "#7c3aed", "#db2777", "#1d4ed8", "#374151", "#0d9488",
];

export default function TemplateCustomizationPage() {
  const org = useAppStore((s) => s.organization);
  const setOrganization = useAppStore((s) => s.setOrganization);
  const { toast } = useToast();

  const [style, setStyle] = useState("classic");
  const [accentColor, setAccentColor] = useState("#2563eb");
  const [font, setFont] = useState("Inter");
  const [showLogo, setShowLogo] = useState(true);
  const [logoUrl, setLogoUrl] = useState("");
  const [paperSize, setPaperSize] = useState("a4");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!org) return;
    setStyle((org as any).template_style || "classic");
    setAccentColor((org as any).template_accent_color || "#2563eb");
    setFont((org as any).template_font || "Inter");
    setShowLogo((org as any).template_show_logo ?? true);
    setLogoUrl(org.logo_url || "");
    setPaperSize((org as any).template_paper_size || "a4");
  }, [org]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !org) return;
    setUploading(true);

    const ext = file.name.split(".").pop();
    const path = `${org.id}/logo.${ext}`;

    const { error } = await supabase.storage.from("org-logos").upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("org-logos").getPublicUrl(path);
    const url = urlData.publicUrl;

    await supabase.from("organizations").update({ logo_url: url }).eq("id", org.id);
    setLogoUrl(url);
    setOrganization({ ...org, logo_url: url } as any);
    toast({ title: "Logo uploaded!" });
    setUploading(false);
  };

  const handleSave = async () => {
    if (!org) return;
    const { error } = await supabase.from("organizations").update({
      template_style: style,
      template_accent_color: accentColor,
      template_font: font,
      template_show_logo: showLogo,
      template_paper_size: paperSize,
    }).eq("id", org.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setOrganization({ ...org, template_style: style, template_accent_color: accentColor, template_font: font, template_show_logo: showLogo, template_paper_size: paperSize } as any);
      toast({ title: "Template settings saved!" });
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <PageHeader title="Template Customization" description="Customize the look of your invoices, estimates, and credit notes">
        <Button onClick={handleSave}>Save Changes</Button>
      </PageHeader>

      {/* Logo Upload */}
      <Card>
        <CardHeader><CardTitle className="text-base">Organization Logo</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-16 w-16 object-contain rounded-lg border" />
            ) : (
              <div className="h-16 w-16 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                <FileText className="h-6 w-6 text-muted-foreground/50" />
              </div>
            )}
            <div>
              <Label htmlFor="logo-upload" className="cursor-pointer">
                <div className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-muted/50 transition-colors">
                  <Upload className="h-4 w-4" />
                  {uploading ? "Uploading..." : "Upload Logo"}
                </div>
              </Label>
              <Input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
              <p className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG. Max 2MB.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={showLogo} onCheckedChange={(v) => setShowLogo(!!v)} />
            <Label>Show logo on documents</Label>
          </div>
        </CardContent>
      </Card>

      {/* Template Style */}
      <Card>
        <CardHeader><CardTitle className="text-base">Template Style</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {TEMPLATE_STYLES.map((tpl) => (
              <div
                key={tpl.id}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  style === tpl.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                }`}
                onClick={() => setStyle(tpl.id)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{tpl.name}</span>
                  {style === tpl.id && <Check className="h-4 w-4 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground">{tpl.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Accent Color */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Palette className="h-4 w-4" /> Accent Color</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {ACCENT_COLORS.map((color) => (
              <button
                key={color}
                className={`h-10 w-10 rounded-full border-2 transition-all ${
                  accentColor === color ? "border-foreground scale-110 shadow-md" : "border-transparent hover:scale-105"
                }`}
                style={{ backgroundColor: color }}
                onClick={() => setAccentColor(color)}
              />
            ))}
            <div className="flex items-center gap-2 ml-2">
              <Input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-10 w-10 p-0 border-0 cursor-pointer"
              />
              <span className="text-xs text-muted-foreground">Custom</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Font */}
      <Card>
        <CardHeader><CardTitle className="text-base">Font</CardTitle></CardHeader>
        <CardContent>
          <Select value={font} onValueChange={setFont}>
            <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FONTS.map((f) => (
                <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Paper Size</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {PAPER_SIZES.map((size) => (
              <button
                key={size.id}
                type="button"
                onClick={() => setPaperSize(size.id)}
                className={`rounded-lg border p-4 text-left transition-all ${paperSize === size.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-sm">{size.name}</div>
                    <div className="text-xs text-muted-foreground">{size.dimensions}</div>
                  </div>
                  {paperSize === size.id && <Check className="h-4 w-4 text-primary" />}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Live Preview */}
      <Card>
        <CardHeader><CardTitle className="text-base">Preview</CardTitle></CardHeader>
        <CardContent>
          <div
            className="border rounded-lg p-6 space-y-4"
            style={{ fontFamily: font }}
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                {showLogo && logoUrl && <img src={logoUrl} alt="Logo" className="h-10 w-10 object-contain" />}
                <div>
                  <h3 className="font-bold" style={{ color: accentColor }}>{org?.name || "Your Company"}</h3>
                  <p className="text-xs text-muted-foreground">{org?.email}</p>
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-xl font-bold" style={{ color: accentColor }}>INVOICE</h2>
                <p className="text-xs text-muted-foreground">INV-2026-0001</p>
                <Badge variant="outline" className="mt-2">{PAPER_SIZES.find((size) => size.id === paperSize)?.name}</Badge>
              </div>
            </div>
            <div className="border-t pt-3">
              <div className="grid grid-cols-4 text-xs font-medium pb-2" style={{ color: accentColor }}>
                <span>Item</span><span className="text-right">Qty</span><span className="text-right">Rate</span><span className="text-right">Amount</span>
              </div>
              <div className="grid grid-cols-4 text-xs py-1 border-t">
                <span>Web Design</span><span className="text-right">1</span><span className="text-right">$5,000</span><span className="text-right">$5,000</span>
              </div>
              <div className="grid grid-cols-4 text-xs py-1 border-t">
                <span>Hosting</span><span className="text-right">12</span><span className="text-right">$50</span><span className="text-right">$600</span>
              </div>
            </div>
            <div className="flex justify-end">
              <div className="text-right text-sm space-y-1">
                <div className="flex justify-between gap-8"><span className="text-muted-foreground">Subtotal</span><span>$5,600</span></div>
                <div className="flex justify-between gap-8 font-bold" style={{ color: accentColor }}><span>Total</span><span>$5,600</span></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
