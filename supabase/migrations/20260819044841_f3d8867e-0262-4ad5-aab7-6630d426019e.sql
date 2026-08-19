-- 1. Session status vocabulary: the worker/API open a session as 'OPEN'.
ALTER TABLE public.automation_sessions DROP CONSTRAINT IF EXISTS automation_sessions_status_check;
ALTER TABLE public.automation_sessions ADD CONSTRAINT automation_sessions_status_check
  CHECK (status IN ('CREATED','OPEN','RUNNING','HUMAN_CHECKPOINT','COMPLETED','FAILED','CLOSED','NEEDS_HUMAN_REVIEW'));

-- 2. One live session per job must include 'OPEN'.
DROP INDEX IF EXISTS public.uq_automation_sessions_live_job;
CREATE UNIQUE INDEX uq_automation_sessions_live_job
  ON public.automation_sessions(automation_job_id)
  WHERE status IN ('CREATED','OPEN','RUNNING','HUMAN_CHECKPOINT');

-- 3. Sessions are written only by the backend. Operators are read-only.
DROP POLICY IF EXISTS "Funding operators write automation sessions" ON public.automation_sessions;
DROP POLICY IF EXISTS "Funding operators update automation sessions" ON public.automation_sessions;
REVOKE INSERT, UPDATE ON public.automation_sessions FROM authenticated;
GRANT SELECT ON public.automation_sessions TO authenticated;
GRANT ALL ON public.automation_sessions TO service_role;