
ALTER TABLE public.products_all
  ADD COLUMN IF NOT EXISTS primary_image_url text,
  ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT '{}';

-- Storage policies: service role already bypasses RLS, so no policies for
-- anon/authenticated. Both buckets stay locked down.
DROP POLICY IF EXISTS "dd_products_raw_no_anon" ON storage.objects;
DROP POLICY IF EXISTS "dd_products_processed_no_anon" ON storage.objects;
