CREATE OR REPLACE FUNCTION public.is_elevated_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND role::text IN ('owner', 'admin', 'ceo')
  )
$function$;