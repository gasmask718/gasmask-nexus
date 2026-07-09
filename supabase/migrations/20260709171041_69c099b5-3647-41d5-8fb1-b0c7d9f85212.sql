CREATE TABLE IF NOT EXISTS public.dd_ai_config (
  id int PRIMARY KEY DEFAULT 1,
  anthropic_api_key text NOT NULL,
  CHECK (id = 1)
);

GRANT ALL ON public.dd_ai_config TO service_role;

ALTER TABLE public.dd_ai_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage DD AI config" ON public.dd_ai_config;
CREATE POLICY "Service role can manage DD AI config"
ON public.dd_ai_config
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);