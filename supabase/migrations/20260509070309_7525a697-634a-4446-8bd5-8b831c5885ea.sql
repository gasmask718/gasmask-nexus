
-- C0.5: Migrate test stores out of 'active'
UPDATE public.stores
   SET status = 'test'::store_status,
       last_classified_at = now()
 WHERE is_test_data = true
   AND status::text = 'active'
   AND deleted_at IS NULL;

-- C4: Reactivation targets view
DROP VIEW IF EXISTS public.v_reactivation_targets;

CREATE VIEW public.v_reactivation_targets AS
SELECT
  s.id                                                AS store_id,
  s.name                                              AS store_name,
  s.address_street                                    AS address_line_1,
  s.boro,
  s.neighborhood,
  s.address_zip,
  s.address_city,
  s.address_state,
  s.phone,
  s.email,
  s.assigned_ambassador_id,
  s.reactivation_priority,
  s.reactivation_attempts,
  s.last_reactivation_attempt_at,
  s.activated_at,
  COALESCE(t.lifetime_tubes_delivered, 0)             AS lifetime_tubes_delivered,
  t.top_brand,
  t.last_tube_transaction_at,
  CASE WHEN t.last_tube_transaction_at IS NOT NULL
       THEN EXTRACT(DAY FROM (now() - t.last_tube_transaction_at))::int
  END                                                 AS days_since_last_delivery,
  ROUND(
    COALESCE(t.lifetime_tubes_delivered, 0)::numeric *
    CASE s.reactivation_priority
      WHEN 'easy_reorder' THEN 1.50
      WHEN 'warm_restart' THEN 1.25
      WHEN 'cold_restart' THEN 1.00
      ELSE 0.75
    END
  , 2)                                                AS reactivation_score
FROM public.stores s
LEFT JOIN public.v_store_tube_summary t ON t.store_id = s.id
WHERE s.status::text = 'reactivation_target'
  AND s.deleted_at IS NULL
  AND (s.is_test_data = false OR s.is_test_data IS NULL);

GRANT SELECT ON public.v_reactivation_targets TO authenticated, anon;
