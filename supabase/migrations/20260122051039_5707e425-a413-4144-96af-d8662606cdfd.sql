-- =====================================================
-- AMBASSADOR PORTAL OS - PHASE 1: COMPLETE SETUP
-- =====================================================

-- 1) Create helper function to get ambassador ID from user ID
CREATE OR REPLACE FUNCTION public.get_ambassador_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.ambassadors WHERE user_id = _user_id LIMIT 1
$$;

-- 2) Create security definer helper function for ambassador scope checks
CREATE OR REPLACE FUNCTION public.is_ambassador_for_store(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ambassador_assignments aa
    JOIN public.ambassadors a ON aa.ambassador_id = a.id
    WHERE a.user_id = _user_id
      AND aa.store_id = _store_id
      AND aa.active = true
  )
$$;

-- 3) Create view for ambassador's assigned stores with enriched data
DROP VIEW IF EXISTS public.ambassador_store_portfolio;
CREATE VIEW public.ambassador_store_portfolio AS
SELECT 
  aa.id as assignment_id,
  aa.ambassador_id,
  aa.store_id,
  aa.assignment_type,
  aa.active,
  aa.start_date,
  aa.end_date,
  aa.is_primary,
  aa.commission_rate,
  aa.created_at as assigned_at,
  sm.store_name,
  sm.address as store_address,
  sm.city as store_city,
  sm.state as store_state,
  sm.phone as store_phone,
  sm.owner_name as store_owner,
  a.user_id as ambassador_user_id,
  p.name as ambassador_name
FROM public.ambassador_assignments aa
JOIN public.ambassadors a ON aa.ambassador_id = a.id
LEFT JOIN public.store_master sm ON aa.store_id = sm.id
LEFT JOIN public.profiles p ON a.user_id = p.id
WHERE aa.store_id IS NOT NULL;

-- 4) RLS Policies for ambassador_assignments
DROP POLICY IF EXISTS "Ambassadors can view own assignments" ON public.ambassador_assignments;
DROP POLICY IF EXISTS "Elevated users can manage assignments" ON public.ambassador_assignments;

-- Ambassadors can only see their own assignments OR elevated users can see all
CREATE POLICY "Ambassadors can view own assignments"
ON public.ambassador_assignments
FOR SELECT
TO authenticated
USING (
  ambassador_id = public.get_ambassador_id(auth.uid())
  OR public.is_elevated_user(auth.uid())
);

-- Only elevated users can insert/update/delete assignments
CREATE POLICY "Elevated users can manage assignments"
ON public.ambassador_assignments
FOR ALL
TO authenticated
USING (public.is_elevated_user(auth.uid()))
WITH CHECK (public.is_elevated_user(auth.uid()));

-- 5) Add RLS to store_master for ambassador scoped access
DROP POLICY IF EXISTS "Ambassadors can view assigned stores" ON public.store_master;
CREATE POLICY "Ambassadors can view assigned stores"
ON public.store_master
FOR SELECT
TO authenticated
USING (
  public.is_elevated_user(auth.uid())
  OR public.is_ambassador_for_store(auth.uid(), id)
);

-- 6) Add RLS to store_orders for ambassador scoped access
DROP POLICY IF EXISTS "Ambassadors can view orders for assigned stores" ON public.store_orders;
CREATE POLICY "Ambassadors can view orders for assigned stores"
ON public.store_orders
FOR SELECT
TO authenticated
USING (
  public.is_elevated_user(auth.uid())
  OR public.is_ambassador_for_store(auth.uid(), store_id)
);

-- 7) Add RLS to store_notes for ambassador scoped access
DROP POLICY IF EXISTS "Ambassadors can view notes for assigned stores" ON public.store_notes;
DROP POLICY IF EXISTS "Ambassadors can create notes for assigned stores" ON public.store_notes;

CREATE POLICY "Ambassadors can view notes for assigned stores"
ON public.store_notes
FOR SELECT
TO authenticated
USING (
  public.is_elevated_user(auth.uid())
  OR public.is_ambassador_for_store(auth.uid(), store_id)
);

CREATE POLICY "Ambassadors can create notes for assigned stores"
ON public.store_notes
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_elevated_user(auth.uid())
  OR public.is_ambassador_for_store(auth.uid(), store_id)
);

-- 8) Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_ambassador_assignment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_ambassador_assignments_updated ON public.ambassador_assignments;
CREATE TRIGGER trg_ambassador_assignments_updated
BEFORE UPDATE ON public.ambassador_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_ambassador_assignment_timestamp();