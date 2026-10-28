-- Additive: photo proof on store visits (path-not-URL, private bucket field-visit-photos)
ALTER TABLE public.store_visits ADD COLUMN photo_paths text[];
COMMENT ON COLUMN public.store_visits.photo_paths IS 'Object paths in private bucket field-visit-photos (<user_id>/<store_id>/<file>.jpg); render via SignedImage, never store URLs.';

-- Storage policies for field-visit-photos (private)
CREATE POLICY field_visit_photos_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'field-visit-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (
    public.has_role(auth.uid(), 'ambassador')
    OR public.has_role(auth.uid(), 'driver')
    OR public.has_role(auth.uid(), 'biker')
    OR public.has_role(auth.uid(), 'verification_crew')
    OR public.has_role(auth.uid(), 'staff')
    OR public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY field_visit_photos_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'field-visit-photos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'staff')
    OR public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY field_visit_photos_delete_admin ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'field-visit-photos'
  AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
);