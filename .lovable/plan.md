# 5-Phase Roadmap — GST & Invoicing Completion

Goal: ship the audit recommendations in 5 controlled phases. Each phase = small, testable, no breakage of existing flows. Critical/heavy items (IRN, E-way, Multi-warehouse, Native app) stay as **opt-in checkboxes on the invoice** — only triggered if user demands; no auto-generation.

---

## Phase 1 — Quick Wins (UX & Sharing)
Low-effort, high-impact items that make daily use smoother.

- **WhatsApp invoice share** — one-tap button on Invoice view + builder. Pre-fills message with client name, invoice no, amount, and portal/PDF link.
- **HSN/SAC auto-lookup** — searchable dropdown while adding an item; common HSN codes seeded; remembers per-item code.
- **Partial payment polish** — already supported; surface "Partially Paid" badge + remaining balance prominently on list & builder.
- **Print-friendly P&L tweak** — quick polish on existing P&L report (already exists per memory).

Deliverable: shareable invoices + faster product entry.

---

## Phase 2 — Stock & Inventory Hardening
Build on the just-shipped `deduct_stock` checkbox.

- **Low-stock alerts** on dashboard + item list.
- **Stock movement log** (read-only): every invoice deduction / credit-note restock recorded.
- **Restock on Credit Note** — when a credit note references an invoice with `deduct_stock=true`, optionally restore stock (checkbox on credit note, default OFF).
- **Negative-stock warning** at invoice save (non-blocking).

Deliverable: trustworthy inventory without forcing it on users.

---

## Phase 3 — GST Returns Export
Make the product GST-portal ready without paid APIs.

- **GSTR-1 JSON export** — one-click monthly export in GST portal upload format (B2B, B2C, HSN summary, doc series).
- **GSTR-3B summary report** — month-wise outward supply, tax payable, ITC view (read-only summary, copy-paste ready).
- **HSN-wise summary** report for any date range.
- **Tally-compatible CSV/XML export** for accountants.

Deliverable: monthly GST filing workflow handled inside the app.

---

## Phase 4 — Communication & Automation
Reduce manual follow-up work.

- **Automated payment reminders** — schedule (3 days before due, on due, 7/15/30 days overdue). Email via Resend; WhatsApp via deep-link queue.
- **Recurring invoice runner polish** — surface next-run, last-run, failures (table exists per memory).
- **Email templates** customizable per org (subject + body with merge tags).
- **Bulk send** — multi-select invoices → send/reminder in one go.

Deliverable: AR follow-up runs itself.

---

## Phase 5 — Opt-in Compliance Checkboxes (IRN / E-way / Multi-warehouse)
Per user's instruction: **no auto-create**. These appear as checkboxes on the invoice builder; action only fires when user demands.

- **"Generate E-invoice (IRN)" checkbox** — when checked at save, calls NIC/GSP endpoint (config-driven; user supplies credentials in Settings). If creds missing → show inline "Configure IRP" CTA, do not block save.
- **"Generate E-way bill" checkbox** — same pattern; opens form for vehicle/transport details only when checked.
- **Multi-warehouse toggle** in Settings — when ON, items get a `warehouse_id` selector. Default OFF preserves current single-stock behavior.
- **PWA install** — add manifest + service worker so users can "Install app" on Android/desktop (no native build).

Deliverable: compliance & scale features available on demand, zero impact on users who don't need them.

---

## Technical Notes
- New tables likely needed: `stock_movements`, `reminder_schedules`, `email_templates`, `warehouses` (Phase 5 only, gated).
- New columns on `invoices`: `eway_bill_no`, `irn`, `irn_qr`, `ack_no`, `ack_date` (nullable; populated only when user opts in).
- Edge functions: `gstr1-export`, `send-reminder`, `irn-generate`, `eway-generate`.
- All new fields default OFF / NULL — zero migration risk for existing data.

---

## Suggested Cadence
1 phase per build cycle. After each phase: test on a real invoice, then move on. Confirm Phase 1 to begin.
