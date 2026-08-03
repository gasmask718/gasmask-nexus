CREATE POLICY "idea_attach_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'idea-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "idea_attach_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'idea-attachments' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner')
  ));

CREATE POLICY "idea_attach_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'idea-attachments' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner')
  ));