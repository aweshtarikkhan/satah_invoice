
DO $$ BEGIN
  CREATE TYPE public.lead_status AS ENUM ('new','contacted','qualified','converted','lost');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE public.activity_type AS ENUM ('call','meeting','email','note','task','whatsapp');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Pipeline stages
CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  win_probability numeric NOT NULL DEFAULT 0,
  is_won boolean NOT NULL DEFAULT false,
  is_lost boolean NOT NULL DEFAULT false,
  color text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_stages TO authenticated;
GRANT ALL ON public.pipeline_stages TO service_role;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_org_sel" ON public.pipeline_stages FOR SELECT TO authenticated USING (org_id = public.get_user_org_id());
CREATE POLICY "ps_org_mod" ON public.pipeline_stages FOR ALL TO authenticated USING (org_id = public.get_user_org_id()) WITH CHECK (org_id = public.get_user_org_id());

-- Leads
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  company text,
  email text,
  phone text,
  source text,
  status public.lead_status NOT NULL DEFAULT 'new',
  estimated_value numeric NOT NULL DEFAULT 0,
  owner_id uuid,
  notes text,
  converted_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads_org_sel" ON public.leads FOR SELECT TO authenticated USING (org_id = public.get_user_org_id());
CREATE POLICY "leads_org_mod" ON public.leads FOR ALL TO authenticated USING (org_id = public.get_user_org_id()) WITH CHECK (org_id = public.get_user_org_id());
CREATE TRIGGER trg_leads_upd BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Opportunities (deals)
CREATE TABLE IF NOT EXISTS public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  stage_id uuid REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  expected_close_date date,
  probability numeric NOT NULL DEFAULT 0,
  owner_id uuid,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunities TO authenticated;
GRANT ALL ON public.opportunities TO service_role;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "opp_org_sel" ON public.opportunities FOR SELECT TO authenticated USING (org_id = public.get_user_org_id());
CREATE POLICY "opp_org_mod" ON public.opportunities FOR ALL TO authenticated USING (org_id = public.get_user_org_id()) WITH CHECK (org_id = public.get_user_org_id());
CREATE TRIGGER trg_opp_upd BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Activities (calls/meetings/notes/tasks)
CREATE TABLE IF NOT EXISTS public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  activity_type public.activity_type NOT NULL DEFAULT 'note',
  subject text NOT NULL,
  body text,
  due_at timestamptz,
  completed_at timestamptz,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  owner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activities TO authenticated;
GRANT ALL ON public.activities TO service_role;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "act_org_sel" ON public.activities FOR SELECT TO authenticated USING (org_id = public.get_user_org_id());
CREATE POLICY "act_org_mod" ON public.activities FOR ALL TO authenticated USING (org_id = public.get_user_org_id()) WITH CHECK (org_id = public.get_user_org_id());
CREATE TRIGGER trg_act_upd BEFORE UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default pipeline stages function
CREATE OR REPLACE FUNCTION public.seed_default_pipeline(p_org_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM pipeline_stages WHERE org_id = p_org_id) THEN RETURN; END IF;
  INSERT INTO pipeline_stages(org_id, name, sort_order, win_probability, is_won, is_lost, color) VALUES
    (p_org_id, 'Prospecting',    10, 10,  false, false, '#94a3b8'),
    (p_org_id, 'Qualification',  20, 25,  false, false, '#60a5fa'),
    (p_org_id, 'Proposal',       30, 50,  false, false, '#a78bfa'),
    (p_org_id, 'Negotiation',    40, 75,  false, false, '#f59e0b'),
    (p_org_id, 'Won',            50, 100, true,  false, '#10b981'),
    (p_org_id, 'Lost',            60, 0,  false, true,  '#ef4444');
END; $$;
REVOKE EXECUTE ON FUNCTION public.seed_default_pipeline(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_default_pipeline(uuid) TO authenticated, service_role;
