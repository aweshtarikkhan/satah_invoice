# UDYAM360 — Phased Build Plan

Goal: Evolve the current Satah Invoice app into **UDYAM360**, an integrated MSME platform covering accounting, inventory, HR, CRM, marketing, social, feedback, and BI.

We already have: Invoicing, Estimates, Credit Notes, Payments, Clients, Items, Inventory (basic + stock movements + warehouses), Expenses, Recurring, GST Returns, P&L, Multi-currency, Client Portal, PWA, Demo, Landing page.

Below is what we still need, split into shippable phases. Each phase ends with a usable module.

---

## Phase 6 — Financial Accounting Core
Foundations for true accounting.
- General Ledger: `accounts` (chart of accounts), `journal_entries`, `journal_lines` (double-entry).
- Accounts Payable: `bills` (vendor invoices), `bill_payments`, link to vendors.
- Vendors table (separate from clients) + Purchase Orders, Goods Receipt Notes (GRN).
- Auto-post journal entries when invoices/payments/bills/expenses are created.
- Reports: Trial Balance, Balance Sheet, Cash Flow (alongside existing P&L).
- TDS: `tds_sections`, deduction on bills/payments, TDS report.
- Multi-Branch: `branches` table; tag transactions; branch filter on reports.

## Phase 7 — Inventory & Warehouse Depth ✅ DONE
- Batch & Serial number tracking on `stock_movements`.
- Inventory Valuation reports (FIFO / Weighted Avg).
- Reorder alerts (already started) → dashboard widget + email.
- Purchase Management workflow: PO → GRN → Bill (3-way match).
- Goods Dispatch (Delivery Challan upgrade with vehicle/transporter).

## Phase 8 — Banking & Reconciliation ✅ DONE
- `bank_accounts`, `bank_transactions` tables.
- CSV / OFX bank statement import.
- Reconciliation UI: match bank txns to payments/expenses/bills.
- UPI txn import (CSV from PhonePe/GPay merchant).
- Cash Flow Monitoring dashboard.

## Phase 9 — HRM (Employees, Attendance, Payroll)
- Employees already exists (basic). Extend: documents (storage bucket), self-service login via portal token.
- Attendance: GPS + mobile check-in (already has `attendance` table). Add shift scheduling, leave requests (`leaves` table).
- Payroll: `payroll_runs`, `payslips`, salary structure with PF/ESIC/TDS calc, PDF payslip export.

## Phase 10 — CRM & Sales Pipeline
- `leads`, `opportunities`, `pipeline_stages`.
- Kanban pipeline UI.
- Activity log per contact (calls, meetings, notes).
- Customer segmentation (tags + saved filters; tags already exist on clients).

## Phase 11 — Marketing Automation
- `campaigns` (email/SMS/WhatsApp), `campaign_recipients`, `campaign_events`.
- Resend already wired for email; add WhatsApp Cloud API + SMS provider (Twilio/MSG91) via connectors.
- Customer journey builder (simple trigger → action rules).
- Campaign analytics dashboard.

## Phase 12 — Social Media Management
- Multi-platform posting via connectors (Facebook, Instagram, LinkedIn, X).
- `social_posts` table with scheduled_at, status, platform, asset URLs.
- Calendar view + engagement metrics (where provider APIs allow).

## Phase 13 — AASSAY Feedback & Experience
- `surveys`, `survey_questions`, `survey_responses`.
- NPS, CSAT, custom survey templates.
- QR code generator for in-store feedback.
- WhatsApp/email survey distribution (uses Phase 11 channels).
- Sentiment analysis on text responses via Lovable AI.
- Real-time feedback dashboard + complaint workflow.

## Phase 14 — Business Intelligence & Analytics
- Unified BI dashboard pulling from all modules.
- Predictive trends via Lovable AI (revenue forecast, churn risk, stock-out prediction).
- Custom report builder (pick table + dims + metrics → chart).
- Scheduled email reports (daily/weekly/monthly).

---

## Cross-cutting
- Navigation: regroup sidebar into sections (Sales, Purchase, Accounting, Inventory, HR, CRM, Marketing, Feedback, Reports, Settings).
- Roles: extend `app_role` (accountant, hr, sales, marketing, viewer) and gate routes.
- Audit logs (table exists) — wire to all sensitive mutations.
- Rebrand surfaces from "Satah" → "UDYAM360" where appropriate (or keep Satah as product name under UDYAM360 umbrella — confirm).

---

## Order of execution
Each phase is 1 build session. I will tackle them sequentially when you say "phase 6", "phase 7", etc. Within a phase I will split further if it gets too large.

## Questions before Phase 6
1. **Branding**: rename app to "UDYAM360" everywhere, or keep "Satah" as the invoicing module inside a new "UDYAM360" shell?
2. **Scope of Phase 6**: do you want the full accounting depth (GL + AP + TDS + Multi-branch) in one go, or split into 6a (GL + Balance Sheet) and 6b (AP + TDS + Branches)?
3. **Vendors**: separate table, or extend `clients` with a `type` field (customer/vendor/both)?
4. **Communication channels** for Phase 11: which providers — WhatsApp Cloud API direct, or via Interakt/Gupshup? SMS via MSG91 or Twilio?

Reply with answers (or just "go") and I will start Phase 6.
