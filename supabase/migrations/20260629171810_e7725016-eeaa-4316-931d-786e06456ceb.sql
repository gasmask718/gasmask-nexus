
CREATE POLICY "DD Admin can manage POs"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'purchase-orders' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'purchase-orders' AND public.has_role(auth.uid(), 'admin'));
