---
name: Phase 6 — Accounting Core
description: Double-entry GL, vendors, bills, TDS, branches; auto-post journals via src/lib/accounting.ts; chart of accounts seeded via seed_default_accounting() (codes 1000/1010/1100/1200/1300/1400/2000/2100/2200/3000/3100/4000/5000…).
type: feature
---
- Tables: branches, vendors, accounts, journal_entries, journal_lines, tds_sections, bills, bill_lines, bill_payments, tds_deductions.
- COA codes used by accounting.ts: 1000 Cash, 1010 Bank, 1100 AR, 1300 Input GST, 2000 AP, 2100 Output GST, 2200 TDS Payable, 4000 Sales, 5100 Operating Expenses.
- `seed_default_accounting(org_id)` seeds COA + default TDS sections (194C/J/H/I/Q) + default branch; auto-invoked by create_organization_for_current_user RPC and run for all existing orgs in migration.
- Bills posting flow: BillBuilder → postBillJournal (DR expense lines + Input GST, CR AP + TDS Payable). Payment → postBillPaymentJournal (DR AP, CR Cash/Bank).
- Reports at /accounting-reports compute Trial Balance, Balance Sheet, Cash Flow from journal_lines aggregation.
- Manual journal entry UI at /journal supports unbalanced check.
- Multi-branch: branch_id added to invoices/estimates/credit_notes/payments/business_expenses; selectable in BillBuilder.
