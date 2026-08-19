-- Automation tables: signed-in users need read/operator DML (already RLS-gated),
-- but never the ability to attach triggers or foreign keys to audit surfaces.
REVOKE TRIGGER, REFERENCES ON public.automation_jobs FROM authenticated;
REVOKE TRIGGER, REFERENCES ON public.automation_sessions FROM authenticated;
REVOKE TRIGGER, REFERENCES ON public.automation_events FROM authenticated;
REVOKE TRIGGER, REFERENCES ON public.automation_checkpoints FROM authenticated;

REVOKE ALL ON public.automation_jobs FROM anon;
REVOKE ALL ON public.automation_sessions FROM anon;
REVOKE ALL ON public.automation_events FROM anon;
REVOKE ALL ON public.automation_checkpoints FROM anon;

GRANT ALL ON public.automation_jobs TO service_role;
GRANT ALL ON public.automation_sessions TO service_role;
GRANT ALL ON public.automation_events TO service_role;
GRANT ALL ON public.automation_checkpoints TO service_role;