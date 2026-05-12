DROP POLICY IF EXISTS "Field roles can upload storefront captures" ON storage.objects;

CREATE POLICY "Authorized roles can upload storefront captures"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'storefront-captures'
    AND auth.uid() IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'driver'::public.app_role)
      OR public.has_role(auth.uid(), 'biker'::public.app_role)
      OR public.has_role(auth.uid(), 'ambassador'::public.app_role)
      OR public.has_role(auth.uid(), 'owner'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );