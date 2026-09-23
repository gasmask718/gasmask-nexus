DELETE FROM public.ambassador_territory_coverage WHERE id = 'f4bf5c0b-4385-4c6d-8b83-de4b7c34bd41';

CREATE OR REPLACE FUNCTION public.territory_data_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role::text IN ('owner','admin','staff','va','developer')
  ) OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id
      AND p.role::text IN ('owner','admin','staff','va','developer')
  );
$$;

GRANT EXECUTE ON FUNCTION public.territory_data_staff(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Authenticated users can read addresses" ON public.territory_addresses;

CREATE POLICY "Territory staff can read addresses"
ON public.territory_addresses
FOR SELECT
TO authenticated
USING (public.territory_data_staff(auth.uid()));