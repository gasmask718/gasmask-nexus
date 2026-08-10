-- Phase 4: client_grant_matches keyed on funding_clients identity.
-- Replace the blanket authenticated policy with staff + client-owner access.
DROP POLICY IF EXISTS "auth all" ON public.client_grant_matches;

CREATE POLICY "cgm_staff_all" ON public.client_grant_matches
  FOR ALL TO authenticated
  USING (public.is_grants_staff(auth.uid()))
  WITH CHECK (public.is_grants_staff(auth.uid()));

CREATE POLICY "cgm_client_read_own" ON public.client_grant_matches
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.funding_clients fc
    WHERE fc.id = client_grant_matches.client_id
      AND fc.user_id = auth.uid()
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_grant_matches TO authenticated;
GRANT ALL ON public.client_grant_matches TO service_role;