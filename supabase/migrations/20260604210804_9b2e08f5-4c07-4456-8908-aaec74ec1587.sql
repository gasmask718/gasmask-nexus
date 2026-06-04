ALTER TABLE public.territory_addresses
  ADD COLUMN IF NOT EXISTS matched_store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS match_score numeric(4,3),
  ADD COLUMN IF NOT EXISTS match_method text,
  ADD COLUMN IF NOT EXISTS scan_source text,
  ADD COLUMN IF NOT EXISTS last_scan_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_territory_addresses_matched_store
  ON public.territory_addresses(matched_store_id);

CREATE TABLE IF NOT EXISTS public.territory_coverage_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('neighborhood','city')),
  city text NOT NULL,
  state text NOT NULL,
  neighborhood text,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  total_found integer NOT NULL DEFAULT 0,
  have_count integer NOT NULL DEFAULT 0,
  donthave_count integer NOT NULL DEFAULT 0,
  raw_summary jsonb,
  created_by uuid DEFAULT auth.uid()
);

CREATE INDEX IF NOT EXISTS idx_coverage_scans_lookup
  ON public.territory_coverage_scans(city, state, neighborhood, scanned_at DESC);

GRANT SELECT, INSERT ON public.territory_coverage_scans TO authenticated;
GRANT ALL ON public.territory_coverage_scans TO service_role;

ALTER TABLE public.territory_coverage_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth can read scans" ON public.territory_coverage_scans;
CREATE POLICY "auth can read scans"
  ON public.territory_coverage_scans FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth can insert scans" ON public.territory_coverage_scans;
CREATE POLICY "auth can insert scans"
  ON public.territory_coverage_scans FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE OR REPLACE VIEW public.v_neighborhood_coverage_universe AS
SELECT
  s.id::text                                        AS row_id,
  'have'::text                                      AS coverage_status,
  s.name                                            AS name,
  COALESCE(s.address_street, '')                    AS address,
  s.address_city                                    AS city,
  s.address_state                                   AS state,
  s.neighborhood                                    AS neighborhood,
  s.phone                                           AS phone,
  s.lat::double precision                           AS lat,
  s.lng::double precision                           AS lng,
  NULL::text                                        AS place_id,
  s.id                                              AS store_id,
  s.status::text                                    AS relationship_status,
  NULL::uuid                                        AS territory_address_id,
  NULL::numeric                                     AS match_score,
  NULL::text                                        AS match_method
FROM public.stores s
WHERE s.deleted_at IS NULL
UNION ALL
SELECT
  ta.id::text                                       AS row_id,
  'donthave'::text                                  AS coverage_status,
  COALESCE(ta.store_name, ta.full_address)          AS name,
  ta.full_address                                   AS address,
  ta.city                                           AS city,
  ta.state                                          AS state,
  tn.name                                           AS neighborhood,
  ta.phone                                          AS phone,
  ta.latitude                                       AS lat,
  ta.longitude                                      AS lng,
  ta.place_id                                       AS place_id,
  NULL::uuid                                        AS store_id,
  'Prospect / Never contacted'::text                AS relationship_status,
  ta.id                                             AS territory_address_id,
  ta.match_score                                    AS match_score,
  ta.match_method                                   AS match_method
FROM public.territory_addresses ta
LEFT JOIN public.territory_neighborhoods tn ON tn.id = ta.neighborhood_id
WHERE ta.matched_store_id IS NULL
  AND ta.discovery_status NOT IN ('not_a_store','no_tobacco','wholesaler')
  AND ta.place_id IS NOT NULL;

GRANT SELECT ON public.v_neighborhood_coverage_universe TO authenticated, anon;