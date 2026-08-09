REVOKE SELECT (ssn_encrypted) ON public.funding_clients FROM authenticated;
REVOKE SELECT (ssn_encrypted) ON public.funding_clients FROM anon;