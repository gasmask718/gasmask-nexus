ALTER TABLE public.ambassadors
  ADD COLUMN IF NOT EXISTS previous_user_id uuid,
  ADD COLUMN IF NOT EXISTS login_unlinked_at timestamptz,
  ADD COLUMN IF NOT EXISTS login_unlink_reason text;

CREATE OR REPLACE FUNCTION public.ambassador_login_is_shared(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _user_id IS NULL THEN false
    ELSE (
      SELECT count(*) > 1
      FROM public.ambassadors a
      WHERE a.user_id = _user_id
        AND a.is_active
        AND a.deleted_at IS NULL
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.ambassador_login_is_shared(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ambassador_login_is_shared(uuid) TO authenticated, service_role;

CREATE OR REPLACE VIEW public.v_ambassador_login_readiness AS
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
  u.email AS login_email,
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
LEFT JOIN auth.users u ON u.id = a.user_id
WHERE a.is_active AND a.deleted_at IS NULL;

REVOKE ALL ON public.v_ambassador_login_readiness FROM PUBLIC, anon;
GRANT SELECT ON public.v_ambassador_login_readiness TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guard_route_shared_login()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL
     AND coalesce(NEW.status, '') IN ('active','scheduled','in_progress','planned')
     AND public.ambassador_login_is_shared(NEW.assigned_to) THEN
    RAISE EXCEPTION 'This login is shared by more than one ambassador record. Give the ambassador their own login before making this route ready.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_route_shared_login ON public.routes;
CREATE TRIGGER trg_guard_route_shared_login
BEFORE INSERT OR UPDATE OF assigned_to, status ON public.routes
FOR EACH ROW EXECUTE FUNCTION public.guard_route_shared_login();