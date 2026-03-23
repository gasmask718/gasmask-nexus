
ALTER TABLE public.sbo_sms_recipients
ADD COLUMN IF NOT EXISTS auto_send boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS public.sbo_automation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz,
  completed_at timestamptz,
  steps jsonb,
  errors jsonb,
  status text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.sbo_automation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to sbo_automation_log" ON public.sbo_automation_log
  FOR ALL USING (true) WITH CHECK (true);
