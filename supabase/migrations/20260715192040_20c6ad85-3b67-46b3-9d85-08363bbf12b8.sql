ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS created_by_run_id uuid,
  ADD COLUMN IF NOT EXISTS geocode_confidence text;
CREATE INDEX IF NOT EXISTS idx_stores_created_by_run_id ON public.stores(created_by_run_id) WHERE created_by_run_id IS NOT NULL;