
-- Log table for daily Twilio webhook re-assertion runs
CREATE TABLE IF NOT EXISTS public.dc_webhook_assertion_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  total INT NOT NULL,
  configured INT NOT NULL,
  failed INT NOT NULL,
  excluded_brandaro INT NOT NULL DEFAULT 0,
  failures JSONB NOT NULL DEFAULT '[]'::jsonb,
  has_credential_issue BOOLEAN NOT NULL DEFAULT false,
  triggered_by TEXT NOT NULL DEFAULT 'cron'
);

GRANT SELECT ON public.dc_webhook_assertion_log TO authenticated;
GRANT ALL ON public.dc_webhook_assertion_log TO service_role;

ALTER TABLE public.dc_webhook_assertion_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook assertion log"
  ON public.dc_webhook_assertion_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_dc_webhook_log_ran_at
  ON public.dc_webhook_assertion_log (ran_at DESC);
CREATE INDEX IF NOT EXISTS idx_dc_webhook_log_failed
  ON public.dc_webhook_assertion_log (failed) WHERE failed > 0;
