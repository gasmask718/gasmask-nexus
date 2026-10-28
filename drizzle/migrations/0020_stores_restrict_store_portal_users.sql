-- The existing stores_simulation_select policy lets every signed-in user read all stores.
-- Store-portal users (linked through store_users, not staff) must only ever see their own store(s): add a RESTRICTIVE policy.
CREATE POLICY stores_store_portal_users_own_only ON public.stores AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    NOT EXISTS (SELECT 1 FROM public.store_users su WHERE su.user_id = auth.uid())
    OR public.is_staff(auth.uid())
    OR public.is_store_user_for(auth.uid(), id)
  );