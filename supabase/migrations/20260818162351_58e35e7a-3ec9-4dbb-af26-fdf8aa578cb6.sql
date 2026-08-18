REVOKE EXECUTE ON FUNCTION public.handle_sms_opt_out(text, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_sms_opt_in(text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.handle_sms_opt_out(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_sms_opt_in(text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.normalize_phone_e164(text) FROM anon;