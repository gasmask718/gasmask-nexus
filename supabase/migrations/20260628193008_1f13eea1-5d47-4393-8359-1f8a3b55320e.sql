
-- =========================================================
-- brandaro_conversations: VA via lead_id
-- =========================================================
DROP POLICY IF EXISTS "auth_manage_conversations" ON public.brandaro_conversations;

CREATE POLICY "VA sees own lead conversations" ON public.brandaro_conversations
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.brandaro_qualified_leads l
            WHERE l.id = brandaro_conversations.lead_id
              AND l.assigned_va = auth.uid())
    OR is_brandaro_admin(auth.uid())
  );

CREATE POLICY "VA inserts own lead conversations" ON public.brandaro_conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.brandaro_qualified_leads l
            WHERE l.id = brandaro_conversations.lead_id
              AND l.assigned_va = auth.uid())
    OR is_brandaro_admin(auth.uid())
  );

CREATE POLICY "VA updates own lead conversations" ON public.brandaro_conversations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.brandaro_qualified_leads l
            WHERE l.id = brandaro_conversations.lead_id
              AND l.assigned_va = auth.uid())
    OR is_brandaro_admin(auth.uid())
  );

-- =========================================================
-- brandaro_execution_queue: admin only
-- =========================================================
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.brandaro_execution_queue;

CREATE POLICY "Admins manage execution queue" ON public.brandaro_execution_queue
  FOR ALL TO authenticated
  USING (is_brandaro_admin(auth.uid()))
  WITH CHECK (is_brandaro_admin(auth.uid()));

-- =========================================================
-- brandaro_lead_events: admin only (no assigned_va linkage)
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users manage lead events" ON public.brandaro_lead_events;

CREATE POLICY "Admins manage lead events" ON public.brandaro_lead_events
  FOR ALL TO authenticated
  USING (is_brandaro_admin(auth.uid()))
  WITH CHECK (is_brandaro_admin(auth.uid()));

-- =========================================================
-- brandaro_intent_log: VA via lead_id
-- =========================================================
DROP POLICY IF EXISTS "authenticated_read_intent_log" ON public.brandaro_intent_log;

CREATE POLICY "VA sees own lead intent log" ON public.brandaro_intent_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.brandaro_qualified_leads l
            WHERE l.id = brandaro_intent_log.lead_id
              AND l.assigned_va = auth.uid())
    OR is_brandaro_admin(auth.uid())
  );

-- =========================================================
-- brandaro_client_views: VA via lead_id
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users manage client views" ON public.brandaro_client_views;

CREATE POLICY "VA sees own lead client views" ON public.brandaro_client_views
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.brandaro_qualified_leads l
            WHERE l.id = brandaro_client_views.lead_id
              AND l.assigned_va = auth.uid())
    OR is_brandaro_admin(auth.uid())
  );

CREATE POLICY "VA updates own lead client views" ON public.brandaro_client_views
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.brandaro_qualified_leads l
            WHERE l.id = brandaro_client_views.lead_id
              AND l.assigned_va = auth.uid())
    OR is_brandaro_admin(auth.uid())
  );

-- =========================================================
-- brandaro_urgency: VA via lead_id
-- =========================================================
DROP POLICY IF EXISTS "Auth manage urgency" ON public.brandaro_urgency;

CREATE POLICY "VA sees own lead urgency" ON public.brandaro_urgency
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.brandaro_qualified_leads l
            WHERE l.id = brandaro_urgency.lead_id
              AND l.assigned_va = auth.uid())
    OR is_brandaro_admin(auth.uid())
  );

-- =========================================================
-- brandaro_va_lead_heat: VA via lead_id (drop USING true write, keep nothing permissive)
-- =========================================================
DROP POLICY IF EXISTS "va_lead_heat_write" ON public.brandaro_va_lead_heat;

CREATE POLICY "VA sees own lead heat" ON public.brandaro_va_lead_heat
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.brandaro_qualified_leads l
            WHERE l.id = brandaro_va_lead_heat.lead_id
              AND l.assigned_va = auth.uid())
    OR is_brandaro_admin(auth.uid())
  );

CREATE POLICY "Admins manage lead heat" ON public.brandaro_va_lead_heat
  FOR ALL TO authenticated
  USING (is_brandaro_admin(auth.uid()))
  WITH CHECK (is_brandaro_admin(auth.uid()));

-- =========================================================
-- brandaro_lead_jobs: owner via created_by
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can insert lead jobs" ON public.brandaro_lead_jobs;
DROP POLICY IF EXISTS "Authenticated users can update lead jobs" ON public.brandaro_lead_jobs;
DROP POLICY IF EXISTS "Authenticated users can view lead jobs" ON public.brandaro_lead_jobs;

CREATE POLICY "Users see own lead jobs" ON public.brandaro_lead_jobs
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR is_brandaro_admin(auth.uid()));

CREATE POLICY "Users insert own lead jobs" ON public.brandaro_lead_jobs
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR is_brandaro_admin(auth.uid()));

CREATE POLICY "Users update own lead jobs" ON public.brandaro_lead_jobs
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR is_brandaro_admin(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR is_brandaro_admin(auth.uid()));
