ALTER TABLE public.store_master
  ADD COLUMN IF NOT EXISTS show_on_public_site boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_store_master_public_site
  ON public.store_master (show_on_public_site)
  WHERE show_on_public_site = true AND deleted_at IS NULL;