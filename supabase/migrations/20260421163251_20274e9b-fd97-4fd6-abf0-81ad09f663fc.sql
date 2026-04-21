-- Make call-recordings bucket public so browser audio elements can play stored MP3s
UPDATE storage.buckets SET public = true WHERE id = 'call-recordings';

-- Public read policy for call-recordings (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Public read call-recordings'
  ) THEN
    CREATE POLICY "Public read call-recordings"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'call-recordings');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Service role write call-recordings'
  ) THEN
    CREATE POLICY "Service role write call-recordings"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'call-recordings');
  END IF;
END $$;