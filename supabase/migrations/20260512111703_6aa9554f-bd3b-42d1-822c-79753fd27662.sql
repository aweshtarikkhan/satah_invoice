ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS inventory_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS low_stock_threshold numeric NOT NULL DEFAULT 5;