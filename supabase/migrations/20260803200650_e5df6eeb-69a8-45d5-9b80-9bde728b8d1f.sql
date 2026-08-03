CREATE TABLE IF NOT EXISTS public.vault_secret_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  taken_at timestamptz NOT NULL DEFAULT now(),
  trigger_source text NOT NULL DEFAULT 'cron',
  secret_count integer NOT NULL DEFAULT 0,
  -- names only + a salted fingerprint of the value. NEVER stores secret values.
  secrets jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.vault_secret_snapshots TO authenticated;
GRANT ALL ON public.vault_secret_snapshots TO service_role;

ALTER TABLE public.vault_secret_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read vault snapshots"
ON public.vault_secret_snapshots FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE INDEX IF NOT EXISTS idx_vault_secret_snapshots_taken_at ON public.vault_secret_snapshots (taken_at DESC);

-- Diff two snapshots (or the two bracketing a pair of timestamps)
CREATE OR REPLACE FUNCTION public.diff_vault_snapshots(p_from timestamptz, p_to timestamptz DEFAULT now())
RETURNS TABLE(secret_name text, change text, from_snapshot timestamptz, to_snapshot timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  a public.vault_secret_snapshots;
  b public.vault_secret_snapshots;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner')) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT * INTO a FROM public.vault_secret_snapshots WHERE taken_at <= p_from ORDER BY taken_at DESC LIMIT 1;
  IF a IS NULL THEN
    SELECT * INTO a FROM public.vault_secret_snapshots ORDER BY taken_at ASC LIMIT 1;
  END IF;
  SELECT * INTO b FROM public.vault_secret_snapshots WHERE taken_at <= p_to ORDER BY taken_at DESC LIMIT 1;

  IF a IS NULL OR b IS NULL OR a.id = b.id THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH sa AS (SELECT x->>'name' AS n, x->>'fingerprint' AS f FROM jsonb_array_elements(a.secrets) x),
       sb AS (SELECT x->>'name' AS n, x->>'fingerprint' AS f FROM jsonb_array_elements(b.secrets) x)
  SELECT COALESCE(sa.n, sb.n)::text,
         CASE
           WHEN sa.n IS NULL THEN 'added'
           WHEN sb.n IS NULL THEN 'deleted'
           WHEN sa.f IS DISTINCT FROM sb.f THEN 'rotated'
           ELSE 'unchanged'
         END::text,
         a.taken_at, b.taken_at
  FROM sa FULL OUTER JOIN sb ON sa.n = sb.n
  WHERE sa.n IS NULL OR sb.n IS NULL OR sa.f IS DISTINCT FROM sb.f
  ORDER BY 1;
END;
$$;