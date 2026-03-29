import { QRCodeSVG } from "qrcode.react";

interface CompactBillTemplateProps {
  org: any;
  invoice: any;
  lines: any[];
  fmt: (n: number) => string;
  type?: "invoice" | "estimate";
}

export function CompactBillTemplate({ org, invoice, lines, fmt, type = "invoice" }: CompactBillTemplateProps) {
  const clientName = (invoice.clients as any)?.display_name || "";
  const invoiceNumber = type === "estimate" ? invoice.estimate_number : invoice.invoice_number;
  const balanceDue = type === "estimate" ? Number(invoice.total) : Number(invoice.balance_due ?? invoice.total);
  const currencySymbol = org?.currency_code === "INR" ? "₹" : fmt(0).replace(/[\d.,]/g, "").trim();

  const addressParts: string[] = [];
  if (org?.address) {
    const a = typeof org.address === "string" ? JSON.parse(org.address) : org.address;
    if (a.street) addressParts.push(a.street);
    if (a.city || a.state || a.zip) addressParts.push([a.city, a.state, a.zip].filter(Boolean).join(", "));
  }

  return (
    <div className="bg-background text-foreground p-6 font-sans text-sm" style={{ fontFamily: "Arial, sans-serif" }}>
      {/* Company Header - Centered */}
      <div className="text-center mb-4">
        <h1 className="text-lg font-bold uppercase tracking-wide text-primary">{org?.name}</h1>
        {addressParts.map((line, i) => (
          <p key={i} className="text-xs text-muted-foreground">{line}</p>
        ))}
        {org?.phone && <p className="text-xs text-muted-foreground">{org.phone}</p>}
        {org?.gst_enabled && org?.gst_number && (
          <p className="text-xs text-muted-foreground">GSTIN: {org.gst_number}</p>
        )}
      </div>

      {/* Title */}
      <div className="text-center mb-4">
        <h2 className="text-base italic text-muted-foreground">
          {type === "estimate" ? "Estimated Bill" : "Tax Invoice"}
        </h2>
      </div>

      {/* Bill To / Invoice Info */}
      <div className="border-t border-b border-foreground/30 py-2 mb-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="font-semibold text-primary">Bill To:</span>{" "}
          <span className="font-medium">{clientName}</span>
        </div>
        <div className="text-right">
          <span className="font-semibold text-primary">{type === "estimate" ? "Estimate#" : "Invoice#"}:</span>{" "}
          <span>{invoiceNumber}</span>
        </div>
        <div>
          <span className="font-semibold text-primary">Date:</span>{" "}
          <span>{invoice.issue_date}</span>
        </div>
        <div className="text-right">
          <span className="font-semibold text-primary">Due Date:</span>{" "}
          <span>{type === "estimate" ? invoice.expiry_date : invoice.due_date}</span>
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full text-xs mb-3">
        <thead>
          <tr className="border-b border-foreground/30">
            <th className="text-left py-1 w-6">#</th>
            <th className="text-left py-1">Item &amp; Description</th>
            <th className="text-center py-1">Qty</th>
            <th className="text-right py-1">Rate</th>
            <th className="text-right py-1">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => (
            <tr key={line.id} className="border-b border-muted/50">
              <td className="py-1.5 align-top">{idx + 1}</td>
              <td className="py-1.5">
                <span className="font-medium">{line.name}</span>
                {line.description && (
                  <span className="block text-muted-foreground text-[10px]">{line.description}</span>
                )}
              </td>
              <td className="text-center py-1.5 align-top">
                <span>{line.quantity}</span>
                {line.unit && (
                  <span className="block text-muted-foreground text-[10px]">{line.unit}</span>
                )}
              </td>
              <td className="text-right py-1.5 align-top">{Number(line.rate).toFixed(2)}</td>
              <td className="text-right py-1.5 align-top font-medium">{Number(line.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="border-t border-foreground/30 pt-2 space-y-0.5 text-xs">
        {Number(invoice.total_discount) > 0 && (
          <div className="flex justify-between">
            <span className="text-primary font-medium">Discount</span>
            <span>-{fmt(Number(invoice.total_discount))}</span>
          </div>
        )}
        {Number(invoice.total_tax) > 0 && (
          <div className="flex justify-between">
            <span className="text-primary font-medium">Tax</span>
            <span>{fmt(Number(invoice.total_tax))}</span>
          </div>
        )}
        {Number(invoice.shipping_charge) > 0 && (
          <div className="flex justify-between">
            <span className="text-primary font-medium">Shipping</span>
            <span>{fmt(Number(invoice.shipping_charge))}</span>
          </div>
        )}
        {Number(invoice.adjustment) !== 0 && (
          <div className="flex justify-between">
            <span className="text-primary font-medium">{invoice.adjustment_name || "Rounding"}</span>
            <span>{Number(invoice.adjustment).toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-foreground/30 pt-1 font-bold text-sm">
          <span className="text-primary">Total</span>
          <span>{fmt(Number(invoice.total))}</span>
        </div>
      </div>

      {/* Balance Due */}
      <div className="mt-4 flex justify-between items-center">
        <span className="text-lg font-extrabold uppercase tracking-wide">BALANCE DUE</span>
        <span className="text-lg font-extrabold">{currencySymbol}{balanceDue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
      </div>

      {/* Divider */}
      <hr className="my-4 border-foreground/30" />

      {/* QR Code */}
      {org?.qr_code_enabled && (
        <div className="flex flex-col items-center mb-4">
          <QRCodeSVG
            value={
              org?.upi_id
                ? `upi://pay?pa=${org.upi_id}&pn=${encodeURIComponent(org.name || "")}&am=${balanceDue.toFixed(2)}&cu=${invoice.currency_code || "INR"}&tn=${encodeURIComponent(`Payment for ${invoiceNumber}`)}`
                : `${window.location.origin}/portal/invoice/${invoice.id}`
            }
            size={120}
            level="M"
          />
          <p className="text-[10px] text-muted-foreground mt-2">Scan the QR code to view the configured information.</p>
        </div>
      )}

      {/* Footer */}
      {invoice.notes && (
        <p className="text-center text-xs text-muted-foreground italic mt-2">{invoice.notes}</p>
      )}
      {!invoice.notes && (
        <p className="text-center text-xs text-muted-foreground italic mt-2">Thank you for your business!</p>
      )}
    </div>
  );
}
