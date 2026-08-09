REVOKE ALL ON public.funding_clients FROM anon;
REVOKE ALL ON public.funding_client_documents FROM anon;
REVOKE ALL ON public.funding_application_profile FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.funding_clients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.funding_client_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.funding_application_profile TO authenticated;
GRANT ALL ON public.funding_clients TO service_role;
GRANT ALL ON public.funding_client_documents TO service_role;
GRANT ALL ON public.funding_application_profile TO service_role;