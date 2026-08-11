
DROP POLICY IF EXISTS automation_jobs_client_self_select ON public.automation_jobs;
CREATE POLICY automation_jobs_client_self_select
  ON public.automation_jobs FOR SELECT TO authenticated
  USING (client_id IS NOT NULL AND public.is_funding_client_self(client_id, auth.uid()));

DROP POLICY IF EXISTS automation_events_client_self_select ON public.automation_events;
CREATE POLICY automation_events_client_self_select
  ON public.automation_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.automation_jobs j
    WHERE j.id = automation_events.automation_job_id
      AND j.client_id IS NOT NULL
      AND public.is_funding_client_self(j.client_id, auth.uid())
  ));
