CREATE OR REPLACE FUNCTION public.is_grants_staff(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND (
    public.has_role(_user_id, 'admin'::app_role)
    OR public.has_role(_user_id, 'owner'::app_role)
    OR public.has_role(_user_id, 'developer'::app_role)
    OR public.is_funding_staff(_user_id)
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_grants_staff(uuid) TO authenticated, service_role;

-- grant_opportunities
DROP POLICY IF EXISTS grant_opps_select_authenticated ON public.grant_opportunities;
DROP POLICY IF EXISTS grant_opps_admin_write ON public.grant_opportunities;
CREATE POLICY grant_opps_staff_all ON public.grant_opportunities FOR ALL TO authenticated
  USING (public.is_grants_staff()) WITH CHECK (public.is_grants_staff());

-- grant_applications
DROP POLICY IF EXISTS "auth all" ON public.grant_applications;
CREATE POLICY grant_applications_staff_all ON public.grant_applications FOR ALL TO authenticated
  USING (public.is_grants_staff()) WITH CHECK (public.is_grants_staff());

-- grant_documents
DROP POLICY IF EXISTS "auth all" ON public.grant_documents;
CREATE POLICY grant_documents_staff_all ON public.grant_documents FOR ALL TO authenticated
  USING (public.is_grants_staff()) WITH CHECK (public.is_grants_staff());

-- grant_tasks
DROP POLICY IF EXISTS "auth all" ON public.grant_tasks;
CREATE POLICY grant_tasks_staff_all ON public.grant_tasks FOR ALL TO authenticated
  USING (public.is_grants_staff()) WITH CHECK (public.is_grants_staff());

-- grant_business_profiles
DROP POLICY IF EXISTS gbp_auth_insert ON public.grant_business_profiles;
DROP POLICY IF EXISTS gbp_auth_read ON public.grant_business_profiles;
DROP POLICY IF EXISTS gbp_auth_update ON public.grant_business_profiles;
CREATE POLICY gbp_staff_all ON public.grant_business_profiles FOR ALL TO authenticated
  USING (public.is_grants_staff()) WITH CHECK (public.is_grants_staff());

-- grant_eligibility_results
DROP POLICY IF EXISTS ger_insert ON public.grant_eligibility_results;
DROP POLICY IF EXISTS ger_read ON public.grant_eligibility_results;
DROP POLICY IF EXISTS ger_update ON public.grant_eligibility_results;
CREATE POLICY ger_staff_all ON public.grant_eligibility_results FOR ALL TO authenticated
  USING (public.is_grants_staff()) WITH CHECK (public.is_grants_staff());

-- grant_application_packages
DROP POLICY IF EXISTS gap_insert ON public.grant_application_packages;
DROP POLICY IF EXISTS gap_read ON public.grant_application_packages;
DROP POLICY IF EXISTS gap_update ON public.grant_application_packages;
CREATE POLICY gap_staff_all ON public.grant_application_packages FOR ALL TO authenticated
  USING (public.is_grants_staff()) WITH CHECK (public.is_grants_staff());

-- grant_funders / interactions
DROP POLICY IF EXISTS gf_auth ON public.grant_funders;
CREATE POLICY gf_staff_all ON public.grant_funders FOR ALL TO authenticated
  USING (public.is_grants_staff()) WITH CHECK (public.is_grants_staff());

DROP POLICY IF EXISTS gfi_auth ON public.grant_funder_interactions;
CREATE POLICY gfi_staff_all ON public.grant_funder_interactions FOR ALL TO authenticated
  USING (public.is_grants_staff()) WITH CHECK (public.is_grants_staff());

-- grant_requirements
DROP POLICY IF EXISTS gr_auth_read ON public.grant_requirements;
CREATE POLICY gr_staff_read ON public.grant_requirements FOR SELECT TO authenticated
  USING (public.is_grants_staff());