-- ============================================================
-- SECTION 16 SECURITY AUDIT — RLS HARDENING
-- Idempotent: safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- TASK 2: grant_opportunities  (FAIL -> PASS)
-- Was: single ALL policy for authenticated (over-permissive).
-- Now: authenticated SELECT only; write operations gated to admins;
--      service_role has full access.
-- Preserves: admin "Add Opportunity" UI in GrantOpportunities.tsx.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "auth all" ON public.grant_opportunities;
DROP POLICY IF EXISTS "grant_opps_select_authenticated" ON public.grant_opportunities;
DROP POLICY IF EXISTS "grant_opps_admin_write" ON public.grant_opportunities;
DROP POLICY IF EXISTS "grant_opps_service_all" ON public.grant_opportunities;

CREATE POLICY "grant_opps_select_authenticated"
  ON public.grant_opportunities
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "grant_opps_admin_write"
  ON public.grant_opportunities
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "grant_opps_service_all"
  ON public.grant_opportunities
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ------------------------------------------------------------
-- TASK 3: funding_morning_briefings  (PARTIAL -> PASS)
-- Client code only READS (FundingMachineDashboard, MorningBriefingPage).
-- Only supabase/functions/funding-morning-briefing writes, via service_role
-- (bypasses RLS). Authenticated INSERT is not required — remove it.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "System can create briefings" ON public.funding_morning_briefings;
DROP POLICY IF EXISTS "funding_morning_briefings_service_all" ON public.funding_morning_briefings;

CREATE POLICY "funding_morning_briefings_service_all"
  ON public.funding_morning_briefings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
-- (Authenticated SELECT policy "Authenticated users can view briefings" retained.)

-- ------------------------------------------------------------
-- BONUS: funding_daily_briefings VIEW hardening
-- The view exposes funding_morning_briefings rows. Without
-- security_invoker, the view runs as owner (postgres) and bypasses RLS.
-- Also anon had SELECT grant on the view.
-- ------------------------------------------------------------
ALTER VIEW public.funding_daily_briefings SET (security_invoker = on);
REVOKE ALL ON public.funding_daily_briefings FROM anon;
GRANT SELECT ON public.funding_daily_briefings TO authenticated;
GRANT SELECT ON public.funding_daily_briefings TO service_role;

-- ------------------------------------------------------------
-- TASK 4: grant_application_packages — NO POLICY CHANGES
-- Section 14 requires authenticated Save Changes, Mark Submitted,
-- Auto-Updates and Application Edits. Existing policies (gap_read,
-- gap_insert, gap_update, gap_service) are correct. QA spec asking
-- for "SELECT only" is outdated and would break the Application
-- Package workflow — retained as-is.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- TASK 5: funding_tasks — NO POLICY CHANGES
-- Table exists with per-command policies for authenticated
-- (select/insert/update/delete). Prior QA "table not found" was
-- a stale spec, not a real defect.
-- ------------------------------------------------------------

-- End of migration.
