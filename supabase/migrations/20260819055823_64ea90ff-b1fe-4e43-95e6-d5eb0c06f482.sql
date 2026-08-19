-- 1. Privilege surface: sessions are backend-written, operator-readable only.
REVOKE ALL ON public.automation_sessions FROM anon;
REVOKE ALL ON public.automation_sessions FROM authenticated;
GRANT SELECT ON public.automation_sessions TO authenticated;
GRANT ALL ON public.automation_sessions TO service_role;

-- 2. Safety halts must be recordable.
ALTER TABLE public.automation_jobs DROP CONSTRAINT IF EXISTS automation_jobs_failure_class_check;
ALTER TABLE public.automation_jobs ADD CONSTRAINT automation_jobs_failure_class_check CHECK (
  failure_class IS NULL OR failure_class = ANY (ARRAY[
    'NETWORK_ERROR','API_TIMEOUT','BROWSER_CRASH','CAPTCHA','BOT_BLOCK','INVALID_CLIENT_DATA',
    'IDENTITY_VERIFICATION','FINAL_CERTIFICATION','MISSING_DOCUMENT','LENDER_ERROR','UNKNOWN',
    'SESSION_CLIENT_MISMATCH','SESSION_REUSE_VIOLATION','SESSION_TERMINATED_REUSE_REJECTED',
    'SESSION_ISOLATION_VIOLATION','CLIENT_CONSENT_REQUIRED','CLIENT_CONSENT_REVOKED',
    'QA_FIXTURE_CONTAINMENT','LENDER_NOT_AUTHORIZED','WORKER_LEASE_EXPIRED',
    'WORKSPACE_PURGE_FAILED','CHECKPOINT_WRITE_FAILED'
  ])
);

-- 3. Session guard: correct violation codes, no self-resume past a human
--    checkpoint, and full immutability once terminal.
CREATE OR REPLACE FUNCTION public.automation_session_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  j record;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Ownership fields are immutable for the whole life of the session.
    IF NEW.automation_job_id IS DISTINCT FROM OLD.automation_job_id
       OR NEW.application_id IS DISTINCT FROM OLD.application_id
       OR NEW.funding_client_id IS DISTINCT FROM OLD.funding_client_id THEN
      RAISE EXCEPTION 'SESSION_REUSE_VIOLATION';
    END IF;
    -- A finished session is evidence: it is never reopened, re-closed or edited.
    IF OLD.status IN ('COMPLETED','FAILED','CLOSED','NEEDS_HUMAN_REVIEW') THEN
      RAISE EXCEPTION 'SESSION_TERMINATED_REUSE_REJECTED';
    END IF;
    -- Automation never resumes itself past a human checkpoint.
    IF OLD.status = 'HUMAN_CHECKPOINT'
       AND NEW.status NOT IN ('HUMAN_CHECKPOINT','COMPLETED','FAILED','CLOSED','NEEDS_HUMAN_REVIEW') THEN
      RAISE EXCEPTION 'SESSION_CHECKPOINT_RESUME_REJECTED';
    END IF;
    NEW.updated_at := now();
  END IF;

  SELECT application_id, client_id INTO j FROM public.automation_jobs WHERE id = NEW.automation_job_id;
  IF j IS NULL THEN
    RAISE EXCEPTION 'SESSION_JOB_NOT_FOUND';
  END IF;
  IF NEW.application_id IS DISTINCT FROM j.application_id
     OR NEW.funding_client_id IS DISTINCT FROM j.client_id THEN
    RAISE EXCEPTION 'SESSION_CLIENT_MISMATCH';
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. Re-run the suite after the fixes.
DO $qa$
DECLARE
  run text := 'POSTFIX-2026-08-19';
  err text; sid uuid;
  JOB_A uuid := 'aaaa1111-0000-4000-8000-00000000ab0a';
  JOB_B uuid := 'bbbb2222-0000-4000-8000-00000000ab0b';
  APP_A uuid := 'aaaa1111-0000-4000-8000-0000000000a2';
  APP_B uuid := 'bbbb2222-0000-4000-8000-0000000000b2';
  CLI_A uuid := 'aaaa1111-0000-4000-8000-000000000001';
  CLI_B uuid := 'bbbb2222-0000-4000-8000-000000000002';
BEGIN
  DELETE FROM public.qa_session_isolation_evidence WHERE run_label = run;
  UPDATE public.automation_sessions SET status='CLOSED', ended_at=now()
   WHERE automation_job_id IN (JOB_A, JOB_B) AND status IN ('CREATED','OPEN','RUNNING','HUMAN_CHECKPOINT');

  BEGIN
    INSERT INTO public.automation_sessions (automation_job_id, application_id, funding_client_id, session_owner, status)
    VALUES (JOB_A, APP_A, CLI_A, 'qa-worker', 'OPEN') RETURNING id INTO sid; err := NULL;
  EXCEPTION WHEN others THEN err := SQLERRM; END;
  INSERT INTO public.qa_session_isolation_evidence VALUES (gen_random_uuid(), run,'OWN-01','ownership','session matching job/app/client','accepted',COALESCE('rejected: '||err,'accepted'),CASE WHEN err IS NULL THEN 'PASS' ELSE 'FAIL' END);

  BEGIN
    INSERT INTO public.automation_sessions (automation_job_id, application_id, funding_client_id, session_owner, status)
    VALUES (JOB_B, APP_B, CLI_A, 'qa', 'OPEN'); err := 'ACCEPTED';
  EXCEPTION WHEN others THEN err := SQLERRM; END;
  INSERT INTO public.qa_session_isolation_evidence VALUES (gen_random_uuid(), run,'OWN-02','ownership','job B session carrying client A','SESSION_CLIENT_MISMATCH',err,CASE WHEN err='SESSION_CLIENT_MISMATCH' THEN 'PASS' ELSE 'FAIL' END);

  BEGIN
    INSERT INTO public.automation_sessions (automation_job_id, application_id, funding_client_id, session_owner, status)
    VALUES (JOB_B, APP_A, CLI_B, 'qa', 'OPEN'); err := 'ACCEPTED';
  EXCEPTION WHEN others THEN err := SQLERRM; END;
  INSERT INTO public.qa_session_isolation_evidence VALUES (gen_random_uuid(), run,'OWN-03','ownership','job B session carrying application A','SESSION_CLIENT_MISMATCH',err,CASE WHEN err='SESSION_CLIENT_MISMATCH' THEN 'PASS' ELSE 'FAIL' END);

  BEGIN
    UPDATE public.automation_sessions SET automation_job_id = JOB_B WHERE id = sid; err := 'ACCEPTED';
  EXCEPTION WHEN others THEN err := SQLERRM; END;
  INSERT INTO public.qa_session_isolation_evidence VALUES (gen_random_uuid(), run,'OWN-04','ownership','repoint live session at job B','SESSION_REUSE_VIOLATION',err,CASE WHEN err='SESSION_REUSE_VIOLATION' THEN 'PASS' ELSE 'FAIL' END);

  BEGIN
    UPDATE public.automation_sessions SET funding_client_id = CLI_B WHERE id = sid; err := 'ACCEPTED';
  EXCEPTION WHEN others THEN err := SQLERRM; END;
  INSERT INTO public.qa_session_isolation_evidence VALUES (gen_random_uuid(), run,'OWN-05','ownership','rewrite session owning client','SESSION_REUSE_VIOLATION',err,CASE WHEN err='SESSION_REUSE_VIOLATION' THEN 'PASS' ELSE 'FAIL' END);

  BEGIN
    INSERT INTO public.automation_sessions (automation_job_id, application_id, funding_client_id, session_owner, status)
    VALUES (JOB_A, APP_A, CLI_A, 'qa2', 'OPEN'); err := 'ACCEPTED';
  EXCEPTION WHEN unique_violation THEN err := 'UNIQUE_VIOLATION'; WHEN others THEN err := SQLERRM; END;
  INSERT INTO public.qa_session_isolation_evidence VALUES (gen_random_uuid(), run,'OWN-07','ownership','second live session for job A','UNIQUE_VIOLATION',err,CASE WHEN err='UNIQUE_VIOLATION' THEN 'PASS' ELSE 'FAIL' END);

  BEGIN UPDATE public.automation_sessions SET status='RUNNING' WHERE id=sid; err := NULL;
  EXCEPTION WHEN others THEN err := SQLERRM; END;
  INSERT INTO public.qa_session_isolation_evidence VALUES (gen_random_uuid(), run,'LIFE-01','lifecycle','OPEN -> RUNNING','allowed',COALESCE('rejected: '||err,'allowed'),CASE WHEN err IS NULL THEN 'PASS' ELSE 'FAIL' END);

  BEGIN UPDATE public.automation_sessions SET status='HUMAN_CHECKPOINT' WHERE id=sid; err := NULL;
  EXCEPTION WHEN others THEN err := SQLERRM; END;
  INSERT INTO public.qa_session_isolation_evidence VALUES (gen_random_uuid(), run,'LIFE-02','lifecycle','RUNNING -> HUMAN_CHECKPOINT','allowed',COALESCE('rejected: '||err,'allowed'),CASE WHEN err IS NULL THEN 'PASS' ELSE 'FAIL' END);

  BEGIN UPDATE public.automation_sessions SET status='RUNNING' WHERE id=sid; err := 'ACCEPTED';
  EXCEPTION WHEN others THEN err := SQLERRM; END;
  INSERT INTO public.qa_session_isolation_evidence VALUES (gen_random_uuid(), run,'LIFE-03','lifecycle','HUMAN_CHECKPOINT -> RUNNING','SESSION_CHECKPOINT_RESUME_REJECTED',err,CASE WHEN err='SESSION_CHECKPOINT_RESUME_REJECTED' THEN 'PASS' ELSE 'FAIL' END);

  BEGIN UPDATE public.automation_sessions SET status='COMPLETED', ended_at=now() WHERE id=sid; err := NULL;
  EXCEPTION WHEN others THEN err := SQLERRM; END;
  INSERT INTO public.qa_session_isolation_evidence VALUES (gen_random_uuid(), run,'LIFE-04','lifecycle','HUMAN_CHECKPOINT -> COMPLETED','allowed',COALESCE('rejected: '||err,'allowed'),CASE WHEN err IS NULL THEN 'PASS' ELSE 'FAIL' END);

  BEGIN UPDATE public.automation_sessions SET status='RUNNING' WHERE id=sid; err := 'ACCEPTED';
  EXCEPTION WHEN others THEN err := SQLERRM; END;
  INSERT INTO public.qa_session_isolation_evidence VALUES (gen_random_uuid(), run,'OWN-06','lifecycle','revive COMPLETED session','SESSION_TERMINATED_REUSE_REJECTED',err,CASE WHEN err='SESSION_TERMINATED_REUSE_REJECTED' THEN 'PASS' ELSE 'FAIL' END);

  BEGIN UPDATE public.automation_sessions SET termination_reason='rewritten by attacker' WHERE id=sid; err := 'ACCEPTED';
  EXCEPTION WHEN others THEN err := SQLERRM; END;
  INSERT INTO public.qa_session_isolation_evidence VALUES (gen_random_uuid(), run,'AUDIT-01','audit integrity','rewrite a closed session record','SESSION_TERMINATED_REUSE_REJECTED',err,CASE WHEN err='SESSION_TERMINATED_REUSE_REJECTED' THEN 'PASS' ELSE 'FAIL' END);

  BEGIN
    INSERT INTO public.automation_sessions (automation_job_id, application_id, funding_client_id, session_owner, status)
    VALUES (JOB_A, APP_A, CLI_A, 'qa-retry', 'OPEN'); err := NULL;
  EXCEPTION WHEN others THEN err := SQLERRM; END;
  INSERT INTO public.qa_session_isolation_evidence VALUES (gen_random_uuid(), run,'REAPER-05','lifecycle','new session after terminal close','allowed',COALESCE('rejected: '||err,'allowed'),CASE WHEN err IS NULL THEN 'PASS' ELSE 'FAIL' END);

  BEGIN UPDATE public.automation_jobs SET status='BLOCKED', failure_class='CLIENT_CONSENT_REQUIRED', failure_reason='qa' WHERE id=JOB_B; err := NULL;
  EXCEPTION WHEN others THEN err := SQLERRM; END;
  INSERT INTO public.qa_session_isolation_evidence VALUES (gen_random_uuid(), run,'HALT-01','consent','record a CLIENT_CONSENT_REQUIRED halt on a job','allowed',COALESCE('rejected: '||err,'allowed'),CASE WHEN err IS NULL THEN 'PASS' ELSE 'FAIL' END);

  BEGIN UPDATE public.automation_jobs SET status='QUEUED' WHERE id='6dd95db5-e98c-4a7d-88ce-52b8434e1be3'; err := 'ACCEPTED';
  EXCEPTION WHEN others THEN err := SQLERRM; END;
  INSERT INTO public.qa_session_isolation_evidence VALUES (gen_random_uuid(), run,'JOB-01','job lifecycle','COMPLETED -> QUEUED','rejected',err,CASE WHEN err<>'ACCEPTED' THEN 'PASS' ELSE 'FAIL' END);

  -- leave fixture jobs in a claimable state for the API test pass
  UPDATE public.automation_sessions SET status='CLOSED', ended_at=now()
   WHERE automation_job_id IN (JOB_A, JOB_B) AND status IN ('CREATED','OPEN','RUNNING','HUMAN_CHECKPOINT');
  UPDATE public.automation_jobs SET status='NEEDS_HUMAN_REVIEW', failure_class=NULL, failure_reason=NULL WHERE id=JOB_B;
  UPDATE public.automation_jobs SET status='QUEUED' WHERE id=JOB_B;
  UPDATE public.automation_jobs SET status='STARTING' WHERE id=JOB_B;
END $qa$;

INSERT INTO public.qa_session_isolation_evidence (run_label, test_id, area, action, expected, actual, status)
SELECT 'POSTFIX-2026-08-19','GRANT-01','database','privileges granted to anon on automation_sessions','none',
       COALESCE(string_agg(privilege_type, ','), 'none'),
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name='automation_sessions' AND grantee='anon';

INSERT INTO public.qa_session_isolation_evidence (run_label, test_id, area, action, expected, actual, status)
SELECT 'POSTFIX-2026-08-19','GRANT-02','database','privileges granted to authenticated on automation_sessions','SELECT only',
       COALESCE(string_agg(privilege_type, ','), 'none'),
       CASE WHEN count(*) FILTER (WHERE privilege_type <> 'SELECT') = 0 AND count(*) > 0 THEN 'PASS' ELSE 'FAIL' END
FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name='automation_sessions' AND grantee='authenticated';