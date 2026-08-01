DROP POLICY IF EXISTS "Authenticated users can create jobs" ON public.sbo_analysis_jobs;

CREATE POLICY operator_insert_sbo_analysis_jobs
  ON public.sbo_analysis_jobs FOR INSERT TO authenticated
  WITH CHECK (public.is_sbo_operator() AND (user_id IS NULL OR user_id = auth.uid()));

CREATE POLICY operator_update_sbo_analysis_jobs
  ON public.sbo_analysis_jobs FOR UPDATE TO authenticated
  USING (public.is_sbo_operator()) WITH CHECK (public.is_sbo_operator());

CREATE POLICY operator_delete_sbo_analysis_jobs
  ON public.sbo_analysis_jobs FOR DELETE TO authenticated
  USING (public.is_sbo_operator());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sbo_analysis_jobs TO authenticated;
GRANT ALL ON public.sbo_analysis_jobs TO service_role;