-- QA evidence store
CREATE TABLE IF NOT EXISTS public.qa_session_isolation_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_label text NOT NULL,
  test_id text NOT NULL,
  area text NOT NULL,
  action text NOT NULL,
  expected text NOT NULL,
  actual text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.qa_session_isolation_evidence TO authenticated;
GRANT ALL ON public.qa_session_isolation_evidence TO service_role;
ALTER TABLE public.qa_session_isolation_evidence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "operators read qa evidence" ON public.qa_session_isolation_evidence;
CREATE POLICY "operators read qa evidence" ON public.qa_session_isolation_evidence
  FOR SELECT TO authenticated USING (public.is_funding_operator());

-- ---------------- fixtures ----------------
DO $fix$
DECLARE
  uid uuid;
BEGIN
  SELECT user_id INTO uid FROM public.funding_clients WHERE id = 'aaaa1111-0000-4000-8000-000000000001';
  IF uid IS NULL THEN SELECT user_id INTO uid FROM public.funding_clients WHERE user_id IS NOT NULL LIMIT 1; END IF;

  UPDATE public.funding_clients
     SET consent_signed = true, consent_signed_at = now(), is_qa_fixture = true
   WHERE id IN ('aaaa1111-0000-4000-8000-000000000001','bbbb2222-0000-4000-8000-000000000002');

  INSERT INTO public.funding_clients (id, user_id, first_name, last_name, status, is_qa_fixture, consent_signed)
  VALUES ('cccc3333-0000-4000-8000-000000000003', uid, 'QA-FIXTURE-C', 'NoConsent', 'active', true, false)
  ON CONFLICT (id) DO UPDATE SET consent_signed = false, is_qa_fixture = true;

  INSERT INTO public.funding_applications (id, client_id, lender_name, product_type, requested_amount, status)
  VALUES
    ('aaaa1111-0000-4000-8000-0000000000a2','aaaa1111-0000-4000-8000-000000000001','QA FIXTURE — Dynasty Test Lender (NOT A REAL LENDER)','QA',1000,'Preparing'),
    ('aaaa1111-0000-4000-8000-0000000000a3','aaaa1111-0000-4000-8000-000000000001','QA FIXTURE — Dynasty Test Lender (NOT A REAL LENDER)','QA',1000,'Preparing'),
    ('aaaa1111-0000-4000-8000-0000000000a4','aaaa1111-0000-4000-8000-000000000001','QA FIXTURE — Dynasty Test Lender (NOT A REAL LENDER)','QA',1000,'Preparing'),
    ('bbbb2222-0000-4000-8000-0000000000b2','bbbb2222-0000-4000-8000-000000000002','QA FIXTURE — Dynasty Test Lender (NOT A REAL LENDER)','QA',1000,'Preparing'),
    ('cccc3333-0000-4000-8000-0000000000c1','cccc3333-0000-4000-8000-000000000003','QA FIXTURE — Dynasty Test Lender (NOT A REAL LENDER)','QA',1000,'Preparing')
  ON CONFLICT (id) DO NOTHING;

  DELETE FROM public.automation_jobs WHERE id IN (
    'aaaa1111-0000-4000-8000-00000000ab0a','bbbb2222-0000-4000-8000-00000000ab0b',
    'cccc3333-0000-4000-8000-00000000ab0c','aaaa1111-0000-4000-8000-00000000ab0d',
    'aaaa1111-0000-4000-8000-00000000ab0e');

  INSERT INTO public.automation_jobs (id, application_id, client_id, lender_id, lender_name, adapter_key, submission_method, status, idempotency_key)
  VALUES
    ('aaaa1111-0000-4000-8000-00000000ab0a','aaaa1111-0000-4000-8000-0000000000a2','aaaa1111-0000-4000-8000-000000000001','06a6703e-0111-4a23-95cc-3d956bef7e01','QA FIXTURE — Dynasty Test Lender (NOT A REAL LENDER)','generic_form','browser','STARTING','qa-iso-A'),
    ('bbbb2222-0000-4000-8000-00000000ab0b','bbbb2222-0000-4000-8000-0000000000b2','bbbb2222-0000-4000-8000-000000000002','06a6703e-0111-4a23-95cc-3d956bef7e01','QA FIXTURE — Dynasty Test Lender (NOT A REAL LENDER)','generic_form','browser','STARTING','qa-iso-B'),
    ('cccc3333-0000-4000-8000-00000000ab0c','cccc3333-0000-4000-8000-0000000000c1','cccc3333-0000-4000-8000-000000000003','06a6703e-0111-4a23-95cc-3d956bef7e01','QA FIXTURE — Dynasty Test Lender (NOT A REAL LENDER)','generic_form','browser','STARTING','qa-iso-C'),
    ('aaaa1111-0000-4000-8000-00000000ab0d','aaaa1111-0000-4000-8000-0000000000a3','aaaa1111-0000-4000-8000-000000000001','06a6703e-0111-4a23-95cc-3d956bef7e01','QA FIXTURE — Dynasty Test Lender (NOT A REAL LENDER)','generic_form','browser','QUEUED','qa-iso-D'),
    ('aaaa1111-0000-4000-8000-00000000ab0e','aaaa1111-0000-4000-8000-0000000000a4','aaaa1111-0000-4000-8000-000000000001','06a6703e-0111-4a23-95cc-3d956bef7e01','QA FIXTURE — Dynasty Test Lender (NOT A REAL LENDER)','generic_form','browser','STARTING','qa-iso-E');
END $fix$;

-- ---------------- baseline database-layer tests ----------------
DO $qa$
DECLARE
  run text := 'BASELINE-2026-08-19';
  err text;
  sid uuid;
  JOB_A uuid := 'aaaa1111-0000-4000-8000-00000000ab0a';
  JOB_B uuid := 'bbbb2222-0000-4000-8000-00000000ab0b';
  APP_A uuid := 'aaaa1111-0000-4000-8000-0000000000a2';
  APP_B uuid := 'bbbb2222-0000-4000-8000-0000000000b2';
  CLI_A uuid := 'aaaa1111-0000-4000-8000-000000000001';
  CLI_B uuid := 'bbbb2222-0000-4000-8000-000000000002';
BEGIN
  DELETE FROM public.qa_session_isolation_evidence WHERE run_label = run;

  -- OWN-01 valid session
  BEGIN
    INSERT INTO public.automation_sessions (automation_job_id, application_id, funding_client_id, session_owner, status)
    VALUES (JOB_A, APP_A, CLI_A, 'qa-worker', 'OPEN') RETURNING id INTO sid;
    err := NULL;
  EXCEPTION WHEN others THEN err := SQLERRM; END;
  INSERT INTO public.qa_session_isolation_evidence VALUES (gen_random_uuid(), run, 'OWN-01','ownership','insert session matching job/app/client','accepted',
    COALESCE('rejected: '||err,'accepted'), CASE WHEN err IS NULL THEN 'PASS' ELSE 'FAIL' END);

  -- OWN-02 job A session pointed at client B
  BEGIN
    INSERT INTO public.automation_sessions (automation_job_id, application_id, funding_client_id, session_owner, status)
    VALUES (JOB_B, APP_B, CLI_A, 'qa-worker', 'OPEN');
    err := 'ACCEPTED';
  EXCEPTION WHEN others THEN err := SQLERRM; END;
  INSERT INTO public.qa_session_isolation_evidence VALUES (gen_random_uuid(), run, 'OWN-02','ownership','session for job B carrying client A','SESSION_CLIENT_MISMATCH', err,
    CASE WHEN err = 'SESSION_CLIENT_MISMATCH' THEN 'PASS' ELSE 'FAIL' END);

  -- OWN-03 application from another client
  BEGIN
    INSERT INTO public.automation_sessions (automation_job_id, application_id, funding_client_id, session_owner, status)
    VALUES (JOB_B, APP_A, CLI_B, 'qa-worker', 'OPEN');
    err := 'ACCEPTED';
  EXCEPTION WHEN others THEN err := SQLERRM; END;
  INSERT INTO public.qa_session_isolation_evidence VALUES (gen_random_uuid(), run, 'OWN-03','ownership','session for job B carrying application A','SESSION_CLIENT_MISMATCH', err,
    CASE WHEN err = 'SESSION_CLIENT_MISMATCH' THEN 'PASS' ELSE 'FAIL' END);

  -- OWN-04 reassign an existing session to another job
  BEGIN
    UPDATE public.automation_sessions SET automation_job_id = JOB_B WHERE id = sid;
    err := 'ACCEPTED';
  EXCEPTION WHEN others THEN err := SQLERRM; END;
  INSERT INTO public.qa_session_isolation_evidence VALUES (gen_random_uuid(), run, 'OWN-04','ownership','repoint live session at job B','SESSION_REUSE_VIOLATION', err,
    CASE WHEN err = 'SESSION_REUSE_VIOLATION' THEN 'PASS' ELSE 'FAIL' END);

  -- OWN-05 mutate owning client on an existing session
  BEGIN
    UPDATE public.automation_sessions SET funding_client_id = CLI_B WHERE id = sid;
    err := 'ACCEPTED';
  EXCEPTION WHEN others THEN err := SQLERRM; END;
  INSERT INTO public.qa_session_isolation_evidence VALUES (gen_random_uuid(), run, 'OWN-05','ownership','rewrite session owning client','SESSION_CLIENT_MISMATCH or SESSION_REUSE_VIOLATION', err,
    CASE WHEN err IN ('SESSION_CLIENT_MISMATCH','SESSION_REUSE_VIOLATION') THEN 'PASS' ELSE 'FAIL' END);

  -- OWN-07 duplicate live session for the same job
  BEGIN
    INSERT INTO public.automation_sessions (automation_job_id, application_id, funding_client_id, session_owner, status)
    VALUES (JOB_A, APP_A, CLI_A, 'qa-worker-2', 'OPEN');
    err := 'ACCEPTED';
  EXCEPTION WHEN unique_violation THEN err := 'UNIQUE_VIOLATION';
           WHEN others THEN err := SQLERRM; END;
  INSERT INTO public.qa_session_isolation_evidence VALUES (gen_random_uuid(), run, 'OWN-07','ownership','second live session for job A','UNIQUE_VIOLATION', err,
    CASE WHEN err = 'UNIQUE_VIOLATION' THEN 'PASS' ELSE 'FAIL' END);

  -- LIFE-01 CREATED -> OPEN -> RUNNING
  BEGIN
    UPDATE public.automation_sessions SET status = 'RUNNING' WHERE id = sid; err := NULL;
  EXCEPTION WHEN others THEN err := SQLERRM; END;
  INSERT INTO public.qa_session_isolation_evidence VALUES (gen_random_uuid(), run, 'LIFE-01','lifecycle','OPEN -> RUNNING','allowed', COALESCE('rejected: '||err,'allowed'),
    CASE WHEN err IS NULL THEN 'PASS' ELSE 'FAIL' END);

  -- LIFE-02 RUNNING -> HUMAN_CHECKPOINT
  BEGIN
    UPDATE public.automation_sessions SET status = 'HUMAN_CHECKPOINT' WHERE id = sid; err := NULL;
  EXCEPTION WHEN others THEN err := SQLERRM; END;
  INSERT INTO public.qa_session_isolation_evidence VALUES (gen_random_uuid(), run, 'LIFE-02','lifecycle','RUNNING -> HUMAN_CHECKPOINT','allowed', COALESCE('rejected: '||err,'allowed'),
    CASE WHEN err IS NULL THEN 'PASS' ELSE 'FAIL' END);

  -- LIFE-03 HUMAN_CHECKPOINT -> RUNNING (automation must NOT resume itself)
  BEGIN
    UPDATE public.automation_sessions SET status = 'RUNNING' WHERE id = sid; err := 'ACCEPTED';
  EXCEPTION WHEN others THEN err := SQLERRM; END;
  INSERT INTO public.qa_session_isolation_evidence VALUES (gen_random_uuid(), run, 'LIFE-03','lifecycle','HUMAN_CHECKPOINT -> RUNNING','SESSION_CHECKPOINT_RESUME_REJECTED', err,
    CASE WHEN err = 'ACCEPTED' THEN 'FAIL' ELSE 'PASS' END);

  -- LIFE-04 terminal close then revival
  UPDATE public.automation_sessions SET status = 'COMPLETED', ended_at = now() WHERE id = sid;
  BEGIN
    UPDATE public.automation_sessions SET status = 'RUNNING' WHERE id = sid; err := 'ACCEPTED';
  EXCEPTION WHEN others THEN err := SQLERRM; END;
  INSERT INTO public.qa_session_isolation_evidence VALUES (gen_random_uuid(), run, 'OWN-06','lifecycle','revive COMPLETED session','SESSION_TERMINATED_REUSE_REJECTED', err,
    CASE WHEN err = 'SESSION_TERMINATED_REUSE_REJECTED' THEN 'PASS' ELSE 'FAIL' END);

  -- LIFE-05 after terminal close a NEW isolated session is allowed
  BEGIN
    INSERT INTO public.automation_sessions (automation_job_id, application_id, funding_client_id, session_owner, status)
    VALUES (JOB_A, APP_A, CLI_A, 'qa-worker-retry', 'OPEN');
    err := NULL;
  EXCEPTION WHEN others THEN err := SQLERRM; END;
  INSERT INTO public.qa_session_isolation_evidence VALUES (gen_random_uuid(), run, 'REAPER-05','lifecycle','new session after terminal close','allowed', COALESCE('rejected: '||err,'allowed'),
    CASE WHEN err IS NULL THEN 'PASS' ELSE 'FAIL' END);

  -- JOB-01 illegal job transition COMPLETED -> QUEUED
  BEGIN
    UPDATE public.automation_jobs SET status = 'QUEUED' WHERE id = '6dd95db5-e98c-4a7d-88ce-52b8434e1be3'; err := 'ACCEPTED';
  EXCEPTION WHEN others THEN err := SQLERRM; END;
  INSERT INTO public.qa_session_isolation_evidence VALUES (gen_random_uuid(), run, 'JOB-01','job lifecycle','COMPLETED -> QUEUED','rejected', err,
    CASE WHEN err <> 'ACCEPTED' THEN 'PASS' ELSE 'FAIL' END);

  -- JOB-02 illegal job transition HUMAN_CHECKPOINT -> COMPLETED
  BEGIN
    UPDATE public.automation_jobs SET status = 'HUMAN_CHECKPOINT' WHERE id = JOB_A;
    UPDATE public.automation_jobs SET status = 'COMPLETED' WHERE id = JOB_A; err := 'ACCEPTED';
  EXCEPTION WHEN others THEN err := SQLERRM; END;
  INSERT INTO public.qa_session_isolation_evidence VALUES (gen_random_uuid(), run, 'JOB-02','job lifecycle','HUMAN_CHECKPOINT -> COMPLETED','rejected', err,
    CASE WHEN err <> 'ACCEPTED' THEN 'PASS' ELSE 'FAIL' END);

  -- JOB-03 second open job for the same application
  BEGIN
    INSERT INTO public.automation_jobs (application_id, client_id, lender_name, adapter_key, submission_method, status, idempotency_key)
    VALUES (APP_B, CLI_B, 'QA FIXTURE — Dynasty Test Lender (NOT A REAL LENDER)','generic_form','browser','CREATED','qa-iso-dup');
    err := 'ACCEPTED';
  EXCEPTION WHEN unique_violation THEN err := 'UNIQUE_VIOLATION';
           WHEN others THEN err := SQLERRM; END;
  INSERT INTO public.qa_session_isolation_evidence VALUES (gen_random_uuid(), run, 'JOB-03','job lifecycle','duplicate open job per application','UNIQUE_VIOLATION', err,
    CASE WHEN err = 'UNIQUE_VIOLATION' THEN 'PASS' ELSE 'FAIL' END);

  -- restore job A so API tests can run against it
  UPDATE public.automation_jobs SET status = 'NEEDS_HUMAN_REVIEW' WHERE id = JOB_A AND status = 'HUMAN_CHECKPOINT';
  UPDATE public.automation_sessions SET status = 'CLOSED', ended_at = now()
   WHERE automation_job_id = JOB_A AND status IN ('CREATED','OPEN','RUNNING','HUMAN_CHECKPOINT');
  UPDATE public.automation_jobs SET status = 'QUEUED' WHERE id = JOB_A AND status = 'NEEDS_HUMAN_REVIEW';
  UPDATE public.automation_jobs SET status = 'STARTING' WHERE id = JOB_A AND status = 'QUEUED';
END $qa$;

-- GRANT-01 evidence: record the current privilege surface of automation_sessions
INSERT INTO public.qa_session_isolation_evidence (run_label, test_id, area, action, expected, actual, status)
SELECT 'BASELINE-2026-08-19','GRANT-01','database','privileges granted to anon on automation_sessions','none',
       COALESCE(string_agg(privilege_type, ','), 'none'),
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name='automation_sessions' AND grantee='anon';

INSERT INTO public.qa_session_isolation_evidence (run_label, test_id, area, action, expected, actual, status)
SELECT 'BASELINE-2026-08-19','GRANT-02','database','write privileges granted to authenticated on automation_sessions','SELECT only',
       COALESCE(string_agg(privilege_type, ','), 'none'),
       CASE WHEN count(*) FILTER (WHERE privilege_type <> 'SELECT') = 0 THEN 'PASS' ELSE 'FAIL' END
FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name='automation_sessions' AND grantee='authenticated';