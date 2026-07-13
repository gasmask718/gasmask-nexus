ALTER TABLE public.dd_catalog_drafts
  ADD COLUMN IF NOT EXISTS selected_candidate_urls text[] NOT NULL DEFAULT '{}'::text[];