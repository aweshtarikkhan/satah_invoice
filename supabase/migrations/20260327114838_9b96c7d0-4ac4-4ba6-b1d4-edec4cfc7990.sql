
ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS gst_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gst_number text,
  ADD COLUMN IF NOT EXISTS show_client_gst boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS qr_code_enabled boolean NOT NULL DEFAULT false;
