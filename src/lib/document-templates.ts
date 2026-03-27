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
] as const;

export const PAPER_SIZES = [
  { id: "a4", name: "A4", dimensions: "210 × 297 mm" },
  { id: "letter", name: "Letter", dimensions: "8.5 × 11 in" },
  { id: "legal", name: "Legal", dimensions: "8.5 × 14 in" },
  { id: "a5", name: "A5", dimensions: "148 × 210 mm" },
] as const;

export function getDocumentPreviewClass(templateStyle?: string, paperSize?: string) {
  const styleClass = {
    classic: "rounded-xl border border-border bg-card text-card-foreground shadow-sm",
    modern: "rounded-[1.5rem] border border-primary/20 bg-card text-card-foreground shadow-sm",
    minimal: "border border-border/70 bg-background text-foreground",
    professional: "rounded-lg border border-accent bg-card text-card-foreground shadow-md",
  }[templateStyle || "classic"];

  const sizeClass = {
    a4: "max-w-[210mm]",
    letter: "max-w-[8.5in]",
    legal: "max-w-[8.5in] min-h-[14in]",
    a5: "max-w-[148mm]",
  }[paperSize || "a4"];

  return `mx-auto w-full ${styleClass || "rounded-xl border border-border bg-card text-card-foreground shadow-sm"} ${sizeClass || "max-w-[210mm]"} print:max-w-none print:shadow-none`;
}

export function getPaperSizeLabel(paperSize?: string) {
  return PAPER_SIZES.find((size) => size.id === paperSize)?.name || "A4";
}