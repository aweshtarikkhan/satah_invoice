
-- =============================================
-- Invoice Management App - Core Schema
-- =============================================

-- Enum types
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'staff', 'read_only');
CREATE TYPE public.client_status AS ENUM ('active', 'inactive');
CREATE TYPE public.item_type AS ENUM ('service', 'product');
CREATE TYPE public.tax_type AS ENUM ('simple', 'compound');
CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'void');
CREATE TYPE public.discount_type AS ENUM ('percentage', 'fixed');

-- =============================================
-- Updated_at trigger function
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =============================================
-- Organizations
-- =============================================
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  address JSONB DEFAULT '{}'::jsonb,
  phone TEXT,
  email TEXT,
  website TEXT,
  tax_number TEXT,
  tax_name TEXT,
  currency_code TEXT NOT NULL DEFAULT 'USD',
  date_format TEXT NOT NULL DEFAULT 'MM/DD/YYYY',
  fiscal_year_start INT NOT NULL DEFAULT 1,
  invoice_prefix TEXT NOT NULL DEFAULT 'INV',
  invoice_next_number INT NOT NULL DEFAULT 1,
  estimate_prefix TEXT NOT NULL DEFAULT 'EST',
  payment_prefix TEXT NOT NULL DEFAULT 'PAY',
  payment_terms INT NOT NULL DEFAULT 30,
  default_notes TEXT,
  default_terms TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Profiles (linked to auth.users)
-- =============================================
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- User Roles (separate table as required)
-- =============================================
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'staff',
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- =============================================
-- Tax Rates
-- =============================================
CREATE TABLE public.tax_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rate NUMERIC(10,4) NOT NULL,
  type tax_type NOT NULL DEFAULT 'simple',
  components JSONB,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Clients
-- =============================================
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  company_name TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  website TEXT,
  billing_address JSONB DEFAULT '{}'::jsonb,
  shipping_address JSONB,
  tax_number TEXT,
  currency_code TEXT,
  payment_terms INT,
  notes TEXT,
  status client_status NOT NULL DEFAULT 'active',
  opening_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_clients_org_id ON public.clients(org_id);

-- =============================================
-- Contacts (multiple per client)
-- =============================================
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Items / Products
-- =============================================
CREATE TABLE public.items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  type item_type NOT NULL DEFAULT 'service',
  unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  unit TEXT,
  tax_id UUID REFERENCES public.tax_rates(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_items_updated_at
  BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_items_org_id ON public.items(org_id);

-- =============================================
-- Invoices
-- =============================================
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL,
  reference_number TEXT,
  status invoice_status NOT NULL DEFAULT 'draft',
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days')::date,
  currency_code TEXT NOT NULL DEFAULT 'USD',
  exchange_rate NUMERIC(15,6) NOT NULL DEFAULT 1,
  discount NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_type discount_type NOT NULL DEFAULT 'percentage',
  shipping_charge NUMERIC(15,2) NOT NULL DEFAULT 0,
  adjustment NUMERIC(15,2) NOT NULL DEFAULT 0,
  adjustment_name TEXT,
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_tax NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_discount NUMERIC(15,2) NOT NULL DEFAULT 0,
  total NUMERIC(15,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(15,2) NOT NULL DEFAULT 0,
  balance_due NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes TEXT,
  terms_conditions TEXT,
  billing_address JSONB DEFAULT '{}'::jsonb,
  shipping_address JSONB,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, invoice_number)
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_invoices_org_id ON public.invoices(org_id);
CREATE INDEX idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_due_date ON public.invoices(due_date);

-- =============================================
-- Invoice Lines
-- =============================================
CREATE TABLE public.invoice_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC(15,4) NOT NULL DEFAULT 1,
  unit TEXT,
  rate NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_type discount_type NOT NULL DEFAULT 'percentage',
  tax_id UUID REFERENCES public.tax_rates(id) ON DELETE SET NULL,
  tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0
);

ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_invoice_lines_invoice_id ON public.invoice_lines(invoice_id);

-- =============================================
-- Payments
-- =============================================
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  payment_number TEXT NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(15,2) NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'USD',
  payment_mode TEXT NOT NULL DEFAULT 'bank_transfer',
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, payment_number)
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_payments_org_id ON public.payments(org_id);
CREATE INDEX idx_payments_invoice_id ON public.payments(invoice_id);

-- =============================================
-- RLS Policies
-- =============================================

-- Helper: get user's org_id
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
$$;

-- Organizations
CREATE POLICY "Users can view their org" ON public.organizations
  FOR SELECT TO authenticated
  USING (id = public.get_user_org_id());

CREATE POLICY "Owners/admins can update their org" ON public.organizations
  FOR UPDATE TO authenticated
  USING (id = public.get_user_org_id())
  WITH CHECK (id = public.get_user_org_id());

CREATE POLICY "Authenticated users can create orgs" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Profiles
CREATE POLICY "Users can view profiles in their org" ON public.profiles
  FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id() OR user_id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- User Roles
CREATE POLICY "Users can view roles in their org" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT user_id FROM public.profiles WHERE org_id = public.get_user_org_id()));

CREATE POLICY "Owners can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Tax Rates
CREATE POLICY "Users can view tax rates in their org" ON public.tax_rates
  FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id());

CREATE POLICY "Users can manage tax rates in their org" ON public.tax_rates
  FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id())
  WITH CHECK (org_id = public.get_user_org_id());

-- Clients
CREATE POLICY "Users can view clients in their org" ON public.clients
  FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id());

CREATE POLICY "Users can manage clients in their org" ON public.clients
  FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id())
  WITH CHECK (org_id = public.get_user_org_id());

-- Contacts
CREATE POLICY "Users can view contacts via client" ON public.contacts
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE org_id = public.get_user_org_id()));

CREATE POLICY "Users can manage contacts via client" ON public.contacts
  FOR ALL TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE org_id = public.get_user_org_id()))
  WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE org_id = public.get_user_org_id()));

-- Items
CREATE POLICY "Users can view items in their org" ON public.items
  FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id());

CREATE POLICY "Users can manage items in their org" ON public.items
  FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id())
  WITH CHECK (org_id = public.get_user_org_id());

-- Invoices
CREATE POLICY "Users can view invoices in their org" ON public.invoices
  FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id());

CREATE POLICY "Users can manage invoices in their org" ON public.invoices
  FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id())
  WITH CHECK (org_id = public.get_user_org_id());

-- Invoice Lines
CREATE POLICY "Users can view invoice lines" ON public.invoice_lines
  FOR SELECT TO authenticated
  USING (invoice_id IN (SELECT id FROM public.invoices WHERE org_id = public.get_user_org_id()));

CREATE POLICY "Users can manage invoice lines" ON public.invoice_lines
  FOR ALL TO authenticated
  USING (invoice_id IN (SELECT id FROM public.invoices WHERE org_id = public.get_user_org_id()))
  WITH CHECK (invoice_id IN (SELECT id FROM public.invoices WHERE org_id = public.get_user_org_id()));

-- Payments
CREATE POLICY "Users can view payments in their org" ON public.payments
  FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id());

CREATE POLICY "Users can manage payments in their org" ON public.payments
  FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id())
  WITH CHECK (org_id = public.get_user_org_id());
