ALTER TABLE public.items ADD COLUMN IF NOT EXISTS hsn_code text;
ALTER TABLE public.invoice_lines ADD COLUMN IF NOT EXISTS hsn_code text;
ALTER TABLE public.estimate_lines ADD COLUMN IF NOT EXISTS hsn_code text;
ALTER TABLE public.credit_note_lines ADD COLUMN IF NOT EXISTS hsn_code text;