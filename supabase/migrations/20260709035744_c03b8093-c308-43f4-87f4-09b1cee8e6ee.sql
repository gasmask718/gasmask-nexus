CREATE TABLE public.uben_sync_config (
  id int PRIMARY KEY DEFAULT 1,
  api_key text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (id = 1)
);

GRANT ALL ON public.uben_sync_config TO service_role;

ALTER TABLE public.uben_sync_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only_uben_sync_config"
  ON public.uben_sync_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);