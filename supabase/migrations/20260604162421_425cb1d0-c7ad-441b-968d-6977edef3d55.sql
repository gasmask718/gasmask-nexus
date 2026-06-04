
-- T6-B1: HR-REAL schema additions

-- 1. Add source tracking columns to hr_employees
ALTER TABLE public.hr_employees
  ADD COLUMN IF NOT EXISTS source_table text,
  ADD COLUMN IF NOT EXISTS source_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_hr_employees_source
  ON public.hr_employees(source_table, source_id)
  WHERE source_table IS NOT NULL AND source_id IS NOT NULL;

-- 2. hr_employee_links — secondary role memberships for multi-role people
CREATE TABLE IF NOT EXISTS public.hr_employee_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  matched_via text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_table, source_id)
);

GRANT SELECT ON public.hr_employee_links TO authenticated;
GRANT ALL ON public.hr_employee_links TO service_role;

ALTER TABLE public.hr_employee_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage hr_employee_links" ON public.hr_employee_links
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees view own links" ON public.hr_employee_links
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.hr_employees e WHERE e.id = employee_id AND e.user_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE INDEX IF NOT EXISTS idx_hr_employee_links_employee ON public.hr_employee_links(employee_id);

-- 3. payroll_records canonical link to hr_employees
ALTER TABLE public.payroll_records
  ADD COLUMN IF NOT EXISTS hr_employee_id uuid REFERENCES public.hr_employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payroll_records_hr_employee ON public.payroll_records(hr_employee_id);

-- 4. Deprecate hr_payroll (K6 — killed third payroll system)
COMMENT ON TABLE public.hr_payroll IS 'DEPRECATED (K6): use payroll_records as canonical. Do not write new rows here. Kept for legacy read compatibility only.';

-- 5. Import dedupe stats table (for proof + idempotency)
CREATE TABLE IF NOT EXISTS public.hr_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz NOT NULL DEFAULT now(),
  stats jsonb NOT NULL DEFAULT '{}'::jsonb
);

GRANT SELECT ON public.hr_import_runs TO authenticated;
GRANT ALL ON public.hr_import_runs TO service_role;
ALTER TABLE public.hr_import_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage hr_import_runs" ON public.hr_import_runs
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
