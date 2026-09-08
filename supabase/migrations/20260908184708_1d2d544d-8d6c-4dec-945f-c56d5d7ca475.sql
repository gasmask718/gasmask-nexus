DROP VIEW IF EXISTS public.v_ambassador_login_readiness;

CREATE VIEW public.v_ambassador_login_readiness AS
WITH shared AS (
  SELECT user_id, count(*) AS linked_count
  FROM public.ambassadors
  WHERE user_id IS NOT NULL AND is_active AND deleted_at IS NULL
  GROUP BY user_id
)
SELECT
  a.id AS ambassador_id,
  a.name,
  a.email,
  a.phone_primary,
  a.city,
  a.state,
  a.user_id,
  a.previous_user_id,
  a.login_unlinked_at,
  a.login_unlink_reason,
  coalesce(s.linked_count, 0) AS logins_shared_with,
  CASE
    WHEN a.user_id IS NULL THEN 'login_required'
    WHEN coalesce(s.linked_count, 0) > 1 THEN 'shared_login_conflict'
    ELSE 'ready'
  END AS readiness,
  (SELECT count(*) FROM public.ambassador_assignments aa
     WHERE aa.ambassador_id = a.id AND aa.active) AS active_assignments,
  (SELECT count(*) FROM public.routes r WHERE r.assigned_to = a.user_id) AS routes_visible
FROM public.ambassadors a
LEFT JOIN shared s ON s.user_id = a.user_id
WHERE a.is_active AND a.deleted_at IS NULL;

REVOKE ALL ON public.v_ambassador_login_readiness FROM PUBLIC, anon;
GRANT SELECT ON public.v_ambassador_login_readiness TO authenticated, service_role;