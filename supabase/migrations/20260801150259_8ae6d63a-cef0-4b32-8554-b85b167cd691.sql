
-- Helper: funding staff (platform elevated users, or members of the USA Funding business)
CREATE OR REPLACE FUNCTION public.is_funding_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND (
    public.is_elevated_user(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.business_members bm
      WHERE bm.user_id = _user_id
        AND bm.business_id = 'e54443eb-5004-4e23-a468-475d12442846'::uuid
    )
  )
$$;

-- Helper: is the caller the funding client that owns this client_id?
CREATE OR REPLACE FUNCTION public.is_funding_client_self(_client_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.funding_clients fc
    WHERE fc.id = _client_id
      AND (
        fc.user_id = _user_id
        OR fc.portal_user_id = _user_id::text
        OR (
          fc.email IS NOT NULL
          AND lower(fc.email) = lower(nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'email',''))
        )
      )
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_funding_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_funding_client_self(uuid, uuid) TO authenticated;

-- ============ funding_clients ============
DROP POLICY IF EXISTS "Authenticated users can view funding clients" ON public.funding_clients;
DROP POLICY IF EXISTS "Authenticated users can create funding clients" ON public.funding_clients;
DROP POLICY IF EXISTS "Authenticated users can update funding clients" ON public.funding_clients;
DROP POLICY IF EXISTS "Authenticated users can delete funding clients" ON public.funding_clients;

CREATE POLICY "funding_clients_staff_all" ON public.funding_clients
  FOR ALL TO authenticated
  USING (public.is_funding_staff(auth.uid()))
  WITH CHECK (public.is_funding_staff(auth.uid()));

CREATE POLICY "funding_clients_self_select" ON public.funding_clients
  FOR SELECT TO authenticated
  USING (public.is_funding_client_self(id, auth.uid()));

CREATE POLICY "funding_clients_self_update" ON public.funding_clients
  FOR UPDATE TO authenticated
  USING (public.is_funding_client_self(id, auth.uid()))
  WITH CHECK (public.is_funding_client_self(id, auth.uid()));

-- ============ funding_application_profile ============
DROP POLICY IF EXISTS "fap_auth_read" ON public.funding_application_profile;
DROP POLICY IF EXISTS "fap_auth_write" ON public.funding_application_profile;
DROP POLICY IF EXISTS "fap_auth_update" ON public.funding_application_profile;
DROP POLICY IF EXISTS "fap_auth_delete" ON public.funding_application_profile;

CREATE POLICY "fap_staff_all" ON public.funding_application_profile
  FOR ALL TO authenticated
  USING (public.is_funding_staff(auth.uid()))
  WITH CHECK (public.is_funding_staff(auth.uid()));

CREATE POLICY "fap_self_select" ON public.funding_application_profile
  FOR SELECT TO authenticated
  USING (public.is_funding_client_self(client_id, auth.uid()));

CREATE POLICY "fap_self_update" ON public.funding_application_profile
  FOR UPDATE TO authenticated
  USING (public.is_funding_client_self(client_id, auth.uid()))
  WITH CHECK (public.is_funding_client_self(client_id, auth.uid()));

-- ============ funding_client_documents ============
DROP POLICY IF EXISTS "Authenticated users can manage client documents" ON public.funding_client_documents;
DROP POLICY IF EXISTS "Authenticated users can manage funding documents" ON public.funding_client_documents;

CREATE POLICY "fcd_staff_all" ON public.funding_client_documents
  FOR ALL TO authenticated
  USING (public.is_funding_staff(auth.uid()))
  WITH CHECK (public.is_funding_staff(auth.uid()));

CREATE POLICY "fcd_self_select" ON public.funding_client_documents
  FOR SELECT TO authenticated
  USING (public.is_funding_client_self(client_id, auth.uid()));

CREATE POLICY "fcd_self_insert" ON public.funding_client_documents
  FOR INSERT TO authenticated
  WITH CHECK (public.is_funding_client_self(client_id, auth.uid()));
