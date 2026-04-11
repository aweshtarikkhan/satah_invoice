
-- Add category and stock tracking to items
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS category text DEFAULT NULL;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS stock_quantity numeric NOT NULL DEFAULT 0;

-- Add tags and credit limit to clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS credit_limit numeric NOT NULL DEFAULT 0;

-- Create recurring invoices table
CREATE TABLE public.recurring_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  frequency text NOT NULL DEFAULT 'monthly',
  next_run_date date NOT NULL DEFAULT CURRENT_DATE,
  template_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  currency_code text NOT NULL DEFAULT 'USD',
  notes text,
  last_generated_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage recurring invoices in their org"
  ON public.recurring_invoices FOR ALL TO authenticated
  USING (org_id = get_user_org_id())
  WITH CHECK (org_id = get_user_org_id());

CREATE POLICY "Users can view recurring invoices in their org"
  ON public.recurring_invoices FOR SELECT TO authenticated
  USING (org_id = get_user_org_id());

CREATE TRIGGER update_recurring_invoices_updated_at
  BEFORE UPDATE ON public.recurring_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
