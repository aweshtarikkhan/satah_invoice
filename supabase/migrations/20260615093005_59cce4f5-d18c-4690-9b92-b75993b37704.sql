CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  change_qty numeric NOT NULL,
  balance_after numeric,
  reason text NOT NULL,
  ref_type text,
  ref_id uuid,
  ref_number text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_movements_org_item ON public.stock_movements(org_id, item_id, created_at DESC);
CREATE INDEX idx_stock_movements_ref ON public.stock_movements(ref_type, ref_id);

GRANT SELECT, INSERT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org stock movements"
  ON public.stock_movements FOR SELECT
  TO authenticated
  USING (org_id = public.get_user_org_id());

CREATE POLICY "Members can insert org stock movements"
  ON public.stock_movements FOR INSERT
  TO authenticated
  WITH CHECK (org_id = public.get_user_org_id());

ALTER TABLE public.credit_notes ADD COLUMN IF NOT EXISTS restock_inventory boolean NOT NULL DEFAULT false;