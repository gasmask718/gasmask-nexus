
DROP FUNCTION IF EXISTS public.debug_auth();

CREATE FUNCTION public.debug_auth()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'role', current_setting('role', true),
    'request_role', current_setting('request.jwt.claim.role', true),
    'uid', auth.uid(),
    'jwt', auth.jwt(),
    'now', now()
  );
$$;

GRANT EXECUTE ON FUNCTION public.debug_auth() TO anon, authenticated, service_role;
