
-- 1. raw_scraper_leads
REVOKE ALL ON public.raw_scraper_leads FROM anon;
GRANT ALL ON public.raw_scraper_leads TO service_role;
GRANT SELECT ON public.raw_scraper_leads TO authenticated;
ALTER TABLE public.raw_scraper_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "raw_scraper_leads_select_elevated" ON public.raw_scraper_leads;
CREATE POLICY "raw_scraper_leads_select_elevated" ON public.raw_scraper_leads
  FOR SELECT TO authenticated USING (public.is_elevated_user());

-- 2. raw_scraper_leads_flagged
REVOKE ALL ON public.raw_scraper_leads_flagged FROM anon;
GRANT ALL ON public.raw_scraper_leads_flagged TO service_role;
GRANT SELECT ON public.raw_scraper_leads_flagged TO authenticated;
ALTER TABLE public.raw_scraper_leads_flagged ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "raw_scraper_leads_flagged_select_elevated" ON public.raw_scraper_leads_flagged;
CREATE POLICY "raw_scraper_leads_flagged_select_elevated" ON public.raw_scraper_leads_flagged
  FOR SELECT TO authenticated USING (public.is_elevated_user());

-- 3. scraper_runs
REVOKE ALL ON public.scraper_runs FROM anon;
GRANT ALL ON public.scraper_runs TO service_role;
GRANT SELECT ON public.scraper_runs TO authenticated;
ALTER TABLE public.scraper_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scraper_runs_select_staff" ON public.scraper_runs;
CREATE POLICY "scraper_runs_select_staff" ON public.scraper_runs
  FOR SELECT TO authenticated USING (public.is_internal_staff());

-- 4. scraper_state
REVOKE ALL ON public.scraper_state FROM anon;
GRANT ALL ON public.scraper_state TO service_role;
GRANT SELECT ON public.scraper_state TO authenticated;
ALTER TABLE public.scraper_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scraper_state_select_staff" ON public.scraper_state;
CREATE POLICY "scraper_state_select_staff" ON public.scraper_state
  FOR SELECT TO authenticated USING (public.is_internal_staff());

-- 5. _batch_run_results
REVOKE ALL ON public._batch_run_results FROM anon;
GRANT ALL ON public._batch_run_results TO service_role;
GRANT SELECT ON public._batch_run_results TO authenticated;
ALTER TABLE public._batch_run_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "batch_run_results_select_elevated" ON public._batch_run_results;
CREATE POLICY "batch_run_results_select_elevated" ON public._batch_run_results
  FOR SELECT TO authenticated USING (public.is_elevated_user());

-- 6. ut_api_budget (widened to plain authenticated per operator-safety decision)
REVOKE ALL ON public.ut_api_budget FROM anon;
GRANT ALL ON public.ut_api_budget TO service_role;
GRANT SELECT, UPDATE ON public.ut_api_budget TO authenticated;
ALTER TABLE public.ut_api_budget ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ut_api_budget_select_auth" ON public.ut_api_budget;
DROP POLICY IF EXISTS "ut_api_budget_update_auth" ON public.ut_api_budget;
CREATE POLICY "ut_api_budget_select_auth" ON public.ut_api_budget
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ut_api_budget_update_auth" ON public.ut_api_budget
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 7. ut_api_usage_log (widened to plain authenticated)
REVOKE ALL ON public.ut_api_usage_log FROM anon;
GRANT ALL ON public.ut_api_usage_log TO service_role;
GRANT SELECT ON public.ut_api_usage_log TO authenticated;
ALTER TABLE public.ut_api_usage_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ut_api_usage_log_select_auth" ON public.ut_api_usage_log;
CREATE POLICY "ut_api_usage_log_select_auth" ON public.ut_api_usage_log
  FOR SELECT TO authenticated USING (true);

-- 8. ut_partner_categories
REVOKE ALL ON public.ut_partner_categories FROM anon;
GRANT ALL ON public.ut_partner_categories TO service_role;
GRANT SELECT ON public.ut_partner_categories TO authenticated;
ALTER TABLE public.ut_partner_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ut_partner_categories_select_auth" ON public.ut_partner_categories;
CREATE POLICY "ut_partner_categories_select_auth" ON public.ut_partner_categories
  FOR SELECT TO authenticated USING (true);
