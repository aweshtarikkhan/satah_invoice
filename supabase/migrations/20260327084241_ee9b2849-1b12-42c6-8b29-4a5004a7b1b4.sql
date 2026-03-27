
-- Currency exchange rates cache table
CREATE TABLE public.exchange_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  base_currency TEXT NOT NULL DEFAULT 'USD',
  target_currency TEXT NOT NULL,
  rate NUMERIC NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(base_currency, target_currency)
);

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read exchange rates
CREATE POLICY "Authenticated users can view exchange rates" ON public.exchange_rates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage exchange rates" ON public.exchange_rates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Template customization settings on organizations
ALTER TABLE public.organizations ADD COLUMN template_style TEXT NOT NULL DEFAULT 'classic';
ALTER TABLE public.organizations ADD COLUMN template_accent_color TEXT NOT NULL DEFAULT '#2563eb';
ALTER TABLE public.organizations ADD COLUMN template_font TEXT NOT NULL DEFAULT 'Inter';
ALTER TABLE public.organizations ADD COLUMN template_show_logo BOOLEAN NOT NULL DEFAULT true;
