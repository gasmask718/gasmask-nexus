CREATE TABLE IF NOT EXISTS public.dynasty_ai_calls_quarantine (
  LIKE public.dynasty_ai_calls INCLUDING DEFAULTS,
  quarantined_at timestamptz NOT NULL DEFAULT now(),
  quarantine_reason text NOT NULL DEFAULT 'comms-health-monitor liveness probe persisted as call row'
);

GRANT SELECT ON public.dynasty_ai_calls_quarantine TO authenticated;
GRANT ALL ON public.dynasty_ai_calls_quarantine TO service_role;
ALTER TABLE public.dynasty_ai_calls_quarantine ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read quarantined probe rows" ON public.dynasty_ai_calls_quarantine;
CREATE POLICY "Authenticated can read quarantined probe rows"
  ON public.dynasty_ai_calls_quarantine FOR SELECT TO authenticated USING (true);

WITH moved AS (
  DELETE FROM public.dynasty_ai_calls d
  WHERE d.call_id ~ '^health_[0-9]{10,}$'
    AND NOT EXISTS (SELECT 1 FROM public.dynasty_call_analysis a WHERE a.call_id = d.call_id)
    AND NOT EXISTS (SELECT 1 FROM public.dynasty_lead_pipeline p WHERE p.call_id = d.call_id)
  RETURNING d.*
)
INSERT INTO public.dynasty_ai_calls_quarantine
SELECT m.*, now(), 'comms-health-monitor liveness probe persisted as call row'
FROM moved m;

CREATE INDEX IF NOT EXISTS idx_dynasty_ai_calls_quarantine_created
  ON public.dynasty_ai_calls_quarantine (created_at);