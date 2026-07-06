
CREATE POLICY "Authenticated read grant docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'grant-documents');

CREATE POLICY "Authenticated upload grant docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'grant-documents');

CREATE POLICY "Authenticated update grant docs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'grant-documents');

CREATE POLICY "Authenticated delete grant docs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'grant-documents');
