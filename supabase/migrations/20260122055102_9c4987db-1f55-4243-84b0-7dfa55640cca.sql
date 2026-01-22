-- Helper function for RLS (must exist before policies)
CREATE OR REPLACE FUNCTION public.current_ambassador_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.ambassadors WHERE user_id = auth.uid() LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.current_ambassador_id TO authenticated;