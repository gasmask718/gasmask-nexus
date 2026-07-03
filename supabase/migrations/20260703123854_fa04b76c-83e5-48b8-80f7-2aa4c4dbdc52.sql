GRANT INSERT ON public.dc_lead_sync_log TO authenticated;

CREATE POLICY "dc_lead_sync_log_insert_authenticated"
  ON public.dc_lead_sync_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);