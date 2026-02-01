-- Drop and recreate functions with correct column name (active, not is_active)
DROP FUNCTION IF EXISTS public.get_user_office_role(UUID, UUID);
DROP FUNCTION IF EXISTS public.get_user_production_offices(UUID);

-- Create security definer function to check production office role
CREATE OR REPLACE FUNCTION public.get_user_office_role(_user_id UUID, _office_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.production_office_users
  WHERE user_id = _user_id AND office_id = _office_id AND active = true
  LIMIT 1
$$;

-- Create function to get user's assigned offices
CREATE OR REPLACE FUNCTION public.get_user_production_offices(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT office_id FROM public.production_office_users
  WHERE user_id = _user_id AND active = true
$$;