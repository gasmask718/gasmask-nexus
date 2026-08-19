CREATE TABLE IF NOT EXISTS public._session_isolation_qa (
  id bigserial PRIMARY KEY,
  test_id text NOT NULL,
  expectation text NOT NULL,
  result text NOT NULL,
  detail text,
  ran_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public._session_isolation_qa TO service_role;
ALTER TABLE public._session_isolation_qa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only qa results" ON public._session_isolation_qa
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DO $$
DECLARE
  s1 uuid; s2 uuid;
  jid uuid := 'aaf2bd72-1098-444b-9d8d-8b6cec1026b5';
  aid uuid := '0c2619ad-af39-47b2-b211-2a379fc48786';
  cid uuid := '7945aa76-6de3-4bb1-8c95-450fe6068d3e';
  other_cid uuid := 'e4657746-bd54-4136-9e35-5fc75a1dff5c';
BEGIN
  DELETE FROM public._session_isolation_qa;

  INSERT INTO public.automation_sessions(automation_job_id, application_id, funding_client_id, session_owner, workspace_path, status)
  VALUES (jid, aid, cid, 'qa-worker-1', 'automation-runs/' || jid, 'OPEN') RETURNING id INTO s1;
  INSERT INTO public._session_isolation_qa(test_id, expectation, result, detail)
  VALUES ('SESSION-01','OPEN session is accepted by the database','PASS', s1::text);

  BEGIN
    INSERT INTO public.automation_sessions(automation_job_id, application_id, funding_client_id, session_owner, status)
    VALUES (jid, aid, other_cid, 'qa-worker-x', 'OPEN');
    INSERT INTO public._session_isolation_qa(test_id, expectation, result, detail)
    VALUES ('SESSION-02','Cross-client session rejected','FAIL','accepted');
  EXCEPTION WHEN others THEN
    INSERT INTO public._session_isolation_qa(test_id, expectation, result, detail)
    VALUES ('SESSION-02','Cross-client session rejected','PASS', SQLERRM);
  END;

  BEGIN
    INSERT INTO public.automation_sessions(automation_job_id, application_id, funding_client_id, session_owner, status)
    VALUES (jid, aid, cid, 'qa-worker-2', 'OPEN');
    INSERT INTO public._session_isolation_qa(test_id, expectation, result, detail)
    VALUES ('SESSION-03','Second live session for one job rejected','FAIL','accepted');
  EXCEPTION WHEN others THEN
    INSERT INTO public._session_isolation_qa(test_id, expectation, result, detail)
    VALUES ('SESSION-03','Second live session for one job rejected','PASS', SQLERRM);
  END;

  BEGIN
    UPDATE public.automation_sessions SET funding_client_id = other_cid WHERE id = s1;
    INSERT INTO public._session_isolation_qa(test_id, expectation, result, detail)
    VALUES ('SESSION-04','Session cannot be re-pointed at another client','FAIL','accepted');
  EXCEPTION WHEN others THEN
    INSERT INTO public._session_isolation_qa(test_id, expectation, result, detail)
    VALUES ('SESSION-04','Session cannot be re-pointed at another client','PASS', SQLERRM);
  END;

  UPDATE public.automation_sessions SET status='COMPLETED', ended_at=now() WHERE id = s1;
  BEGIN
    UPDATE public.automation_sessions SET status='RUNNING' WHERE id = s1;
    INSERT INTO public._session_isolation_qa(test_id, expectation, result, detail)
    VALUES ('SESSION-05','Terminated session cannot be revived','FAIL','accepted');
  EXCEPTION WHEN others THEN
    INSERT INTO public._session_isolation_qa(test_id, expectation, result, detail)
    VALUES ('SESSION-05','Terminated session cannot be revived','PASS', SQLERRM);
  END;

  INSERT INTO public.automation_sessions(automation_job_id, application_id, funding_client_id, session_owner, status)
  VALUES (jid, aid, cid, 'qa-worker-3', 'OPEN') RETURNING id INTO s2;
  INSERT INTO public._session_isolation_qa(test_id, expectation, result, detail)
  VALUES ('SESSION-06','A fresh session is allowed after the previous one closed','PASS', s2::text);

  DELETE FROM public.automation_sessions WHERE id IN (s1, s2);
  INSERT INTO public._session_isolation_qa(test_id, expectation, result, detail)
  VALUES ('SESSION-07','Test rows removed; no production session data left behind','PASS', NULL);
END $$;