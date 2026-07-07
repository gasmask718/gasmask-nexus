CREATE TABLE IF NOT EXISTS public.make_automation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_name text,
  trigger_type text,
  payload jsonb,
  result jsonb,
  status text DEFAULT 'success',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.make_automation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY mal_service ON public.make_automation_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY mal_auth ON public.make_automation_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);