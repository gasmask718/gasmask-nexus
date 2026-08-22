-- ambassador_tasks: close the anon hole, scope to owning ambassador + elevated staff
REVOKE ALL ON public.ambassador_tasks FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ambassador_tasks TO authenticated;
GRANT ALL ON public.ambassador_tasks TO service_role;

ALTER TABLE public.ambassador_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY ambassador_tasks_admin_all ON public.ambassador_tasks
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'employee')
    OR public.has_role(auth.uid(), 'staff')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'employee')
    OR public.has_role(auth.uid(), 'staff')
  );

CREATE POLICY ambassador_tasks_self ON public.ambassador_tasks
  FOR ALL TO authenticated
  USING (
    ambassador_id IN (SELECT id FROM public.ambassadors WHERE user_id = auth.uid())
  )
  WITH CHECK (
    ambassador_id IN (SELECT id FROM public.ambassadors WHERE user_id = auth.uid())
  );

-- v_ambassador_tasks_admin: admin-only surface, must respect RLS of the invoker
ALTER VIEW public.v_ambassador_tasks_admin SET (security_invoker = true);
REVOKE ALL ON public.v_ambassador_tasks_admin FROM anon;
GRANT SELECT ON public.v_ambassador_tasks_admin TO authenticated;