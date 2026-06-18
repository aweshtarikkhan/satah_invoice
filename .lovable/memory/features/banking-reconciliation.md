---
name: Banking & Reconciliation (Phase 8)
description: Bank/cash accounts, CSV statement import, transaction matching to payments/bills/expenses, cash flow dashboard.
type: feature
---
- `bank_accounts`: types bank/cash/upi/credit_card/wallet, optional link to COA `accounts.id`, opening + current balance.
- `bank_transactions`: imported or manual; fields direction (credit/debit), amount, description, reference, balance_after, source (manual/csv/ofx/upi_csv), reconciled flag, matched_type + matched_id.
- CSV parser heuristically detects HDFC/SBI/ICICI/Axis/UPI exports: looks for date / narration|description / debit+credit or amount / ref|UTR / balance columns. Dates accept dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd.
- Reconciliation UI suggests matches based on amount equality + date within ±3 days from existing `payments` (credits) or `bill_payments` + `business_expenses` (debits). Linking sets reconciled=true and stores matched_type/matched_id.
- Current balance auto-adjusts on import/manual add/delete using direction sign.
- `CashFlowPage` shows 6-month inflow vs outflow bars + recent transactions, sourced purely from `bank_transactions`.
