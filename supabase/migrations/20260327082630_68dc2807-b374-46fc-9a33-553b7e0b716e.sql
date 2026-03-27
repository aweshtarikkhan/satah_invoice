
-- Audit logs table
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  user_id UUID NOT NULL,
  entity_type TEXT NOT NULL, -- 'invoice', 'client', 'payment', 'estimate', 'credit_note', 'item', 'settings'
  entity_id UUID,
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'void', 'send', 'payment_recorded', 'status_change'
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_org ON public.audit_logs(org_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit logs in their org" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (org_id = get_user_org_id());

CREATE POLICY "Users can insert audit logs in their org" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (org_id = get_user_org_id());

-- Custom field definitions
CREATE TABLE public.custom_field_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  entity_type TEXT NOT NULL, -- 'invoice', 'client', 'item', 'estimate', 'credit_note'
  field_name TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text', -- 'text', 'number', 'date', 'dropdown', 'checkbox'
  field_options JSONB, -- for dropdown: ["opt1", "opt2"]
  is_required BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, entity_type, field_name)
);

ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage custom field defs in their org" ON public.custom_field_definitions
  FOR ALL TO authenticated
  USING (org_id = get_user_org_id())
  WITH CHECK (org_id = get_user_org_id());

-- Custom field values
CREATE TABLE public.custom_field_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  field_id UUID NOT NULL REFERENCES public.custom_field_definitions(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(field_id, entity_id)
);

ALTER TABLE public.custom_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage custom field values" ON public.custom_field_values
  FOR ALL TO authenticated
  USING (field_id IN (SELECT id FROM custom_field_definitions WHERE org_id = get_user_org_id()))
  WITH CHECK (field_id IN (SELECT id FROM custom_field_definitions WHERE org_id = get_user_org_id()));

CREATE POLICY "Users can view custom field values" ON public.custom_field_values
  FOR SELECT TO authenticated
  USING (field_id IN (SELECT id FROM custom_field_definitions WHERE org_id = get_user_org_id()));
