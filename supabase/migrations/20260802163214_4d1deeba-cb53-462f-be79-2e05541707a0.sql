CREATE TABLE IF NOT EXISTS public.public_view_security_probes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'green',
  views_checked text[] NOT NULL DEFAULT '{}',
  probe_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  grant_violations jsonb NOT NULL DEFAULT '[]'::jsonb,
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.public_view_security_probes TO authenticated;
GRANT ALL ON public.public_view_security_probes TO service_role;
ALTER TABLE public.public_view_security_probes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read view security probes" ON public.public_view_security_probes;
CREATE POLICY "Staff can read view security probes"
ON public.public_view_security_probes FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_public_view_security_probes_ran_at
  ON public.public_view_security_probes (ran_at DESC);

DROP TRIGGER IF EXISTS trg_public_view_security_probes_updated_at ON public.public_view_security_probes;
CREATE TRIGGER trg_public_view_security_probes_updated_at
BEFORE UPDATE ON public.public_view_security_probes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.public_view_security_probes IS
'Daily security regression test results for public-facing views. Written by the public-view-security-probe edge function; a red row means anon writes succeeded or grants drifted off contract.';