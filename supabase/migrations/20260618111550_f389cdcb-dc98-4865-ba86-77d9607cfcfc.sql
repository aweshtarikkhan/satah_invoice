
-- Bank Accounts
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL, -- linked COA account
  name text NOT NULL,
  account_type text NOT NULL DEFAULT 'bank', -- bank, cash, upi, credit_card, wallet
  bank_name text,
  account_number text,
  ifsc text,
  upi_id text,
  currency text DEFAULT 'INR',
  opening_balance numeric NOT NULL DEFAULT 0,
  current_balance numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_accounts_org_all" ON public.bank_accounts FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id()) WITH CHECK (org_id = public.get_user_org_id());
CREATE TRIGGER trg_ba_updated BEFORE UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bank Transactions (imported / manual statement lines)
CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  txn_date date NOT NULL,
  amount numeric NOT NULL, -- positive for credit (money in), negative for debit (money out)
  direction text NOT NULL, -- 'credit' or 'debit'
  description text,
  reference text,
  counterparty text,
  balance_after numeric,
  source text DEFAULT 'manual', -- manual, csv, ofx, upi_csv
  reconciled boolean NOT NULL DEFAULT false,
  reconciled_at timestamptz,
  matched_type text, -- payment, bill_payment, expense, journal
  matched_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_transactions TO authenticated;
GRANT ALL ON public.bank_transactions TO service_role;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_txn_org_all" ON public.bank_transactions FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id()) WITH CHECK (org_id = public.get_user_org_id());
CREATE TRIGGER trg_bt_updated BEFORE UPDATE ON public.bank_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_bt_account_date ON public.bank_transactions(bank_account_id, txn_date);
CREATE INDEX IF NOT EXISTS idx_bt_reconciled ON public.bank_transactions(org_id, reconciled);
