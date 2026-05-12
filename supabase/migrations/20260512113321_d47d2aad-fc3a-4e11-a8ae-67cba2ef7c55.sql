ALTER TABLE public.organizations ALTER COLUMN inventory_enabled SET DEFAULT true;
UPDATE public.organizations SET inventory_enabled = true WHERE inventory_enabled = false;