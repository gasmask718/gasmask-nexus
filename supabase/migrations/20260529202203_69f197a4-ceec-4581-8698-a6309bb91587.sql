
CREATE OR REPLACE VIEW public.v_neighborhood_coverage AS
WITH worked AS (
  SELECT DISTINCT store_id FROM public.invoices WHERE voided_at IS NULL AND store_id IS NOT NULL
)
SELECT
  s.neighborhood,
  COUNT(*)::int AS total_stores,
  COUNT(*) FILTER (WHERE w.store_id IS NOT NULL)::int AS worked_stores,
  COUNT(*) FILTER (WHERE w.store_id IS NULL)::int AS prospect_stores,
  ROUND(100.0 * COUNT(*) FILTER (WHERE w.store_id IS NOT NULL) / NULLIF(COUNT(*),0), 1) AS coverage_pct,
  COUNT(*) FILTER (WHERE s.neighborhood_source = 'verified')::int  AS source_verified,
  COUNT(*) FILTER (WHERE s.neighborhood_source = 'zip_lookup')::int AS source_zip_lookup,
  COUNT(*) FILTER (WHERE s.neighborhood_source IS NULL AND s.neighborhood IS NOT NULL)::int AS source_other
FROM public.stores s
LEFT JOIN worked w ON w.store_id = s.id
WHERE s.deleted_at IS NULL
  AND s.neighborhood IS NOT NULL
  AND btrim(s.neighborhood) <> ''
GROUP BY s.neighborhood;

GRANT SELECT ON public.v_neighborhood_coverage TO authenticated;
GRANT SELECT ON public.v_neighborhood_coverage TO service_role;
