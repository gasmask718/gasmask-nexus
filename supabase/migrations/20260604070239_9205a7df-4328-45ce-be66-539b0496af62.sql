
CREATE OR REPLACE VIEW public.v_gm_cadence_due AS
SELECT
  s.id AS store_id,
  s.name AS store_name,
  sm.relationship_status,
  COALESCE(scp.cadence_days, public.default_cadence_days(sm.relationship_status)) AS cadence_days,
  s.last_visit_date,
  s.neighborhood,
  s.boro
FROM public.stores s
JOIN public.store_master sm ON sm.id = s.id
LEFT JOIN public.store_cadence_policy scp
  ON scp.store_id = s.id AND COALESCE(scp.enabled, true) = true
WHERE s.deleted_at IS NULL
  AND COALESCE(scp.cadence_days, public.default_cadence_days(sm.relationship_status)) IS NOT NULL
  AND (
    s.last_visit_date IS NULL
    OR s.last_visit_date < now() - (
         COALESCE(scp.cadence_days, public.default_cadence_days(sm.relationship_status)) || ' days'
       )::interval
  );

GRANT SELECT ON public.v_gm_cadence_due TO authenticated;

CREATE INDEX IF NOT EXISTS idx_follow_up_queue_store_status
  ON public.follow_up_queue(store_id, status);
