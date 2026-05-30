-- ═══════════════════════════════════════════════════════════════════════════════
-- HELPERS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Staff = admin/owner/employee (sourced from user_roles, not profiles.role, to avoid
-- privilege-escalation via profile editing).
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::app_role, 'owner'::app_role, 'employee'::app_role)
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, anon, service_role;

-- Alias matching spec
CREATE OR REPLACE FUNCTION public.get_ambassador_id_for_user(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.ambassadors WHERE user_id = _user_id LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_ambassador_id_for_user(uuid) TO authenticated, anon, service_role;

-- Driver/biker store visibility: stores that are stops on routes assigned to me.
CREATE OR REPLACE FUNCTION public.user_has_route_for_store(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.route_stops rs
    JOIN public.routes r ON r.id = rs.route_id
    WHERE r.assigned_to = _user_id
      AND rs.store_id = _store_id
  )
$$;

GRANT EXECUTE ON FUNCTION public.user_has_route_for_store(uuid, uuid) TO authenticated, anon, service_role;

-- Ambassador active-assignment store visibility
CREATE OR REPLACE FUNCTION public.ambassador_has_active_assignment(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ambassador_assignments aa
    JOIN public.ambassadors a ON a.id = aa.ambassador_id
    WHERE a.user_id = _user_id
      AND aa.store_id = _store_id
      AND COALESCE(aa.active, false) = true
  )
$$;

GRANT EXECUTE ON FUNCTION public.ambassador_has_active_assignment(uuid, uuid) TO authenticated, anon, service_role;


-- ═══════════════════════════════════════════════════════════════════════════════
-- STORE_MASTER
-- ═══════════════════════════════════════════════════════════════════════════════

-- Drop the catch-all permissive policies that defeat scoping.
DROP POLICY IF EXISTS "Authenticated users can select store_master" ON public.store_master;
DROP POLICY IF EXISTS "Authenticated users can insert store_master" ON public.store_master;
DROP POLICY IF EXISTS "Authenticated users can update store_master" ON public.store_master;

-- Keep existing scoped SELECTs for VA / production / etc. (they OR with the new ones).
-- New scoped SELECT policies:

CREATE POLICY "store_master_select_staff"
ON public.store_master FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "store_master_select_ambassador_scoped"
ON public.store_master FOR SELECT
TO authenticated
USING (
  public.get_ambassador_id_for_user(auth.uid()) IS NOT NULL
  AND (
    assigned_ambassador_id = public.get_ambassador_id_for_user(auth.uid())
    OR sourced_by_ambassador_id = public.get_ambassador_id_for_user(auth.uid())
    OR public.ambassador_has_active_assignment(auth.uid(), id)
  )
);

CREATE POLICY "store_master_select_driver_biker_route"
ON public.store_master FOR SELECT
TO authenticated
USING (public.user_has_route_for_store(auth.uid(), id));

-- Staff-only INSERT/UPDATE. (The SECURITY DEFINER RPC resolve_or_create_store_master
-- still creates rows for legitimate non-staff flows by bypassing RLS.)
CREATE POLICY "store_master_insert_staff"
ON public.store_master FOR INSERT
TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "store_master_update_staff"
ON public.store_master FOR UPDATE
TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));


-- ═══════════════════════════════════════════════════════════════════════════════
-- AMBASSADOR_ASSIGNMENTS
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Allow authenticated read ambassador_assignments" ON public.ambassador_assignments;
DROP POLICY IF EXISTS "Allow authenticated insert ambassador_assignments" ON public.ambassador_assignments;
DROP POLICY IF EXISTS "Allow authenticated update ambassador_assignments" ON public.ambassador_assignments;

-- Keep "Elevated users can manage assignments" (ALL using is_elevated_user) and
-- "Ambassadors can view own assignments" (already correct).

-- Staff full access (explicit, supplements existing elevated-user policy).
CREATE POLICY "ambassador_assignments_staff_all"
ON public.ambassador_assignments FOR ALL
TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

-- Narrow self-UPDATE: ambassador may update (e.g. deactivate) only their own row.
CREATE POLICY "ambassador_assignments_self_update"
ON public.ambassador_assignments FOR UPDATE
TO authenticated
USING (ambassador_id = public.get_ambassador_id_for_user(auth.uid()))
WITH CHECK (ambassador_id = public.get_ambassador_id_for_user(auth.uid()));


-- ═══════════════════════════════════════════════════════════════════════════════
-- ROUTES
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Anyone can view routes" ON public.routes;

CREATE POLICY "routes_staff_all"
ON public.routes FOR ALL
TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "routes_assignee_select"
ON public.routes FOR SELECT
TO authenticated
USING (assigned_to = auth.uid());

CREATE POLICY "routes_assignee_update"
ON public.routes FOR UPDATE
TO authenticated
USING (assigned_to = auth.uid())
WITH CHECK (assigned_to = auth.uid());


-- ═══════════════════════════════════════════════════════════════════════════════
-- ROUTE_STOPS
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Anyone can view route stops" ON public.route_stops;
DROP POLICY IF EXISTS "Authenticated users can insert route stops" ON public.route_stops;
DROP POLICY IF EXISTS "Authenticated users can update route stops" ON public.route_stops;
DROP POLICY IF EXISTS "Authenticated users can delete route stops" ON public.route_stops;

CREATE POLICY "route_stops_staff_all"
ON public.route_stops FOR ALL
TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "route_stops_assignee_select"
ON public.route_stops FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.routes r
    WHERE r.id = route_stops.route_id
      AND r.assigned_to = auth.uid()
  )
);

CREATE POLICY "route_stops_assignee_update"
ON public.route_stops FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.routes r
    WHERE r.id = route_stops.route_id
      AND r.assigned_to = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.routes r
    WHERE r.id = route_stops.route_id
      AND r.assigned_to = auth.uid()
  )
);