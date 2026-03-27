
-- Credit note status enum
CREATE TYPE public.credit_note_status AS ENUM ('draft', 'sent', 'void');

-- Credit notes table
CREATE TABLE public.credit_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  client_id UUID NOT NULL REFERENCES public.clients(id),
  invoice_id UUID REFERENCES public.invoices(id),
  credit_note_number TEXT NOT NULL,
  reference_number TEXT,
  status credit_note_status NOT NULL DEFAULT 'draft',
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  currency_code TEXT NOT NULL DEFAULT 'USD',
  exchange_rate NUMERIC NOT NULL DEFAULT 1,
  discount NUMERIC NOT NULL DEFAULT 0,
  discount_type discount_type NOT NULL DEFAULT 'percentage',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  total_tax NUMERIC NOT NULL DEFAULT 0,
  total_discount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  terms_conditions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Credit note lines
CREATE TABLE public.credit_note_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  credit_note_id UUID NOT NULL REFERENCES public.credit_notes(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.items(id),
  name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  rate NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  discount_type discount_type NOT NULL DEFAULT 'percentage',
  tax_id UUID REFERENCES public.tax_rates(id),
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  unit TEXT
);

-- Portal tokens for client portal
CREATE TABLE public.portal_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  entity_type TEXT NOT NULL, -- 'invoice', 'estimate', 'credit_note'
  entity_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add credit_note_next_number to organizations
ALTER TABLE public.organizations ADD COLUMN credit_note_prefix TEXT NOT NULL DEFAULT 'CN';
ALTER TABLE public.organizations ADD COLUMN credit_note_next_number INTEGER NOT NULL DEFAULT 1;

-- Enable RLS
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_note_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_tokens ENABLE ROW LEVEL SECURITY;

-- Credit notes RLS
CREATE POLICY "Users can manage credit notes in their org" ON public.credit_notes
  FOR ALL TO authenticated
  USING (org_id = get_user_org_id())
  WITH CHECK (org_id = get_user_org_id());

CREATE POLICY "Users can view credit notes in their org" ON public.credit_notes
  FOR SELECT TO authenticated
  USING (org_id = get_user_org_id());

-- Credit note lines RLS
CREATE POLICY "Users can manage credit note lines" ON public.credit_note_lines
  FOR ALL TO authenticated
  USING (credit_note_id IN (SELECT id FROM credit_notes WHERE org_id = get_user_org_id()))
  WITH CHECK (credit_note_id IN (SELECT id FROM credit_notes WHERE org_id = get_user_org_id()));

CREATE POLICY "Users can view credit note lines" ON public.credit_note_lines
  FOR SELECT TO authenticated
  USING (credit_note_id IN (SELECT id FROM credit_notes WHERE org_id = get_user_org_id()));

-- Portal tokens RLS - org users can manage, plus anon can select by token
CREATE POLICY "Users can manage portal tokens in their org" ON public.portal_tokens
  FOR ALL TO authenticated
  USING (org_id = get_user_org_id())
  WITH CHECK (org_id = get_user_org_id());

CREATE POLICY "Anyone can view portal by token" ON public.portal_tokens
  FOR SELECT TO anon
  USING (true);

-- Allow anon to read invoices/estimates/credit_notes/lines via portal
CREATE POLICY "Anon can view invoices via portal" ON public.invoices
  FOR SELECT TO anon
  USING (id IN (SELECT entity_id FROM portal_tokens WHERE entity_type = 'invoice'));

CREATE POLICY "Anon can view invoice lines via portal" ON public.invoice_lines
  FOR SELECT TO anon
  USING (invoice_id IN (SELECT entity_id FROM portal_tokens WHERE entity_type = 'invoice'));

CREATE POLICY "Anon can view estimates via portal" ON public.estimates
  FOR SELECT TO anon
  USING (id IN (SELECT entity_id FROM portal_tokens WHERE entity_type = 'estimate'));

CREATE POLICY "Anon can view estimate lines via portal" ON public.estimate_lines
  FOR SELECT TO anon
  USING (estimate_id IN (SELECT entity_id FROM portal_tokens WHERE entity_type = 'estimate'));

CREATE POLICY "Anon can view credit notes via portal" ON public.credit_notes
  FOR SELECT TO anon
  USING (id IN (SELECT entity_id FROM portal_tokens WHERE entity_type = 'credit_note'));

CREATE POLICY "Anon can view credit note lines via portal" ON public.credit_note_lines
  FOR SELECT TO anon
  USING (credit_note_id IN (SELECT entity_id FROM portal_tokens WHERE entity_type = 'credit_note'));

CREATE POLICY "Anon can view org via portal" ON public.organizations
  FOR SELECT TO anon
  USING (id IN (SELECT org_id FROM portal_tokens));

CREATE POLICY "Anon can view clients via portal" ON public.clients
  FOR SELECT TO anon
  USING (id IN (
    SELECT client_id FROM invoices WHERE id IN (SELECT entity_id FROM portal_tokens WHERE entity_type = 'invoice')
    UNION
    SELECT client_id FROM estimates WHERE id IN (SELECT entity_id FROM portal_tokens WHERE entity_type = 'estimate')
    UNION
    SELECT client_id FROM credit_notes WHERE id IN (SELECT entity_id FROM portal_tokens WHERE entity_type = 'credit_note')
  ));
