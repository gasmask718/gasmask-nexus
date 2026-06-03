CREATE TABLE IF NOT EXISTS public.dc_bulk_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business text NOT NULL,
  agent_type text,
  agent_bland_id text,
  agent_name text,
  concurrency int NOT NULL DEFAULT 3,
  status text NOT NULL DEFAULT 'queued',
  total_count int NOT NULL DEFAULT 0,
  queued_count int NOT NULL DEFAULT 0,
  dialing_count int NOT NULL DEFAULT 0,
  connected_count int NOT NULL DEFAULT 0,
  done_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  skipped_count int NOT NULL DEFAULT 0,
  source text,
  source_metadata jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  error_summary jsonb
);
GRANT SELECT, INSERT, UPDATE ON public.dc_bulk_batches TO authenticated;
GRANT ALL ON public.dc_bulk_batches TO service_role;
ALTER TABLE public.dc_bulk_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read dc_bulk_batches" ON public.dc_bulk_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert dc_bulk_batches" ON public.dc_bulk_batches FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update dc_bulk_batches" ON public.dc_bulk_batches FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.dc_bulk_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.dc_bulk_batches(id) ON DELETE CASCADE,
  to_number text NOT NULL,
  lead_name text,
  store_id uuid,
  status text NOT NULL DEFAULT 'queued',
  skip_reason text,
  call_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS dc_bulk_targets_batch_status_idx ON public.dc_bulk_targets (batch_id, status);
GRANT SELECT, INSERT, UPDATE ON public.dc_bulk_targets TO authenticated;
GRANT ALL ON public.dc_bulk_targets TO service_role;
ALTER TABLE public.dc_bulk_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read dc_bulk_targets" ON public.dc_bulk_targets FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert dc_bulk_targets" ON public.dc_bulk_targets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update dc_bulk_targets" ON public.dc_bulk_targets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);