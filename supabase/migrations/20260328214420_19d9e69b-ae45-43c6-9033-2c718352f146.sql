
-- Add unique constraint on event_id for upsert deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_sbo_external_results_event_id_unique
  ON public.sbo_external_results (event_id) WHERE event_id IS NOT NULL;
