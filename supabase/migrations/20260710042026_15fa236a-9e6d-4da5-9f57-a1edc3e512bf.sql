
-- Drop existing over-permissive policies
DROP POLICY IF EXISTS "Authenticated read grant docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload grant docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update grant docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete grant docs" ON storage.objects;

-- Helper predicate:
--   1. bucket is grant-documents
--   2. first folder segment is a UUID of a grant_application the user created
--      OR the user has the admin role
-- storage.foldername(name) returns text[]; first segment = [1]

-- SELECT (needed to createSignedUrl and list)
CREATE POLICY "Grant docs read own folder"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'grant-documents'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.grant_applications ga
      WHERE ga.id::text = (storage.foldername(name))[1]
        AND ga.created_by = auth.uid()
    )
  )
);

-- INSERT
CREATE POLICY "Grant docs upload own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'grant-documents'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.grant_applications ga
      WHERE ga.id::text = (storage.foldername(name))[1]
        AND ga.created_by = auth.uid()
    )
  )
);

-- UPDATE
CREATE POLICY "Grant docs update own folder"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'grant-documents'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.grant_applications ga
      WHERE ga.id::text = (storage.foldername(name))[1]
        AND ga.created_by = auth.uid()
    )
  )
);

-- DELETE
CREATE POLICY "Grant docs delete own folder"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'grant-documents'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.grant_applications ga
      WHERE ga.id::text = (storage.foldername(name))[1]
        AND ga.created_by = auth.uid()
    )
  )
);
