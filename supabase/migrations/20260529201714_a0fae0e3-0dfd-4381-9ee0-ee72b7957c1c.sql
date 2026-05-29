ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS neighborhood_source TEXT;
CREATE INDEX IF NOT EXISTS idx_stores_neighborhood_source ON public.stores (neighborhood_source);