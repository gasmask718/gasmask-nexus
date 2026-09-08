REVOKE ALL ON FUNCTION public.icw_dispatch_job(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.icw_dispatch_job(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.icw_jobs_auto_dispatch() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.icw_category_gate(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.icw_worker_is_available(text) FROM PUBLIC, anon;