ALTER TABLE public.dd_catalog_drafts
  ADD COLUMN IF NOT EXISTS label_photo_url text,
  ADD COLUMN IF NOT EXISTS label_extraction jsonb;