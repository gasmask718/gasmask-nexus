
CREATE TABLE IF NOT EXISTS public.pipeline_health_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  success boolean NOT NULL,
  failure_point text,
  steps jsonb DEFAULT '{}',
  alert_sent boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pipeline_health_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on pipeline_health_logs"
  ON public.pipeline_health_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated read pipeline_health_logs"
  ON public.pipeline_health_logs
  FOR SELECT
  TO authenticated
  USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_health_logs;
