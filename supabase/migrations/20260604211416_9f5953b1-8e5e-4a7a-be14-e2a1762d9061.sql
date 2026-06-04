ALTER TABLE public.territory_addresses
  ADD COLUMN IF NOT EXISTS neighborhood_label text;

CREATE INDEX IF NOT EXISTS idx_territory_addresses_neighborhood_label
  ON public.territory_addresses(neighborhood_label);

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
  COALESCE(ta.neighborhood_label, tn.name)          AS neighborhood,
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