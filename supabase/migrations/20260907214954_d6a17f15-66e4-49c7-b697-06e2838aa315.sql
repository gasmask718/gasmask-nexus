
CREATE POLICY "crew_photos_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'crew-drop-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.has_role(auth.uid(),'verification_crew')
  );
CREATE POLICY "crew_photos_select_own_or_admin" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'crew-drop-photos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(),'owner')
      OR public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'staff')
    )
  );
CREATE POLICY "crew_photos_admin_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'crew-drop-photos'
    AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'))
  );
