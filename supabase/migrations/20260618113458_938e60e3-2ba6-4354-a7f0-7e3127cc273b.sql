
-- =========================
-- PHASE 11: MARKETING AUTOMATION
-- =========================

-- Message Templates (WhatsApp / SMS / Email)
CREATE TABLE public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp','sms','email')),
  category text DEFAULT 'marketing',
  subject text,
  body text NOT NULL,
  variables jsonb DEFAULT '[]'::jsonb,
  -- WhatsApp Cloud API specifics
  wa_template_name text,
  wa_language text DEFAULT 'en',
  wa_approved boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members read templates" ON public.message_templates FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id());
CREATE POLICY "Org members manage templates" ON public.message_templates FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id()) WITH CHECK (org_id = public.get_user_org_id());
CREATE TRIGGER trg_message_templates_updated BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Campaigns
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp','sms','email')),
  template_id uuid REFERENCES public.message_templates(id) ON DELETE SET NULL,
  audience_type text NOT NULL DEFAULT 'all' CHECK (audience_type IN ('all','tag','manual','overdue')),
  audience_filter jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','completed','failed')),
  scheduled_at timestamptz,
  sent_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  total_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members read campaigns" ON public.campaigns FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id());
CREATE POLICY "Org members manage campaigns" ON public.campaigns FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id()) WITH CHECK (org_id = public.get_user_org_id());
CREATE TRIGGER trg_campaigns_updated BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Campaign Recipients
CREATE TABLE public.campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  name text,
  to_address text NOT NULL,
  vars jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
  provider_message_id text,
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_recipients TO authenticated;
GRANT ALL ON public.campaign_recipients TO service_role;
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members read recipients" ON public.campaign_recipients FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id());
CREATE POLICY "Org members manage recipients" ON public.campaign_recipients FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id()) WITH CHECK (org_id = public.get_user_org_id());
CREATE INDEX idx_campaign_recipients_campaign ON public.campaign_recipients(campaign_id);

-- Journeys
CREATE TABLE public.journeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL CHECK (trigger_type IN (
    'invoice_sent','invoice_overdue','invoice_paid','estimate_sent','client_created','manual'
  )),
  trigger_config jsonb DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journeys TO authenticated;
GRANT ALL ON public.journeys TO service_role;
ALTER TABLE public.journeys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members read journeys" ON public.journeys FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id());
CREATE POLICY "Org members manage journeys" ON public.journeys FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id()) WITH CHECK (org_id = public.get_user_org_id());
CREATE TRIGGER trg_journeys_updated BEFORE UPDATE ON public.journeys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Journey Steps
CREATE TABLE public.journey_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES public.journeys(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  step_type text NOT NULL CHECK (step_type IN ('send_message','wait')),
  channel text CHECK (channel IN ('whatsapp','sms','email')),
  template_id uuid REFERENCES public.message_templates(id) ON DELETE SET NULL,
  wait_hours int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journey_steps TO authenticated;
GRANT ALL ON public.journey_steps TO service_role;
ALTER TABLE public.journey_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members read journey_steps" ON public.journey_steps FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id());
CREATE POLICY "Org members manage journey_steps" ON public.journey_steps FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id()) WITH CHECK (org_id = public.get_user_org_id());

-- Journey Enrollments
CREATE TABLE public.journey_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES public.journeys(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  entity_type text,
  entity_id uuid,
  current_step int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled','failed')),
  next_run_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journey_enrollments TO authenticated;
GRANT ALL ON public.journey_enrollments TO service_role;
ALTER TABLE public.journey_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members read enrollments" ON public.journey_enrollments FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id());
CREATE POLICY "Org members manage enrollments" ON public.journey_enrollments FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id()) WITH CHECK (org_id = public.get_user_org_id());
CREATE INDEX idx_journey_enrollments_next_run ON public.journey_enrollments(next_run_at) WHERE status = 'active';

-- Message Logs (all outbound sends)
CREATE TABLE public.message_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('whatsapp','sms','email')),
  to_address text NOT NULL,
  template_id uuid REFERENCES public.message_templates(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  journey_id uuid REFERENCES public.journeys(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  body text,
  status text NOT NULL CHECK (status IN ('sent','failed','queued','delivered','read')),
  provider_message_id text,
  error text,
  sent_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_logs TO authenticated;
GRANT ALL ON public.message_logs TO service_role;
ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members read logs" ON public.message_logs FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id());
CREATE POLICY "Org members insert logs" ON public.message_logs FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id());
CREATE INDEX idx_message_logs_org_sent ON public.message_logs(org_id, sent_at DESC);
