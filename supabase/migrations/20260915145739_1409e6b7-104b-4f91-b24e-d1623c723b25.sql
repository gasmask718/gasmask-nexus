ALTER TABLE public.products_all
  ADD COLUMN IF NOT EXISTS photo_id_status text,
  ADD COLUMN IF NOT EXISTS photo_id_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS photo_identification jsonb;

DO $$ BEGIN
  ALTER TABLE public.products_all
    ADD CONSTRAINT products_all_photo_id_status_chk
    CHECK (photo_id_status IS NULL OR photo_id_status IN
      ('identified','likely_match','needs_more_photos','not_identified','identifying','confirmed_by_admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.products_all.photo_identification IS
  'Provenance for photo-based product identification: extracted identifiers, method, confidence, photo urls, confirming admin, timestamp.';