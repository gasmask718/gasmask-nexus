CREATE TABLE IF NOT EXISTS public.dd_error_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  severity text NOT NULL DEFAULT 'error',
  message text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  alerted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.dd_error_log TO authenticated;
GRANT ALL ON public.dd_error_log TO service_role;

ALTER TABLE public.dd_error_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read dd_error_log" ON public.dd_error_log;
CREATE POLICY "staff read dd_error_log" ON public.dd_error_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "service write dd_error_log" ON public.dd_error_log;
CREATE POLICY "service write dd_error_log" ON public.dd_error_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_dd_error_log_source_created ON public.dd_error_log (source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dd_error_log_created ON public.dd_error_log (created_at DESC);

INSERT INTO public.health_checks (check_key, kind, business, floor, label, cadence_expected_minutes, config, enabled)
VALUES
 ('function.dd_create_checkout', 'function', 'Dynasty Direct', 'Commerce', 'Checkout — dd-create-checkout reachable', 10,
  '{"function":"dd-create-checkout","probe_body":{"healthcheck":true},"max_status":499}'::jsonb, true),
 ('function.dd_auto_price', 'function', 'Dynasty Direct', 'Commerce', 'Pricing — dd-auto-price reachable', 10,
  '{"function":"dd-auto-price","probe_body":{"healthcheck":true},"max_status":499}'::jsonb, true),
 ('function.dd_generate_description', 'function', 'Dynasty Direct', 'Commerce', 'Copywriter — dd-generate-description reachable', 10,
  '{"function":"dd-generate-description","probe_body":{"healthcheck":true},"max_status":499}'::jsonb, true),
 ('function.dd_log_error', 'function', 'Dynasty Direct', 'Commerce', 'Product save reporter — dd-log-error reachable', 10,
  '{"function":"dd-log-error","probe_body":{"healthcheck":true},"max_status":499,"expect_status":400}'::jsonb, true),
 ('canary.dd_error_spike', 'data_canary', 'Dynasty Direct', 'Commerce', 'DD error spike (last 60m)', 15,
  '{"threshold":3,"minutes":60}'::jsonb, true)
ON CONFLICT (check_key) DO UPDATE
  SET kind = EXCLUDED.kind,
      business = EXCLUDED.business,
      floor = EXCLUDED.floor,
      label = EXCLUDED.label,
      cadence_expected_minutes = EXCLUDED.cadence_expected_minutes,
      config = EXCLUDED.config,
      enabled = true;