-- Add new advanced details columns to items table
ALTER TABLE public.items 
  ADD COLUMN IF NOT EXISTS purchase_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sales_price_type text DEFAULT 'with_tax',
  ADD COLUMN IF NOT EXISTS purchase_price_type text DEFAULT 'with_tax',
  ADD COLUMN IF NOT EXISTS discount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS show_online boolean DEFAULT false;

-- Create item_party_prices table
CREATE TABLE IF NOT EXISTS public.item_party_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  party_type text NOT NULL CHECK (party_type IN ('client', 'vendor')),
  party_id uuid NOT NULL,
  price numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- Enable RLS
ALTER TABLE public.item_party_prices ENABLE ROW LEVEL SECURITY;

-- Create policies for item_party_prices
CREATE POLICY "Users can manage item party prices in their org" ON public.item_party_prices
  USING (org_id = public.get_user_org_id())
  WITH CHECK (org_id = public.get_user_org_id());

CREATE POLICY "Users can view item party prices in their org" ON public.item_party_prices
  FOR SELECT
  USING (org_id = public.get_user_org_id());
