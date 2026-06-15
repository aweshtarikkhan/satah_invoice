
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS irn TEXT,
  ADD COLUMN IF NOT EXISTS irn_qr TEXT,
  ADD COLUMN IF NOT EXISTS ack_no TEXT,
  ADD COLUMN IF NOT EXISTS ack_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eway_bill_no TEXT,
  ADD COLUMN IF NOT EXISTS eway_valid_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eway_vehicle_no TEXT,
  ADD COLUMN IF NOT EXISTS eway_transport_mode TEXT,
  ADD COLUMN IF NOT EXISTS eway_distance_km INTEGER;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS multi_warehouse_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS irp_username TEXT,
  ADD COLUMN IF NOT EXISTS irp_gsp_provider TEXT;

CREATE TABLE IF NOT EXISTS public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address JSONB,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouses TO authenticated;
GRANT ALL ON public.warehouses TO service_role;

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage warehouses"
ON public.warehouses FOR ALL TO authenticated
USING (org_id = public.get_user_org_id())
WITH CHECK (org_id = public.get_user_org_id());

CREATE TRIGGER update_warehouses_updated_at
BEFORE UPDATE ON public.warehouses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
