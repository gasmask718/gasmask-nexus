
CREATE TABLE IF NOT EXISTS public.comms_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer TEXT NOT NULL CHECK (layer IN ('credentials','webhook_config','function_deployment','a2p_sending','signature_verify','synthetic_loop')),
  provider TEXT NOT NULL DEFAULT 'twilio',
  target TEXT NOT NULL,            -- e.g. phone number, function name, service SID, "account"
  status TEXT NOT NULL CHECK (status IN ('pass','warn','fail')),
  message TEXT,                    -- human reason when not pass
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comms_health_layer_target_time
  ON public.comms_health_checks (layer, target, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comms_health_status_time
  ON public.comms_health_checks (status, created_at DESC);

GRANT SELECT ON public.comms_health_checks TO authenticated;
GRANT ALL ON public.comms_health_checks TO service_role;

ALTER TABLE public.comms_health_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view health checks" ON public.comms_health_checks;
CREATE POLICY "Authenticated can view health checks"
  ON public.comms_health_checks FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE VIEW public.v_comms_health_latest AS
SELECT DISTINCT ON (layer, provider, target)
  layer, provider, target, status, message, detail, created_at
FROM public.comms_health_checks
ORDER BY layer, provider, target, created_at DESC;

GRANT SELECT ON public.v_comms_health_latest TO authenticated;
