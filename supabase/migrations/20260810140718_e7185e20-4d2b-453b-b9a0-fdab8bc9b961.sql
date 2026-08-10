-- Shared UT staff check. Reads BOTH role systems intentionally (temporary,
-- not the end state) so nobody loses access during the switch.
CREATE OR REPLACE FUNCTION public.is_ut_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text = ANY (ARRAY['admin','owner','va'])
  ) OR EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.user_id = auth.uid()
      AND up.primary_role::text = ANY (ARRAY['admin','owner','va'])
  );
$$;

-- Ownership path A: ut_partners.user_id -> venue tables.
-- SECURITY DEFINER so policy subqueries are not themselves RLS-filtered.
CREATE OR REPLACE FUNCTION public.owns_ut_partner(_partner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ut_partners p
    WHERE p.id = _partner_id AND p.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.owns_ut_venue(_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ut_partner_venue_profiles v
    JOIN public.ut_partners p ON p.id = v.partner_id
    WHERE v.id = _venue_id AND p.user_id = auth.uid()
  );
$$;

-- Ownership path B (SEPARATE from path A -- ut_partner_profiles has its own
-- user_id and is NOT linked to ut_partners).
CREATE OR REPLACE FUNCTION public.owns_ut_partner_profile(_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ut_partner_profiles pp
    WHERE pp.id = _profile_id AND pp.user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_ut_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_ut_partner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_ut_venue(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_ut_partner_profile(uuid) TO authenticated;

-- 1. ut_partners -- migrate onto the shared helper (was inline user_profiles read)
DROP POLICY IF EXISTS "Partners can manage own profile" ON public.ut_partners;
CREATE POLICY "ut_partners_owner_or_staff" ON public.ut_partners
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_ut_staff())
  WITH CHECK (user_id = auth.uid() OR public.is_ut_staff());

-- 2. ut_partner_profiles -- OWNERSHIP PATH B (own user_id; NOT tied to ut_partners)
DROP POLICY IF EXISTS "Authenticated users can manage ut_partner_profiles" ON public.ut_partner_profiles;
CREATE POLICY "ut_partner_profiles_owner_or_staff__path_b" ON public.ut_partner_profiles
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_ut_staff())
  WITH CHECK (user_id = auth.uid() OR public.is_ut_staff());

-- 3. ut_partner_onboarding -- PATH B via partner_profile_id
DROP POLICY IF EXISTS "Authenticated users can manage onboarding" ON public.ut_partner_onboarding;
CREATE POLICY "ut_partner_onboarding_owner_or_staff__path_b" ON public.ut_partner_onboarding
  FOR ALL TO authenticated
  USING (public.owns_ut_partner_profile(partner_profile_id) OR public.is_ut_staff())
  WITH CHECK (public.owns_ut_partner_profile(partner_profile_id) OR public.is_ut_staff());

-- 4. ut_partner_venue_profiles -- PATH A via ut_partners
DROP POLICY IF EXISTS "venue_profiles_all" ON public.ut_partner_venue_profiles;
CREATE POLICY "ut_venue_profiles_owner_or_staff__path_a" ON public.ut_partner_venue_profiles
  FOR ALL TO authenticated
  USING (public.owns_ut_partner(partner_id) OR public.is_ut_staff())
  WITH CHECK (public.owns_ut_partner(partner_id) OR public.is_ut_staff());

-- 5-8. venue children -- PATH A via venue_id
DROP POLICY IF EXISTS "venue_spaces_all" ON public.ut_partner_venue_spaces;
CREATE POLICY "ut_venue_spaces_owner_or_staff__path_a" ON public.ut_partner_venue_spaces
  FOR ALL TO authenticated
  USING (public.owns_ut_venue(venue_id) OR public.is_ut_staff())
  WITH CHECK (public.owns_ut_venue(venue_id) OR public.is_ut_staff());

DROP POLICY IF EXISTS "venue_media_all" ON public.ut_partner_venue_media;
CREATE POLICY "ut_venue_media_owner_or_staff__path_a" ON public.ut_partner_venue_media
  FOR ALL TO authenticated
  USING (public.owns_ut_venue(venue_id) OR public.is_ut_staff())
  WITH CHECK (public.owns_ut_venue(venue_id) OR public.is_ut_staff());

DROP POLICY IF EXISTS "venue_availability_all" ON public.ut_partner_venue_availability;
CREATE POLICY "ut_venue_availability_owner_or_staff__path_a" ON public.ut_partner_venue_availability
  FOR ALL TO authenticated
  USING (public.owns_ut_venue(venue_id) OR public.is_ut_staff())
  WITH CHECK (public.owns_ut_venue(venue_id) OR public.is_ut_staff());

DROP POLICY IF EXISTS "venue_packages_all" ON public.ut_partner_venue_packages;
CREATE POLICY "ut_venue_packages_owner_or_staff__path_a" ON public.ut_partner_venue_packages
  FOR ALL TO authenticated
  USING (public.owns_ut_venue(venue_id) OR public.is_ut_staff())
  WITH CHECK (public.owns_ut_venue(venue_id) OR public.is_ut_staff());