
-- Helper: check if user is admin/owner
CREATE OR REPLACE FUNCTION public.is_brandaro_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('admin', 'owner')
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND role IN ('admin'::app_role, 'owner'::app_role)
  );
$$;

-- SELECT: admins see all, VAs see only their assigned leads
CREATE POLICY "Admin sees all leads"
ON public.brandaro_qualified_leads
FOR SELECT TO authenticated
USING (public.is_brandaro_admin(auth.uid()));

CREATE POLICY "VA sees own assigned leads"
ON public.brandaro_qualified_leads
FOR SELECT TO authenticated
USING (assigned_va = auth.uid());

-- UPDATE: admins update all, VAs update only their own
CREATE POLICY "Admin updates all leads"
ON public.brandaro_qualified_leads
FOR UPDATE TO authenticated
USING (public.is_brandaro_admin(auth.uid()));

CREATE POLICY "VA updates own leads"
ON public.brandaro_qualified_leads
FOR UPDATE TO authenticated
USING (assigned_va = auth.uid());

-- INSERT: admins only
CREATE POLICY "Admin inserts leads"
ON public.brandaro_qualified_leads
FOR INSERT TO authenticated
WITH CHECK (public.is_brandaro_admin(auth.uid()));

-- Auto-distribution function
CREATE OR REPLACE FUNCTION public.distribute_leads_to_vas()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lead_rec RECORD;
  va_ids uuid[];
  va_count int;
  idx int := 0;
  assigned_count int := 0;
BEGIN
  SELECT array_agg(ur.user_id ORDER BY (
    SELECT count(*) FROM brandaro_qualified_leads bql WHERE bql.assigned_va = ur.user_id
  ) ASC)
  INTO va_ids
  FROM user_roles ur
  WHERE ur.role::text = 'va';

  va_count := coalesce(array_length(va_ids, 1), 0);
  
  IF va_count = 0 THEN
    RETURN jsonb_build_object('assigned', 0, 'error', 'No active VAs found');
  END IF;

  FOR lead_rec IN
    SELECT id FROM brandaro_qualified_leads
    WHERE assigned_va IS NULL
    ORDER BY priority_score DESC NULLS LAST, created_at ASC
  LOOP
    UPDATE brandaro_qualified_leads
    SET assigned_va = va_ids[1 + (idx % va_count)],
        updated_at = now()
    WHERE id = lead_rec.id;
    idx := idx + 1;
    assigned_count := assigned_count + 1;
  END LOOP;

  RETURN jsonb_build_object('assigned', assigned_count, 'va_count', va_count);
END;
$$;
