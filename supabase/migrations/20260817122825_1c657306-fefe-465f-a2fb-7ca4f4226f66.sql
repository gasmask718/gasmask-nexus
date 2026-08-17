-- 1. Explicit source -> pool map
CREATE TABLE public.sf_pool_map (
  lead_source text PRIMARY KEY,
  pool char(1) NOT NULL CHECK (pool IN ('A','B','C')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sf_pool_map TO authenticated;
GRANT ALL ON public.sf_pool_map TO service_role;

ALTER TABLE public.sf_pool_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read pool map"
  ON public.sf_pool_map FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Admins can manage pool map"
  ON public.sf_pool_map FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_sf_pool_map_updated_at
  BEFORE UPDATE ON public.sf_pool_map
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Seed from the classification already in the data (no existing row changes pool)
INSERT INTO public.sf_pool_map (lead_source, pool, notes)
SELECT lead_source, MIN(pool), 'seeded from existing classification 2026-08-17'
FROM public.surplus_funds_leads
WHERE lead_source IS NOT NULL AND pool IS NOT NULL
GROUP BY lead_source
HAVING COUNT(DISTINCT pool) = 1
ON CONFLICT (lead_source) DO NOTHING;

-- Non-scraper intake paths that exist in code but have no rows yet
INSERT INTO public.sf_pool_map (lead_source, pool, notes) VALUES
  ('dynasty_recovery_website', 'A', 'inbound claimant form'),
  ('csv_upload',               'A', 'manual operator upload'),
  ('csv_discovery',            'A', 'discovery page upload'),
  ('manual_upload',            'A', 'column default fallback')
ON CONFLICT (lead_source) DO NOTHING;

-- 3. Resolver: explicit map first, then state-aware keyword rule, else raise
CREATE OR REPLACE FUNCTION public.sf_resolve_pool(_lead_source text)
RETURNS char(1)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_pool char(1);
  v_src  text := lower(coalesce(_lead_source, ''));
  v_state text;
BEGIN
  SELECT pool INTO v_pool FROM public.sf_pool_map WHERE lead_source = _lead_source;
  IF v_pool IS NOT NULL THEN
    RETURN v_pool;
  END IF;

  v_state := substring(v_src from '^scraper_([a-z]{2})_');

  IF v_src LIKE '%escheat%' THEN
    RETURN 'C';
  END IF;

  -- Midwest/Mountain foreclosure-overage programs are pool B regardless of wording
  IF v_state IN ('oh','co','il','in','mi','mo','ks','ne','wi') THEN
    RETURN 'B';
  END IF;

  IF v_src LIKE '%foreclosure%' THEN
    RETURN 'B';
  END IF;

  IF v_src LIKE '%taxdeed%' OR v_src LIKE '%tax_deed%'
     OR v_src LIKE '%excess%' OR v_src LIKE '%overbid%' THEN
    RETURN 'A';
  END IF;

  RAISE EXCEPTION
    'Unclassified lead_source "%": no row in sf_pool_map and no pool rule matched. Add a mapping before ingesting this source.',
    _lead_source
    USING ERRCODE = '23514';
END;
$$;

-- 4. Set pool at ingest
CREATE OR REPLACE FUNCTION public.sf_set_pool_from_source()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.pool IS NULL THEN
    NEW.pool := public.sf_resolve_pool(NEW.lead_source);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sf_leads_set_pool
  BEFORE INSERT ON public.surplus_funds_leads
  FOR EACH ROW EXECUTE FUNCTION public.sf_set_pool_from_source();

-- 5. Backfill any remaining NULLs (Marion is tax deed = A), then lock the column
UPDATE public.surplus_funds_leads
SET pool = public.sf_resolve_pool(lead_source)
WHERE pool IS NULL AND lead_source IS NOT NULL;

UPDATE public.surplus_funds_leads SET pool = 'A' WHERE pool IS NULL;

ALTER TABLE public.surplus_funds_leads ALTER COLUMN pool SET NOT NULL;
ALTER TABLE public.surplus_funds_leads ALTER COLUMN pool DROP DEFAULT;