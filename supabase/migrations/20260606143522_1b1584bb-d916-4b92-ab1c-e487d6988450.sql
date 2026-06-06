
-- Neighborhood lockdowns
CREATE TABLE IF NOT EXISTS public.neighborhood_lockdowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood_name text NOT NULL UNIQUE,
  started_at timestamptz NOT NULL DEFAULT now(),
  started_by uuid,
  cleared_at timestamptz,
  baseline_have integer DEFAULT 0,
  baseline_total integer DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.neighborhood_lockdowns TO authenticated;
GRANT ALL ON public.neighborhood_lockdowns TO service_role;
ALTER TABLE public.neighborhood_lockdowns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view lockdowns" ON public.neighborhood_lockdowns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage lockdowns" ON public.neighborhood_lockdowns FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tokenized signup links binding new users to existing store_master rows
CREATE TABLE IF NOT EXISTS public.store_signup_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  store_id uuid NOT NULL,
  store_name text,
  phone text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  used_at timestamptz,
  used_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_store_signup_tokens_store ON public.store_signup_tokens(store_id);
GRANT SELECT ON public.store_signup_tokens TO anon;
GRANT SELECT, INSERT, UPDATE ON public.store_signup_tokens TO authenticated;
GRANT ALL ON public.store_signup_tokens TO service_role;
ALTER TABLE public.store_signup_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read token by exact match" ON public.store_signup_tokens FOR SELECT USING (true);
CREATE POLICY "Authenticated can mark used" ON public.store_signup_tokens FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
