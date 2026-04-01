export const DOCUMENT_TEMPLATES = [
  {
    id: "classic",
    name: "Classic",
    description: "Traditional business invoice with clean layout",
    preview: "bg-background border-border",
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
    preview: "bg-muted/30 border-border",
    features: ["Minimalist layout", "Subtle borders", "Compact totals"],
  },
  {
    id: "professional",
    name: "Professional",
    description: "Corporate-grade template with detailed sections",
    preview: "bg-accent/10 border-accent/30",
    features: ["Dual address blocks", "Payment details", "Tax breakdown"],
  },
  {
    id: "asperiores",
    name: "Asperiores",
    description: "Bold executive layout with striking contrasts",
    preview: "bg-destructive/5 border-destructive/20",
    features: ["Bold headers", "Contrast sections", "Executive summary"],
  },
  {
    id: "magnam",
    name: "Magnam",
    description: "Elegant template with refined spacing and serif touches",
    preview: "bg-success/5 border-success/20",
    features: ["Serif accents", "Elegant borders", "Refined totals"],
  },
  {
    id: "quisquam",
    name: "Quisquam",
    description: "Compact data-dense layout for detailed invoices",
    preview: "bg-warning/5 border-warning/20",
    features: ["Dense tables", "Compact layout", "Multi-column footer"],
  },
  {
    id: "nobis",
    name: "Nobis",
    description: "Creative modern template with asymmetric design",
    preview: "bg-secondary/50 border-secondary",
    features: ["Asymmetric layout", "Creative header", "Accent sidebar"],
  },
  {
    id: "compact",
    name: "Compact Bill",
    description: "Traditional compact bill format with centered header and numbered items",
    preview: "bg-background border-primary/30",
    features: ["Centered header", "Numbered items", "Balance due highlight"],
  },
] as const;

export const PAPER_SIZES = [
  { id: "a4", name: "A4", dimensions: "210 × 297 mm" },
  { id: "letter", name: "Letter", dimensions: "8.5 × 11 in" },
  { id: "legal", name: "Legal", dimensions: "8.5 × 14 in" },
  { id: "a5", name: "A5", dimensions: "148 × 210 mm" },
  { id: "a6", name: "A6", dimensions: "105 × 148 mm" },
] as const;

export function getDocumentPreviewClass(templateStyle?: string, paperSize?: string) {
  const styleClass = {
    classic: "rounded-xl border border-border bg-card text-card-foreground shadow-sm",
    modern: "rounded-[1.5rem] border border-primary/20 bg-card text-card-foreground shadow-sm",
    minimal: "border border-border/70 bg-background text-foreground",
    professional: "rounded-lg border border-accent bg-card text-card-foreground shadow-md",
    asperiores: "rounded-xl border-2 border-destructive/30 bg-card text-card-foreground shadow-lg",
    magnam: "rounded-2xl border border-success/30 bg-card text-card-foreground shadow-sm",
    quisquam: "rounded-md border border-warning/30 bg-card text-card-foreground shadow-sm",
    nobis: "rounded-xl border-l-4 border-secondary bg-card text-card-foreground shadow-md",
    compact: "rounded-lg border border-foreground/20 bg-background text-foreground shadow-sm",
  }[templateStyle || "classic"];

  const sizeClass = {
    a4: "max-w-[210mm]",
    letter: "max-w-[8.5in]",
    legal: "max-w-[8.5in] min-h-[14in]",
    a5: "max-w-[148mm]",
    a6: "max-w-[105mm]",
  }[paperSize || "a4"];

  const isCompact = templateStyle === "compact";
  return `invoice-printable ${isCompact ? "" : "mx-auto"} w-full ${styleClass || "rounded-xl border border-border bg-card text-card-foreground shadow-sm"} ${isCompact ? "" : (sizeClass || "max-w-[210mm]")} print:max-w-none print:shadow-none print:border-0 print:rounded-none`;
}

export function getPaperSizeLabel(paperSize?: string) {
  return PAPER_SIZES.find((size) => size.id === paperSize)?.name || "A4";
}

/** Returns CSS class to add to <html> or a <style> tag for @page sizing */
export function getPrintPageCSS(paperSize?: string): string {
  const sizes: Record<string, string> = {
    a4: "210mm 297mm",
    letter: "8.5in 11in",
    legal: "8.5in 14in",
    a5: "148mm 210mm",
    a6: "105mm 148mm",
  };
  const size = sizes[paperSize || "a4"] || sizes.a4;

  // Font scaling for smaller papers
  const fontScale: Record<string, string> = {
    a4: "11px",
    letter: "11px",
    legal: "11px",
    a5: "9px",
    a6: "7px",
  };
  const baseFontSize = fontScale[paperSize || "a4"] || "11px";

  return `
@media print {
  @page { size: ${size}; margin: 8mm; }
  html, body { margin: 0 !important; padding: 0 !important; }
  body * { visibility: hidden; }
  .invoice-printable, .invoice-printable * { visibility: visible; }
  .invoice-printable {
    position: absolute; left: 0; top: 0;
    width: 100% !important; max-width: none !important;
    margin: 0 !important; padding: 12px !important;
    font-size: ${baseFontSize} !important;
    box-shadow: none !important; border: none !important; border-radius: 0 !important;
    page-break-inside: avoid;
    overflow: hidden;
  }
  .invoice-printable table { font-size: inherit !important; }
  .invoice-printable th, .invoice-printable td { padding: 3px 6px !important; font-size: inherit !important; }
  .invoice-printable h1, .invoice-printable h2, .invoice-printable h3 { font-size: 1.1em !important; }
  .no-print, header, nav, aside, [data-sidebar], .sidebar-trigger { display: none !important; }
}`;
}