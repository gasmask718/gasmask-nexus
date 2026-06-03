
ALTER TABLE public.dc_call_logs
  ADD COLUMN IF NOT EXISTS source_table text,
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS source_business text;
CREATE INDEX IF NOT EXISTS idx_dc_call_logs_source
  ON public.dc_call_logs (source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_dc_call_logs_source_business
  ON public.dc_call_logs (source_business);

ALTER TABLE public.dynasty_ai_calls
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS source_business text;
UPDATE public.dynasty_ai_calls
   SET source_id = source_lead_id::uuid
 WHERE source_id IS NULL
   AND source_lead_id IS NOT NULL
   AND source_lead_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
CREATE INDEX IF NOT EXISTS idx_dynasty_ai_calls_source
  ON public.dynasty_ai_calls (source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_dynasty_ai_calls_source_business
  ON public.dynasty_ai_calls (source_business);

ALTER TABLE public.bland_call_logs
  ADD COLUMN IF NOT EXISTS source_table text,
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS source_business text;
CREATE INDEX IF NOT EXISTS idx_bland_call_logs_source
  ON public.bland_call_logs (source_table, source_id);

ALTER TABLE public.communication_logs
  ADD COLUMN IF NOT EXISTS source_table text,
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS source_business text;
CREATE INDEX IF NOT EXISTS idx_communication_logs_source
  ON public.communication_logs (source_table, source_id);

ALTER TABLE public.dc_leads ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dc_leads TO authenticated;
GRANT ALL ON public.dc_leads TO service_role;

DROP POLICY IF EXISTS "dc_leads_authenticated_read" ON public.dc_leads;
CREATE POLICY "dc_leads_authenticated_read"
  ON public.dc_leads FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "dc_leads_authenticated_write" ON public.dc_leads;
CREATE POLICY "dc_leads_authenticated_write"
  ON public.dc_leads FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "dc_leads_authenticated_update" ON public.dc_leads;
CREATE POLICY "dc_leads_authenticated_update"
  ON public.dc_leads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dc_leads_authenticated_delete" ON public.dc_leads;
CREATE POLICY "dc_leads_authenticated_delete"
  ON public.dc_leads FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "dc_leads_service_all" ON public.dc_leads;
CREATE POLICY "dc_leads_service_all"
  ON public.dc_leads FOR ALL TO service_role USING (true) WITH CHECK (true);
