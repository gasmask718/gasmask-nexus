
-- ============================================================
-- VA role access: store_master, communication_logs, store_opportunities
-- SELECT + INSERT + UPDATE only. NEVER DELETE.
-- Idempotent: drop-if-exists then create.
-- ============================================================

-- store_master ------------------------------------------------
DROP POLICY IF EXISTS "va_select_store_master" ON public.store_master;
CREATE POLICY "va_select_store_master"
  ON public.store_master
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'va'::app_role));

DROP POLICY IF EXISTS "va_insert_store_master" ON public.store_master;
CREATE POLICY "va_insert_store_master"
  ON public.store_master
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'va'::app_role));

DROP POLICY IF EXISTS "va_update_store_master" ON public.store_master;
CREATE POLICY "va_update_store_master"
  ON public.store_master
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'va'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'va'::app_role));

-- communication_logs -----------------------------------------
DROP POLICY IF EXISTS "va_select_communication_logs" ON public.communication_logs;
CREATE POLICY "va_select_communication_logs"
  ON public.communication_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'va'::app_role));

DROP POLICY IF EXISTS "va_insert_communication_logs" ON public.communication_logs;
CREATE POLICY "va_insert_communication_logs"
  ON public.communication_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'va'::app_role)
    AND ((created_by IS NULL) OR (created_by = auth.uid()))
  );

DROP POLICY IF EXISTS "va_update_communication_logs" ON public.communication_logs;
CREATE POLICY "va_update_communication_logs"
  ON public.communication_logs
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'va'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'va'::app_role));

-- store_opportunities ----------------------------------------
DROP POLICY IF EXISTS "va_select_store_opportunities" ON public.store_opportunities;
CREATE POLICY "va_select_store_opportunities"
  ON public.store_opportunities
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'va'::app_role));

DROP POLICY IF EXISTS "va_insert_store_opportunities" ON public.store_opportunities;
CREATE POLICY "va_insert_store_opportunities"
  ON public.store_opportunities
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'va'::app_role));

DROP POLICY IF EXISTS "va_update_store_opportunities" ON public.store_opportunities;
CREATE POLICY "va_update_store_opportunities"
  ON public.store_opportunities
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'va'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'va'::app_role));

-- Confirm table grants exist (safe if already present)
GRANT SELECT, INSERT, UPDATE ON public.store_master        TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.communication_logs  TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.store_opportunities TO authenticated;
