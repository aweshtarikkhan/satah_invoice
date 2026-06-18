
-- Extend employees with payroll fields
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS pan text,
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS bank_ifsc text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS basic_percent numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS hra_percent numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS pf_applicable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS esic_applicable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shift_id uuid;

-- Leave types enum
DO $$ BEGIN
  CREATE TYPE public.leave_type AS ENUM ('casual','sick','paid','unpaid','other');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE public.leave_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE public.payroll_status AS ENUM ('draft','approved','paid');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Leaves
CREATE TABLE IF NOT EXISTS public.leaves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type public.leave_type NOT NULL DEFAULT 'casual',
  start_date date NOT NULL,
  end_date date NOT NULL,
  days numeric NOT NULL DEFAULT 1,
  reason text,
  status public.leave_status NOT NULL DEFAULT 'pending',
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leaves TO authenticated;
GRANT ALL ON public.leaves TO service_role;
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leaves_org_select" ON public.leaves FOR SELECT TO authenticated USING (org_id = public.get_user_org_id());
CREATE POLICY "leaves_org_mod" ON public.leaves FOR ALL TO authenticated USING (org_id = public.get_user_org_id()) WITH CHECK (org_id = public.get_user_org_id());
CREATE TRIGGER trg_leaves_updated BEFORE UPDATE ON public.leaves FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Shifts
CREATE TABLE IF NOT EXISTS public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_time time NOT NULL DEFAULT '09:00',
  end_time time NOT NULL DEFAULT '18:00',
  working_days integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6],
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts TO authenticated;
GRANT ALL ON public.shifts TO service_role;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shifts_org_select" ON public.shifts FOR SELECT TO authenticated USING (org_id = public.get_user_org_id());
CREATE POLICY "shifts_org_mod" ON public.shifts FOR ALL TO authenticated USING (org_id = public.get_user_org_id()) WITH CHECK (org_id = public.get_user_org_id());
CREATE TRIGGER trg_shifts_updated BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Employee documents (metadata; files in storage)
CREATE TABLE IF NOT EXISTS public.employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  doc_type text NOT NULL DEFAULT 'other',
  file_path text NOT NULL,
  file_name text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_documents TO authenticated;
GRANT ALL ON public.employee_documents TO service_role;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "empdocs_org_select" ON public.employee_documents FOR SELECT TO authenticated USING (org_id = public.get_user_org_id());
CREATE POLICY "empdocs_org_mod" ON public.employee_documents FOR ALL TO authenticated USING (org_id = public.get_user_org_id()) WITH CHECK (org_id = public.get_user_org_id());

-- Payroll runs
CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_month date NOT NULL,
  status public.payroll_status NOT NULL DEFAULT 'draft',
  notes text,
  total_gross numeric NOT NULL DEFAULT 0,
  total_deductions numeric NOT NULL DEFAULT 0,
  total_net numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, period_month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_runs TO authenticated;
GRANT ALL ON public.payroll_runs TO service_role;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pr_org_select" ON public.payroll_runs FOR SELECT TO authenticated USING (org_id = public.get_user_org_id());
CREATE POLICY "pr_org_mod" ON public.payroll_runs FOR ALL TO authenticated USING (org_id = public.get_user_org_id()) WITH CHECK (org_id = public.get_user_org_id());
CREATE TRIGGER trg_pr_updated BEFORE UPDATE ON public.payroll_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Payslips
CREATE TABLE IF NOT EXISTS public.payslips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  working_days numeric NOT NULL DEFAULT 0,
  present_days numeric NOT NULL DEFAULT 0,
  paid_leave_days numeric NOT NULL DEFAULT 0,
  lop_days numeric NOT NULL DEFAULT 0,
  gross_salary numeric NOT NULL DEFAULT 0,
  basic numeric NOT NULL DEFAULT 0,
  hra numeric NOT NULL DEFAULT 0,
  allowances numeric NOT NULL DEFAULT 0,
  pf_employee numeric NOT NULL DEFAULT 0,
  esic_employee numeric NOT NULL DEFAULT 0,
  tds numeric NOT NULL DEFAULT 0,
  other_deductions numeric NOT NULL DEFAULT 0,
  net_pay numeric NOT NULL DEFAULT 0,
  payment_date date,
  payment_status text NOT NULL DEFAULT 'unpaid',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payslips TO authenticated;
GRANT ALL ON public.payslips TO service_role;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_org_select" ON public.payslips FOR SELECT TO authenticated USING (org_id = public.get_user_org_id());
CREATE POLICY "ps_org_mod" ON public.payslips FOR ALL TO authenticated USING (org_id = public.get_user_org_id()) WITH CHECK (org_id = public.get_user_org_id());
CREATE TRIGGER trg_ps_updated BEFORE UPDATE ON public.payslips FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
