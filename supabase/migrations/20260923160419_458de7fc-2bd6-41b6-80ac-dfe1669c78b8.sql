-- 1) Reviewable alias map: discovery city label -> canonical borough/city label.
CREATE TABLE IF NOT EXISTS public.territory_label_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias_label text NOT NULL,
  canonical_label text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS territory_label_aliases_alias_key
  ON public.territory_label_aliases (lower(btrim(alias_label)));

GRANT SELECT ON public.territory_label_aliases TO authenticated;
GRANT ALL ON public.territory_label_aliases TO service_role;

ALTER TABLE public.territory_label_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read territory label aliases" ON public.territory_label_aliases;
CREATE POLICY "Authenticated can read territory label aliases"
  ON public.territory_label_aliases FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage territory label aliases" ON public.territory_label_aliases;
CREATE POLICY "Admins manage territory label aliases"
  ON public.territory_label_aliases FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER trg_territory_label_aliases_updated_at
  BEFORE UPDATE ON public.territory_label_aliases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed ONLY the labels confirmed by the field team. No inferred geography.
INSERT INTO public.territory_label_aliases (alias_label, canonical_label, notes) VALUES
  ('bronx', 'bronx', 'confirmed 2026-09-23'),
  ('south bronx', 'bronx', 'confirmed 2026-09-23'),
  ('east bronx', 'bronx', 'confirmed 2026-09-23'),
  ('west bronx', 'bronx', 'confirmed 2026-09-23'),
  ('the bronx', 'bronx', 'confirmed 2026-09-23'),
  ('kingsbridge', 'bronx', 'confirmed 2026-09-23'),
  ('riverdale', 'bronx', 'confirmed 2026-09-23'),
  ('manhattan', 'manhattan', 'confirmed 2026-09-23'),
  ('new york', 'manhattan', 'confirmed 2026-09-23'),
  ('new york city', 'manhattan', 'confirmed 2026-09-23'),
  ('harlem', 'manhattan', 'confirmed 2026-09-23'),
  ('dyckman', 'manhattan', 'confirmed 2026-09-23'),
  ('inwood', 'manhattan', 'confirmed 2026-09-23')
ON CONFLICT DO NOTHING;

-- 2) Territory-scoped, read-only prospect feed for the signed-in ambassador.
CREATE OR REPLACE FUNCTION public.ambassador_visible_prospects()
RETURNS TABLE (
  prospect_id uuid,
  candidate_id uuid,
  store_name text,
  full_address text,
  city text,
  state text,
  zip text,
  phone text,
  neighborhood text,
  canonical_area text,
  latitude double precision,
  longitude double precision,
  discovery_status text,
  discovered_by text,
  promotion_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT a.id
    FROM public.ambassadors a
    WHERE a.user_id = auth.uid()
      AND a.is_active IS TRUE
      AND a.deleted_at IS NULL
    ORDER BY a.created_at DESC
    LIMIT 1
  ),
  base AS (
    SELECT
      ta.id,
      ta.store_name,
      ta.full_address,
      ta.city,
      ta.state,
      ta.zip,
      ta.phone,
      tn.name AS neighborhood,
      COALESCE(al.canonical_label, lower(btrim(ta.city))) AS canonical_area,
      ta.latitude,
      ta.longitude,
      ta.discovery_status,
      ta.discovered_by,
      ta.place_id,
      right(regexp_replace(COALESCE(ta.phone, ''), '[^0-9]', '', 'g'), 10) AS p10
    FROM public.territory_addresses ta
    LEFT JOIN public.territory_neighborhoods tn ON tn.id = ta.neighborhood_id
    LEFT JOIN public.territory_label_aliases al
      ON lower(btrim(al.alias_label)) = lower(btrim(ta.city))
    WHERE EXISTS (SELECT 1 FROM me)
  ),
  scoped AS (
    SELECT b.*
    FROM base b
    WHERE EXISTS (
      SELECT 1
      FROM public.ambassador_territory_coverage tc, me
      WHERE tc.ambassador_id = me.id
        AND public.territory_matches_store(
              tc.region_type::text, tc.region_value,
              b.state, b.city, b.canonical_area, b.neighborhood, b.zip
            )
    )
    -- already an operational store (confident phone match only)
    AND NOT EXISTS (
      SELECT 1 FROM public.store_master sm
      WHERE sm.deleted_at IS NULL
        AND sm.phone_last10 IS NOT NULL
        AND length(b.p10) = 10
        AND sm.phone_last10 = b.p10
    )
    -- already promoted into the CRM
    AND NOT EXISTS (
      SELECT 1 FROM public.territory_store_promotions p
      WHERE p.territory_address_id = b.id AND p.status = 'approved'
    )
  ),
  deduped AS (
    SELECT DISTINCT ON (COALESCE(NULLIF(s.p10, ''), s.place_id, s.id::text))
      s.*
    FROM scoped s
    ORDER BY COALESCE(NULLIF(s.p10, ''), s.place_id, s.id::text), s.id
  )
  SELECT
    d.id,
    (SELECT c.id FROM public.territory_store_candidates c
      WHERE c.territory_address_id = d.id ORDER BY c.created_at DESC LIMIT 1),
    d.store_name,
    d.full_address,
    d.city,
    d.state,
    d.zip,
    d.phone,
    d.neighborhood,
    d.canonical_area,
    d.latitude,
    d.longitude,
    d.discovery_status,
    d.discovered_by,
    (SELECT p.status FROM public.territory_store_promotions p
      WHERE p.territory_address_id = d.id ORDER BY p.created_at DESC LIMIT 1)
  FROM deduped d;
$function$;

REVOKE ALL ON FUNCTION public.ambassador_visible_prospects() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ambassador_visible_prospects() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ambassador_visible_prospects() TO service_role;