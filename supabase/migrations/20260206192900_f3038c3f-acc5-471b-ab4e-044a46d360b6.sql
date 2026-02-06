
-- ═══════════════════════════════════════════════════════════════════════════════
-- VIEW: v_store_tube_intel_summary
-- Aggregates tube intelligence attribution per store for KPI card display.
-- One row per store. Read-only, no side effects.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.v_store_tube_intel_summary AS
SELECT
  store_id,
  MAX(last_updated_at) AS most_recent_update,
  MIN(last_updated_at) AS oldest_update,
  COUNT(DISTINCT last_updated_method) FILTER (WHERE last_updated_method IS NOT NULL) AS method_count,
  ARRAY_REMOVE(ARRAY_AGG(DISTINCT last_updated_method), NULL) AS methods
FROM public.store_tube_inventory_status
WHERE last_updated_at IS NOT NULL
GROUP BY store_id;
