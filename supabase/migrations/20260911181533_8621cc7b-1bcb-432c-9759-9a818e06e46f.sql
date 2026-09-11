CREATE POLICY "Field users view claims for visible stores"
ON public.ambassador_store_claims
FOR SELECT
TO authenticated
USING (public.field_worker_has_store(auth.uid(), store_id));