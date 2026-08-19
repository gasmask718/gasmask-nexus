CREATE TABLE public.automation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_job_id uuid NOT NULL REFERENCES public.automation_jobs(id) ON DELETE CASCADE,
  application_id uuid NOT NULL,
  funding_client_id uuid NOT NULL,
  session_owner text NOT NULL,
  owner_kind text NOT NULL DEFAULT 'worker' CHECK (owner_kind IN ('worker','operator')),
  provider text NOT NULL DEFAULT 'playwright-chromium',
  infrastructure_region text NOT NULL DEFAULT 'UNVERIFIED',
  workspace_path text,
  is_qa_fixture boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'CREATED'
    CHECK (status IN ('CREATED','RUNNING','HUMAN_CHECKPOINT','COMPLETED','FAILED','CLOSED','NEEDS_HUMAN_REVIEW')),
  outcome text,
  human_checkpoint_count integer NOT NULL DEFAULT 0,
  error_code text,
  termination_reason text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_automation_sessions_job ON public.automation_sessions(automation_job_id);
CREATE INDEX idx_automation_sessions_client ON public.automation_sessions(funding_client_id);
CREATE INDEX idx_automation_sessions_status ON public.automation_sessions(status);

-- At most one live session per job. Live = not terminal.
CREATE UNIQUE INDEX uq_automation_sessions_live_job
  ON public.automation_sessions(automation_job_id)
  WHERE status IN ('CREATED','RUNNING','HUMAN_CHECKPOINT');

GRANT SELECT, INSERT, UPDATE ON public.automation_sessions TO authenticated;
GRANT ALL ON public.automation_sessions TO service_role;

ALTER TABLE public.automation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Funding operators read automation sessions"
  ON public.automation_sessions FOR SELECT TO authenticated
  USING (public.is_funding_operator());

CREATE POLICY "Funding operators write automation sessions"
  ON public.automation_sessions FOR INSERT TO authenticated
  WITH CHECK (public.is_funding_operator());

CREATE POLICY "Funding operators update automation sessions"
  ON public.automation_sessions FOR UPDATE TO authenticated
  USING (public.is_funding_operator()) WITH CHECK (public.is_funding_operator());

-- Ownership integrity: the session's client/application must match the job's,
-- and an identity may never be re-pointed at a different client.
CREATE OR REPLACE FUNCTION public.automation_session_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  j record;
BEGIN
  SELECT application_id, client_id INTO j FROM public.automation_jobs WHERE id = NEW.automation_job_id;
  IF j IS NULL THEN
    RAISE EXCEPTION 'SESSION_JOB_NOT_FOUND';
  END IF;
  IF NEW.application_id IS DISTINCT FROM j.application_id
     OR NEW.funding_client_id IS DISTINCT FROM j.client_id THEN
    RAISE EXCEPTION 'SESSION_CLIENT_MISMATCH';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.automation_job_id IS DISTINCT FROM OLD.automation_job_id
       OR NEW.application_id IS DISTINCT FROM OLD.application_id
       OR NEW.funding_client_id IS DISTINCT FROM OLD.funding_client_id THEN
      RAISE EXCEPTION 'SESSION_REUSE_VIOLATION';
    END IF;
    IF OLD.status IN ('COMPLETED','FAILED','CLOSED')
       AND NEW.status NOT IN ('COMPLETED','FAILED','CLOSED') THEN
      RAISE EXCEPTION 'SESSION_TERMINATED_REUSE_REJECTED';
    END IF;
    NEW.updated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_automation_session_guard
  BEFORE INSERT OR UPDATE ON public.automation_sessions
  FOR EACH ROW EXECUTE FUNCTION public.automation_session_guard();