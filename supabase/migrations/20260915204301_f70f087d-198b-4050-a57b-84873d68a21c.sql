CREATE OR REPLACE FUNCTION public.has_production_office_access(_user_id uuid, _office_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.production_office_users
    WHERE user_id = _user_id
      AND office_id = _office_id
      AND active = true
  ) OR EXISTS (
    SELECT 1 FROM public.production_office_managers
    WHERE user_id = _user_id
      AND office_id = _office_id
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('owner', 'admin')
  );
$$;