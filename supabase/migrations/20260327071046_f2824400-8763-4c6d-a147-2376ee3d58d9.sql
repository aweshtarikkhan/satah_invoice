
-- Estimate status enum
CREATE TYPE public.estimate_status AS ENUM ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired', 'converted');

-- Estimates table
CREATE TABLE public.estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  estimate_number text NOT NULL,
  reference_number text,
  status estimate_status NOT NULL DEFAULT 'draft',
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  expiry_date date NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days')::date,
  currency_code text NOT NULL DEFAULT 'USD',
  exchange_rate numeric NOT NULL DEFAULT 1,
  discount numeric NOT NULL DEFAULT 0,
  discount_type discount_type NOT NULL DEFAULT 'percentage',
  shipping_charge numeric NOT NULL DEFAULT 0,
  adjustment numeric NOT NULL DEFAULT 0,
  adjustment_name text,
  subtotal numeric NOT NULL DEFAULT 0,
  total_tax numeric NOT NULL DEFAULT 0,
  total_discount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  notes text,
  terms_conditions text,
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  converted_invoice_id uuid REFERENCES public.invoices(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Estimate lines table
CREATE TABLE public.estimate_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.items(id),
  name text NOT NULL,
  description text,
  quantity numeric NOT NULL DEFAULT 1,
  rate numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  discount_type discount_type NOT NULL DEFAULT 'percentage',
  tax_id uuid REFERENCES public.tax_rates(id),
  tax_amount numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  unit text
);

-- Add estimate_next_number to organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS estimate_next_number integer NOT NULL DEFAULT 1;

-- RLS
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view estimates in their org" ON public.estimates
  FOR SELECT TO authenticated
  USING (org_id = get_user_org_id());

CREATE POLICY "Users can manage estimates in their org" ON public.estimates
  FOR ALL TO authenticated
  USING (org_id = get_user_org_id())
  WITH CHECK (org_id = get_user_org_id());

CREATE POLICY "Users can view estimate lines" ON public.estimate_lines
  FOR SELECT TO authenticated
  USING (estimate_id IN (SELECT id FROM estimates WHERE org_id = get_user_org_id()));

CREATE POLICY "Users can manage estimate lines" ON public.estimate_lines
  FOR ALL TO authenticated
  USING (estimate_id IN (SELECT id FROM estimates WHERE org_id = get_user_org_id()))
  WITH CHECK (estimate_id IN (SELECT id FROM estimates WHERE org_id = get_user_org_id()));

-- Updated_at trigger
CREATE TRIGGER update_estimates_updated_at
  BEFORE UPDATE ON public.estimates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
