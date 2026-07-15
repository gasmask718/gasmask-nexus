-- telegram-media bucket RLS policies
-- Bucket is PRIVATE. Reads happen via time-limited signed URLs (which bypass RLS).
-- The service_role bypasses RLS automatically; policies below are explicit for auditability.

CREATE POLICY "telegram-media service_role insert"
ON storage.objects FOR INSERT TO service_role
WITH CHECK (bucket_id = 'telegram-media');

CREATE POLICY "telegram-media service_role update"
ON storage.objects FOR UPDATE TO service_role
USING (bucket_id = 'telegram-media')
WITH CHECK (bucket_id = 'telegram-media');

CREATE POLICY "telegram-media service_role delete"
ON storage.objects FOR DELETE TO service_role
USING (bucket_id = 'telegram-media');

CREATE POLICY "telegram-media service_role select"
ON storage.objects FOR SELECT TO service_role
USING (bucket_id = 'telegram-media');
