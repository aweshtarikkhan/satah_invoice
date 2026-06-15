
-- Employees table
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  employee_code text,
  designation text,
  phone text,
  email text,
  joining_date date,
  monthly_salary numeric(14,2) NOT NULL DEFAULT 0,
  paid_leaves_per_month numeric(5,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees: org members read"
  ON public.employees FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id());
CREATE POLICY "Employees: org members write"
  ON public.employees FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id())
  WITH CHECK (org_id = public.get_user_org_id());

CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_employees_org ON public.employees(org_id);

-- Attendance status enum
CREATE TYPE public.attendance_status AS ENUM ('present','absent','half_day','paid_leave','holiday');

-- Attendance table
CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  status public.attendance_status NOT NULL DEFAULT 'present',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, attendance_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attendance: org members read"
  ON public.attendance FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id());
CREATE POLICY "Attendance: org members write"
  ON public.attendance FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id())
  WITH CHECK (org_id = public.get_user_org_id());

CREATE TRIGGER trg_attendance_updated_at
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_attendance_org_date ON public.attendance(org_id, attendance_date);
CREATE INDEX idx_attendance_employee_date ON public.attendance(employee_id, attendance_date);
