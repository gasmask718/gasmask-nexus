REVOKE ALL ON public.automation_jobs FROM anon;
REVOKE ALL ON public.automation_events FROM anon;
REVOKE ALL ON public.automation_checkpoints FROM anon;
REVOKE ALL ON public.automation_field_mappings FROM anon;
REVOKE ALL ON public.lender_automation_config FROM anon;

-- Audit trail is append-only; jobs are cancelled, never deleted.
REVOKE UPDATE, DELETE, TRUNCATE ON public.automation_events FROM authenticated;
REVOKE DELETE, TRUNCATE ON public.automation_jobs FROM authenticated;
REVOKE DELETE, TRUNCATE ON public.automation_checkpoints FROM authenticated;
REVOKE TRUNCATE ON public.automation_field_mappings FROM authenticated;
REVOKE TRUNCATE ON public.lender_automation_config FROM authenticated;