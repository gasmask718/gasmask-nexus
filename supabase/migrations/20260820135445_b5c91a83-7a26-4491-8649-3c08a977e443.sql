-- Access rules for buckets created via the storage tool.
-- pod-designs / partner-media / partner-assets: staff surfaces, authenticated-only.
-- dispute-evidence: ambassadors + admins both read/write their dispute attachments.
DO $$
DECLARE b text;
BEGIN
  FOREACH b IN ARRAY ARRAY['pod-designs','partner-media','partner-assets','dispute-evidence'] LOOP
    EXECUTE format($f$
      CREATE POLICY %I ON storage.objects FOR SELECT TO authenticated USING (bucket_id = %L);
    $f$, b || '_auth_select', b);
    EXECUTE format($f$
      CREATE POLICY %I ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = %L);
    $f$, b || '_auth_insert', b);
    EXECUTE format($f$
      CREATE POLICY %I ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = %L);
    $f$, b || '_auth_update', b);
    EXECUTE format($f$
      CREATE POLICY %I ON storage.objects FOR DELETE TO authenticated USING (bucket_id = %L);
    $f$, b || '_auth_delete', b);
  END LOOP;
END $$;

COMMENT ON COLUMN public.va_call_logs.recording_url IS
  'FOSSIL COLUMN — do not render directly. 103 legacy rows store a /storage/v1/object/public/call-recordings/... URL written before the call-recordings bucket was made private; those literal URLs now 403. Playback works only because RecordingPlayer/play-twilio-recording proxy by object PATH and ignore the stored string. Rendering this column in an <audio src> or <a href> produces a dead link that looks like a player bug.';