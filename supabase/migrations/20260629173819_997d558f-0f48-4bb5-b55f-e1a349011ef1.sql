ALTER TABLE public.wholesalers
  ADD COLUMN IF NOT EXISTS state_code text,
  ADD COLUMN IF NOT EXISTS geocoded_at timestamptz;

-- Backfill state_code from existing 2-letter state values.
UPDATE public.wholesalers
SET state_code = upper(state)
WHERE state_code IS NULL
  AND state IS NOT NULL
  AND length(state) = 2;

CREATE OR REPLACE VIEW public.dd_supplier_map_data AS
SELECT
  w.id,
  w.name,
  w.city,
  w.state_code,
  w.latitude,
  w.longitude,
  w.reliability_grade,
  w.preferred,
  w.overall_rating,
  COUNT(DISTINCT pa.id) AS product_count,
  COALESCE(SUM(pa.inventory_qty), 0) AS total_inventory,
  COUNT(DISTINCT dgs.id) AS total_orders
FROM public.wholesalers w
LEFT JOIN public.products_all pa
  ON pa.wholesaler_id = w.id
  AND pa.status = 'active'
LEFT JOIN public.dd_grabba_sync dgs
  ON dgs.wholesaler_id = w.id
WHERE w.deleted_at IS NULL
GROUP BY w.id;

GRANT SELECT ON public.dd_supplier_map_data TO authenticated;
GRANT SELECT ON public.dd_supplier_map_data TO service_role;