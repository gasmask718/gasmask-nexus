
-- 1) route_stops: add assignee INSERT
CREATE POLICY route_stops_assignee_insert
ON public.route_stops
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.routes r
    WHERE r.id = route_stops.route_id
      AND r.assigned_to = auth.uid()
  )
);

-- 2) communication_messages: drop wide-open policy
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.communication_messages;

-- Add staff full access (admin/owner/employee) so staff aren't locked out
CREATE POLICY cm_staff_all
ON public.communication_messages
FOR ALL
TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

-- 3) stores: add ambassador + staff SELECT scoped policies (keep simulation policies intact)
CREATE POLICY stores_staff_select
ON public.stores
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY stores_ambassador_select
ON public.stores
FOR SELECT
TO authenticated
USING (
  assigned_ambassador_id = public.current_ambassador_id()
  OR captured_by_user_id = auth.uid()
);
