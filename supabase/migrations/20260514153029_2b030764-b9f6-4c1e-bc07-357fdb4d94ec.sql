
INSERT INTO storage.buckets (id, name, public)
VALUES ('va-lead-intake', 'va-lead-intake', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can upload va-lead-intake"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'va-lead-intake');

CREATE POLICY "Public read va-lead-intake"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'va-lead-intake');

CREATE POLICY "Authenticated delete va-lead-intake"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'va-lead-intake');
