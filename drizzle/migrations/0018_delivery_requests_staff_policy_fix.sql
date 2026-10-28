-- ambassador_has_store_access is not executable by authenticated, so this policy made every direct read of delivery_requests error.
-- user_has_store_access is the executable SECURITY DEFINER wrapper that delegates to the shared-territory rule.
DROP POLICY IF EXISTS delivery_requests_staff_all ON public.delivery_requests;
CREATE POLICY delivery_requests_staff_all ON public.delivery_requests FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR public.user_has_store_access(store_id))
  WITH CHECK (public.is_staff(auth.uid()) OR public.user_has_store_access(store_id));