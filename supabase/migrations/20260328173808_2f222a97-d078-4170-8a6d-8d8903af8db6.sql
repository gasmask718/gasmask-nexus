
CREATE TABLE public.sbo_function_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  records_processed INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER
);

ALTER TABLE public.sbo_function_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read function logs"
  ON public.sbo_function_logs FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Service role can insert function logs"
  ON public.sbo_function_logs FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Service role can update function logs"
  ON public.sbo_function_logs FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_sbo_function_logs_name_started ON public.sbo_function_logs(function_name, started_at DESC);
