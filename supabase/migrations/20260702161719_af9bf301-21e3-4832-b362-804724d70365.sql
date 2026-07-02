
DROP POLICY IF EXISTS uben_grants_read ON public.uben_grant_applications;
DROP POLICY IF EXISTS uben_grants_auth_all ON public.uben_grant_applications;
DROP POLICY IF EXISTS uben_donors_read ON public.uben_donors;
DROP POLICY IF EXISTS uben_donors_auth_all ON public.uben_donors;
DROP POLICY IF EXISTS uben_donations_read ON public.uben_donations;
DROP POLICY IF EXISTS uben_donations_auth_all ON public.uben_donations;
DROP POLICY IF EXISTS uben_beneficiaries_read ON public.uben_beneficiaries;
DROP POLICY IF EXISTS uben_beneficiaries_auth_all ON public.uben_beneficiaries;

CREATE POLICY uben_grants_admin ON public.uben_grant_applications
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY uben_donors_admin ON public.uben_donors
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY uben_donations_admin ON public.uben_donations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY uben_beneficiaries_admin ON public.uben_beneficiaries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
