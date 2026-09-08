CREATE TABLE IF NOT EXISTS public.icw_webhook_config (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.icw_webhook_config FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.icw_webhook_config TO service_role;

ALTER TABLE public.icw_webhook_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role only" ON public.icw_webhook_config
  FOR ALL TO service_role USING (true) WITH CHECK (true);