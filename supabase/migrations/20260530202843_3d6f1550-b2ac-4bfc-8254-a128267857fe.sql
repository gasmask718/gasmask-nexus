CREATE OR REPLACE VIEW public.v_store_relationship_rollup AS
SELECT
  COALESCE(NULLIF(TRIM(sm.state), ''), 'Unspecified') AS state,
  COALESCE(NULLIF(TRIM(sm.city), ''), 'Unspecified') AS city,
  COALESCE(NULLIF(TRIM(s.neighborhood), ''), 'Unspecified') AS neighborhood,
  sm.borough_id,
  count(*) AS total,
  count(*) FILTER (WHERE sm.relationship_status = 'Active (Good)') AS active_good,
  count(*) FILTER (WHERE sm.relationship_status = 'Non-active (New - need to speak)') AS non_active_new,
  count(*) FILTER (WHERE sm.relationship_status = 'Follow-up (secure relationship)') AS follow_up,
  count(*) FILTER (WHERE sm.relationship_status = 'Not interested') AS not_interested,
  count(*) FILTER (WHERE sm.relationship_status = 'Not interested - sold in past') AS not_interested_sold_past,
  count(*) FILTER (WHERE sm.relationship_status = 'No tobacco') AS no_tobacco,
  count(*) FILTER (WHERE sm.relationship_status = 'Selling slow') AS selling_slow,
  count(*) FILTER (WHERE sm.relationship_status = 'Need promo (bring samples)') AS need_promo,
  count(*) FILTER (WHERE sm.relationship_status = 'Closed permanently') AS closed_permanently
FROM store_master sm
LEFT JOIN stores s ON s.id = sm.id
WHERE sm.deleted_at IS NULL
GROUP BY 1, 2, 3, sm.borough_id;