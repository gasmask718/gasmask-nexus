
CREATE TABLE IF NOT EXISTS public.qa_probe_results (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label      text NOT NULL,
  result     jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.qa_probe_results TO authenticated;
GRANT ALL ON public.qa_probe_results TO service_role;
ALTER TABLE public.qa_probe_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY qpr_staff_read ON public.qa_probe_results
  FOR SELECT TO authenticated USING (public.is_funding_staff(auth.uid()));
CREATE POLICY qpr_service_all ON public.qa_probe_results
  FOR ALL TO service_role USING (true) WITH CHECK (true);
