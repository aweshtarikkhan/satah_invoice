
-- ============ Phase 7: Inventory & Warehouse Depth ============

-- 1) Extend stock_movements with batch / serial / cost / warehouse
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS batch_no text,
  ADD COLUMN IF NOT EXISTS serial_no text,
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS unit_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stock_movements_batch ON public.stock_movements(org_id, item_id, batch_no);
CREATE INDEX IF NOT EXISTS idx_stock_movements_serial ON public.stock_movements(org_id, item_id, serial_no);

-- 2) Extend items with tracking flags
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS track_batches boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS track_serials boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS valuation_method text DEFAULT 'weighted_avg';

-- 3) Purchase Orders
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  po_number text NOT NULL,
  po_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_date date,
  status text NOT NULL DEFAULT 'draft',  -- draft, sent, partial, received, closed, cancelled
  subtotal numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  currency text DEFAULT 'INR',
  notes text,
  terms text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "po_org_all" ON public.purchase_orders FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id()) WITH CHECK (org_id = public.get_user_org_id());

CREATE TABLE IF NOT EXISTS public.purchase_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
  description text NOT NULL,
  hsn text,
  quantity numeric NOT NULL DEFAULT 1,
  received_quantity numeric NOT NULL DEFAULT 0,
  unit text,
  rate numeric NOT NULL DEFAULT 0,
  tax_rate numeric DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  sort_order int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_lines TO authenticated;
GRANT ALL ON public.purchase_order_lines TO service_role;
ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "po_lines_org_all" ON public.purchase_order_lines FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id()) WITH CHECK (org_id = public.get_user_org_id());

-- 4) Goods Receipt Notes (GRN)
CREATE TABLE IF NOT EXISTS public.grns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  po_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  grn_number text NOT NULL,
  grn_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'received',  -- received, billed, cancelled
  vehicle_number text,
  transporter text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grns TO authenticated;
GRANT ALL ON public.grns TO service_role;
ALTER TABLE public.grns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grn_org_all" ON public.grns FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id()) WITH CHECK (org_id = public.get_user_org_id());

CREATE TABLE IF NOT EXISTS public.grn_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id uuid NOT NULL REFERENCES public.grns(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  po_line_id uuid REFERENCES public.purchase_order_lines(id) ON DELETE SET NULL,
  item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  batch_no text,
  serial_no text,
  expiry_date date,
  amount numeric NOT NULL DEFAULT 0,
  sort_order int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grn_lines TO authenticated;
GRANT ALL ON public.grn_lines TO service_role;
ALTER TABLE public.grn_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grn_lines_org_all" ON public.grn_lines FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id()) WITH CHECK (org_id = public.get_user_org_id());

-- 5) Link bills to PO/GRN for 3-way match
ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS po_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS grn_id uuid REFERENCES public.grns(id) ON DELETE SET NULL;

-- 6) Delivery Challans
CREATE TABLE IF NOT EXISTS public.delivery_challans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  challan_number text NOT NULL,
  challan_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'draft',  -- draft, dispatched, delivered, cancelled
  vehicle_number text,
  transporter text,
  driver_name text,
  driver_phone text,
  eway_bill_number text,
  destination text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_challans TO authenticated;
GRANT ALL ON public.delivery_challans TO service_role;
ALTER TABLE public.delivery_challans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dc_org_all" ON public.delivery_challans FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id()) WITH CHECK (org_id = public.get_user_org_id());

CREATE TABLE IF NOT EXISTS public.delivery_challan_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dc_id uuid NOT NULL REFERENCES public.delivery_challans(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit text,
  batch_no text,
  serial_no text,
  sort_order int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_challan_lines TO authenticated;
GRANT ALL ON public.delivery_challan_lines TO service_role;
ALTER TABLE public.delivery_challan_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dc_lines_org_all" ON public.delivery_challan_lines FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id()) WITH CHECK (org_id = public.get_user_org_id());

-- 7) Update triggers
CREATE TRIGGER trg_po_updated BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_grn_updated BEFORE UPDATE ON public.grns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_dc_updated BEFORE UPDATE ON public.delivery_challans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8) Add counters to organizations for numbering
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS po_prefix text DEFAULT 'PO-',
  ADD COLUMN IF NOT EXISTS po_next_number int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS grn_prefix text DEFAULT 'GRN-',
  ADD COLUMN IF NOT EXISTS grn_next_number int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS dc_prefix text DEFAULT 'DC-',
  ADD COLUMN IF NOT EXISTS dc_next_number int DEFAULT 1;
