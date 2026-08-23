-- Helper: does this user have access to the office that owns this batch?
-- Security definer so the outputs policy can resolve batch -> office without
-- tripping over RLS on production_batches itself.
CREATE OR REPLACE FUNCTION public.production_batch_office_access(_user_id uuid, _batch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.production_batches b
    WHERE b.id = _batch_id
      AND public.has_production_office_access(_user_id, b.office_id)
  )
$$;

-- 1. production_batches: split the old staff-wide policy into
--    core staff (all offices) + office-scoped (assigned leaders only).
DROP POLICY prod_batches_staff ON public.production_batches;

CREATE POLICY prod_batches_core_staff ON public.production_batches
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'employee') OR public.has_role(auth.uid(), 'staff')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'employee') OR public.has_role(auth.uid(), 'staff')
  );

CREATE POLICY prod_batches_office_scoped ON public.production_batches
  FOR ALL TO authenticated
  USING (public.has_production_office_access(auth.uid(), office_id))
  WITH CHECK (public.has_production_office_access(auth.uid(), office_id));

-- 2. production_batch_outputs: same split, scoped through the parent batch.
DROP POLICY prod_outputs_staff ON public.production_batch_outputs;

CREATE POLICY prod_outputs_core_staff ON public.production_batch_outputs
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'employee') OR public.has_role(auth.uid(), 'staff')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'employee') OR public.has_role(auth.uid(), 'staff')
  );

CREATE POLICY prod_outputs_office_scoped ON public.production_batch_outputs
  FOR ALL TO authenticated
  USING (public.production_batch_office_access(auth.uid(), batch_id))
  WITH CHECK (public.production_batch_office_access(auth.uid(), batch_id));

-- 3. Yield views: inherit the caller's permissions instead of bypassing them,
--    and stop being readable while logged out.
ALTER VIEW public.v_batch_yield SET (security_invoker = true);
ALTER VIEW public.v_yield_watch SET (security_invoker = true);
REVOKE SELECT ON public.v_batch_yield FROM anon;
REVOKE SELECT ON public.v_yield_watch FROM anon;