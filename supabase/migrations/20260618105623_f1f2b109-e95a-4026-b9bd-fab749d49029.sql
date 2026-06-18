
-- ============ BRANCHES ============
CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  address jsonb DEFAULT '{}'::jsonb,
  gstin text,
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "branches_org_select" ON public.branches FOR SELECT TO authenticated USING (org_id = public.get_user_org_id());
CREATE POLICY "branches_org_write" ON public.branches FOR ALL TO authenticated USING (org_id = public.get_user_org_id()) WITH CHECK (org_id = public.get_user_org_id());
CREATE TRIGGER trg_branches_updated BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_branches_org ON public.branches(org_id);

-- ============ VENDORS ============
CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_name text,
  email text,
  phone text,
  gstin text,
  pan text,
  billing_address jsonb DEFAULT '{}'::jsonb,
  shipping_address jsonb DEFAULT '{}'::jsonb,
  payment_terms integer DEFAULT 30,
  opening_balance numeric(14,2) DEFAULT 0,
  balance_due numeric(14,2) DEFAULT 0,
  currency text DEFAULT 'INR',
  notes text,
  tags text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  tds_section_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendors_org_select" ON public.vendors FOR SELECT TO authenticated USING (org_id = public.get_user_org_id());
CREATE POLICY "vendors_org_write" ON public.vendors FOR ALL TO authenticated USING (org_id = public.get_user_org_id()) WITH CHECK (org_id = public.get_user_org_id());
CREATE TRIGGER trg_vendors_updated BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_vendors_org ON public.vendors(org_id);

-- ============ CHART OF ACCOUNTS ============
CREATE TYPE public.account_type AS ENUM ('asset','liability','equity','income','expense');

CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  type public.account_type NOT NULL,
  parent_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  is_system boolean DEFAULT false,
  is_active boolean DEFAULT true,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "accounts_org_select" ON public.accounts FOR SELECT TO authenticated USING (org_id = public.get_user_org_id());
CREATE POLICY "accounts_org_write" ON public.accounts FOR ALL TO authenticated USING (org_id = public.get_user_org_id()) WITH CHECK (org_id = public.get_user_org_id());
CREATE TRIGGER trg_accounts_updated BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_accounts_org ON public.accounts(org_id);

-- ============ JOURNAL ENTRIES ============
CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  reference text,
  narration text,
  source_type text,
  source_id uuid,
  total_debit numeric(14,2) DEFAULT 0,
  total_credit numeric(14,2) DEFAULT 0,
  is_posted boolean DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO service_role;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "je_org_select" ON public.journal_entries FOR SELECT TO authenticated USING (org_id = public.get_user_org_id());
CREATE POLICY "je_org_write" ON public.journal_entries FOR ALL TO authenticated USING (org_id = public.get_user_org_id()) WITH CHECK (org_id = public.get_user_org_id());
CREATE TRIGGER trg_je_updated BEFORE UPDATE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_je_org_date ON public.journal_entries(org_id, entry_date);

CREATE TABLE public.journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  debit numeric(14,2) DEFAULT 0,
  credit numeric(14,2) DEFAULT 0,
  description text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_lines TO authenticated;
GRANT ALL ON public.journal_lines TO service_role;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jl_org_select" ON public.journal_lines FOR SELECT TO authenticated USING (org_id = public.get_user_org_id());
CREATE POLICY "jl_org_write" ON public.journal_lines FOR ALL TO authenticated USING (org_id = public.get_user_org_id()) WITH CHECK (org_id = public.get_user_org_id());
CREATE INDEX idx_jl_entry ON public.journal_lines(entry_id);
CREATE INDEX idx_jl_account ON public.journal_lines(account_id);

-- ============ TDS ============
CREATE TABLE public.tds_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  rate numeric(5,2) NOT NULL DEFAULT 0,
  threshold numeric(14,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tds_sections TO authenticated;
GRANT ALL ON public.tds_sections TO service_role;
ALTER TABLE public.tds_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tds_sec_org_select" ON public.tds_sections FOR SELECT TO authenticated USING (org_id = public.get_user_org_id());
CREATE POLICY "tds_sec_org_write" ON public.tds_sections FOR ALL TO authenticated USING (org_id = public.get_user_org_id()) WITH CHECK (org_id = public.get_user_org_id());
CREATE TRIGGER trg_tds_sec_updated BEFORE UPDATE ON public.tds_sections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.vendors ADD CONSTRAINT vendors_tds_section_fk FOREIGN KEY (tds_section_id) REFERENCES public.tds_sections(id) ON DELETE SET NULL;

-- ============ BILLS (Accounts Payable) ============
CREATE TYPE public.bill_status AS ENUM ('draft','received','partial','paid','cancelled');

CREATE TABLE public.bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  bill_number text NOT NULL,
  vendor_bill_number text,
  bill_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  currency text DEFAULT 'INR',
  exchange_rate numeric(12,6) DEFAULT 1,
  subtotal numeric(14,2) DEFAULT 0,
  tax_total numeric(14,2) DEFAULT 0,
  tds_section_id uuid REFERENCES public.tds_sections(id) ON DELETE SET NULL,
  tds_amount numeric(14,2) DEFAULT 0,
  discount numeric(14,2) DEFAULT 0,
  round_off numeric(14,2) DEFAULT 0,
  total numeric(14,2) DEFAULT 0,
  amount_paid numeric(14,2) DEFAULT 0,
  balance_due numeric(14,2) DEFAULT 0,
  status public.bill_status DEFAULT 'received',
  notes text,
  terms text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bills TO authenticated;
GRANT ALL ON public.bills TO service_role;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bills_org_select" ON public.bills FOR SELECT TO authenticated USING (org_id = public.get_user_org_id());
CREATE POLICY "bills_org_write" ON public.bills FOR ALL TO authenticated USING (org_id = public.get_user_org_id()) WITH CHECK (org_id = public.get_user_org_id());
CREATE TRIGGER trg_bills_updated BEFORE UPDATE ON public.bills FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_bills_org ON public.bills(org_id);
CREATE INDEX idx_bills_vendor ON public.bills(vendor_id);

CREATE TABLE public.bill_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  description text NOT NULL,
  hsn text,
  quantity numeric(14,3) DEFAULT 1,
  unit text,
  rate numeric(14,2) DEFAULT 0,
  discount numeric(14,2) DEFAULT 0,
  tax_rate numeric(5,2) DEFAULT 0,
  tax_amount numeric(14,2) DEFAULT 0,
  amount numeric(14,2) DEFAULT 0,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bill_lines TO authenticated;
GRANT ALL ON public.bill_lines TO service_role;
ALTER TABLE public.bill_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bill_lines_org_select" ON public.bill_lines FOR SELECT TO authenticated USING (org_id = public.get_user_org_id());
CREATE POLICY "bill_lines_org_write" ON public.bill_lines FOR ALL TO authenticated USING (org_id = public.get_user_org_id()) WITH CHECK (org_id = public.get_user_org_id());
CREATE INDEX idx_bill_lines_bill ON public.bill_lines(bill_id);

CREATE TABLE public.bill_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  bill_id uuid REFERENCES public.bills(id) ON DELETE SET NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  payment_method text DEFAULT 'bank_transfer',
  reference text,
  notes text,
  currency text DEFAULT 'INR',
  exchange_rate numeric(12,6) DEFAULT 1,
  tds_amount numeric(14,2) DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bill_payments TO authenticated;
GRANT ALL ON public.bill_payments TO service_role;
ALTER TABLE public.bill_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bp_org_select" ON public.bill_payments FOR SELECT TO authenticated USING (org_id = public.get_user_org_id());
CREATE POLICY "bp_org_write" ON public.bill_payments FOR ALL TO authenticated USING (org_id = public.get_user_org_id()) WITH CHECK (org_id = public.get_user_org_id());
CREATE TRIGGER trg_bp_updated BEFORE UPDATE ON public.bill_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_bp_org ON public.bill_payments(org_id);
CREATE INDEX idx_bp_vendor ON public.bill_payments(vendor_id);
CREATE INDEX idx_bp_bill ON public.bill_payments(bill_id);

CREATE TABLE public.tds_deductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES public.tds_sections(id) ON DELETE RESTRICT,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  deduction_date date NOT NULL DEFAULT CURRENT_DATE,
  base_amount numeric(14,2) NOT NULL,
  rate numeric(5,2) NOT NULL,
  tds_amount numeric(14,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tds_deductions TO authenticated;
GRANT ALL ON public.tds_deductions TO service_role;
ALTER TABLE public.tds_deductions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tdsd_org_select" ON public.tds_deductions FOR SELECT TO authenticated USING (org_id = public.get_user_org_id());
CREATE POLICY "tdsd_org_write" ON public.tds_deductions FOR ALL TO authenticated USING (org_id = public.get_user_org_id()) WITH CHECK (org_id = public.get_user_org_id());
CREATE INDEX idx_tdsd_org ON public.tds_deductions(org_id);

-- Add branch_id to existing transactional tables for multi-branch reporting
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.credit_notes ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.business_expenses ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

-- Next-number columns on organizations for bills
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS next_bill_number integer DEFAULT 1;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS bill_prefix text DEFAULT 'BILL-';

-- ============ SEED helper: seed default COA + TDS for an org ============
CREATE OR REPLACE FUNCTION public.seed_default_accounting(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Assets
  INSERT INTO accounts(org_id,code,name,type,is_system) VALUES
    (p_org_id,'1000','Cash','asset',true),
    (p_org_id,'1010','Bank Account','asset',true),
    (p_org_id,'1100','Accounts Receivable','asset',true),
    (p_org_id,'1200','Inventory','asset',true),
    (p_org_id,'1300','Input GST','asset',true),
    (p_org_id,'1400','TDS Receivable','asset',true)
  ON CONFLICT (org_id, code) DO NOTHING;
  -- Liabilities
  INSERT INTO accounts(org_id,code,name,type,is_system) VALUES
    (p_org_id,'2000','Accounts Payable','liability',true),
    (p_org_id,'2100','Output GST','liability',true),
    (p_org_id,'2200','TDS Payable','liability',true)
  ON CONFLICT (org_id, code) DO NOTHING;
  -- Equity
  INSERT INTO accounts(org_id,code,name,type,is_system) VALUES
    (p_org_id,'3000','Owner Equity','equity',true),
    (p_org_id,'3100','Retained Earnings','equity',true)
  ON CONFLICT (org_id, code) DO NOTHING;
  -- Income
  INSERT INTO accounts(org_id,code,name,type,is_system) VALUES
    (p_org_id,'4000','Sales Revenue','income',true),
    (p_org_id,'4100','Other Income','income',true),
    (p_org_id,'4200','Discount Received','income',true)
  ON CONFLICT (org_id, code) DO NOTHING;
  -- Expense
  INSERT INTO accounts(org_id,code,name,type,is_system) VALUES
    (p_org_id,'5000','Cost of Goods Sold','expense',true),
    (p_org_id,'5100','Operating Expenses','expense',true),
    (p_org_id,'5200','Salaries & Wages','expense',true),
    (p_org_id,'5300','Rent','expense',true),
    (p_org_id,'5400','Utilities','expense',true),
    (p_org_id,'5500','Discount Allowed','expense',true),
    (p_org_id,'5900','Bank Charges','expense',true)
  ON CONFLICT (org_id, code) DO NOTHING;

  -- Default TDS sections
  INSERT INTO tds_sections(org_id, code, name, rate, threshold) VALUES
    (p_org_id, '194C', 'Payment to Contractors', 1.00, 30000),
    (p_org_id, '194J', 'Professional / Technical Services', 10.00, 30000),
    (p_org_id, '194H', 'Commission or Brokerage', 5.00, 15000),
    (p_org_id, '194I', 'Rent', 10.00, 240000),
    (p_org_id, '194Q', 'Purchase of Goods', 0.10, 5000000)
  ON CONFLICT (org_id, code) DO NOTHING;

  -- Default branch
  INSERT INTO branches(org_id, name, code, is_default)
  SELECT p_org_id, 'Head Office', 'HO', true
  WHERE NOT EXISTS (SELECT 1 FROM branches WHERE org_id = p_org_id);
END;
$$;

-- Seed for all existing orgs
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM organizations LOOP
    PERFORM public.seed_default_accounting(r.id);
  END LOOP;
END $$;

-- Patch org-creation RPC to also seed accounting
CREATE OR REPLACE FUNCTION public.create_organization_for_current_user(org_name text)
RETURNS organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing_org_id uuid;
  v_org public.organizations;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF org_name IS NULL OR btrim(org_name) = '' THEN RAISE EXCEPTION 'Organization name is required'; END IF;

  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (v_user_id, '', '') ON CONFLICT (user_id) DO NOTHING;

  SELECT org_id INTO v_existing_org_id FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  IF v_existing_org_id IS NOT NULL THEN RAISE EXCEPTION 'User already belongs to an organization'; END IF;

  INSERT INTO public.organizations (name, template_paper_size)
  VALUES (btrim(org_name), 'a4') RETURNING * INTO v_org;

  UPDATE public.profiles SET org_id = v_org.id, updated_at = now() WHERE user_id = v_user_id;

  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'owner')
  ON CONFLICT (user_id, role) DO NOTHING;

  PERFORM public.seed_default_accounting(v_org.id);

  RETURN v_org;
END;
$function$;
