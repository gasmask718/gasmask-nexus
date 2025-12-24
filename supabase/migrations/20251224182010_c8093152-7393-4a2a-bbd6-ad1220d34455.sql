-- Fix infinite recursion in RLS (business_members) and align Delivery/Driver/Biker access policies

-- 1) Helper: business admin check (uses business_members.role text)
CREATE OR REPLACE FUNCTION public.is_business_admin(_user_id uuid, _business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.business_members
    WHERE user_id = _user_id
      AND business_id = _business_id
      AND role IN ('owner', 'admin')
  );
$$;

-- 2) business_members: remove recursive policies and replace with non-recursive versions
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Business admins can delete members" ON public.business_members;
DROP POLICY IF EXISTS "Business admins can insert members" ON public.business_members;
DROP POLICY IF EXISTS "Business admins can update members" ON public.business_members;
DROP POLICY IF EXISTS "Users can view co-members of same businesses" ON public.business_members;
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.business_members;

CREATE POLICY "Members can view own membership"
ON public.business_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- NOTE: uses SECURITY DEFINER function is_business_member() to avoid RLS recursion
CREATE POLICY "Members can view business roster"
ON public.business_members
FOR SELECT
TO authenticated
USING (public.is_business_member(auth.uid(), business_id));

CREATE POLICY "Business admins can insert members"
ON public.business_members
FOR INSERT
TO authenticated
WITH CHECK (public.is_business_admin(auth.uid(), business_id));

CREATE POLICY "Business admins can update members"
ON public.business_members
FOR UPDATE
TO authenticated
USING (public.is_business_admin(auth.uid(), business_id))
WITH CHECK (public.is_business_admin(auth.uid(), business_id));

CREATE POLICY "Business admins can delete members"
ON public.business_members
FOR DELETE
TO authenticated
USING (public.is_business_admin(auth.uid(), business_id));

-- 3) drivers: allow driver to read own row; keep business membership and elevated access; allow business admins to manage
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drivers_all" ON public.drivers;
DROP POLICY IF EXISTS "drivers_select" ON public.drivers;

CREATE POLICY "Drivers can view own driver record"
ON public.drivers
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Business members can view drivers"
ON public.drivers
FOR SELECT
TO authenticated
USING (public.is_business_member(auth.uid(), business_id));

CREATE POLICY "Elevated users can view drivers"
ON public.drivers
FOR SELECT
TO authenticated
USING (public.is_owner(auth.uid()) OR public.is_elevated_user(auth.uid()));

CREATE POLICY "Business admins manage drivers"
ON public.drivers
FOR ALL
TO authenticated
USING (public.is_business_admin(auth.uid(), business_id))
WITH CHECK (public.is_business_admin(auth.uid(), business_id));

-- 4) bikers: allow biker to read own row; keep business membership and elevated access; allow business admins to manage
ALTER TABLE public.bikers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bikers_all" ON public.bikers;
DROP POLICY IF EXISTS "bikers_select" ON public.bikers;

CREATE POLICY "Bikers can view own biker record"
ON public.bikers
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Business members can view bikers"
ON public.bikers
FOR SELECT
TO authenticated
USING (public.is_business_member(auth.uid(), business_id));

CREATE POLICY "Elevated users can view bikers"
ON public.bikers
FOR SELECT
TO authenticated
USING (public.is_owner(auth.uid()) OR public.is_elevated_user(auth.uid()));

CREATE POLICY "Business admins manage bikers"
ON public.bikers
FOR ALL
TO authenticated
USING (public.is_business_admin(auth.uid(), business_id))
WITH CHECK (public.is_business_admin(auth.uid(), business_id));

-- 5) deliveries: allow assigned driver to view; allow business members + elevated; allow business admins to manage
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deliveries_all" ON public.deliveries;
DROP POLICY IF EXISTS "deliveries_select" ON public.deliveries;

CREATE POLICY "Assigned driver can view deliveries"
ON public.deliveries
FOR SELECT
TO authenticated
USING (
  assigned_driver_id IN (
    SELECT d.id
    FROM public.drivers d
    WHERE d.user_id = auth.uid()
      AND d.status = 'active'
  )
);

CREATE POLICY "Business members can view deliveries"
ON public.deliveries
FOR SELECT
TO authenticated
USING (
  public.is_business_member(auth.uid(), business_id)
  OR public.is_owner(auth.uid())
  OR public.is_elevated_user(auth.uid())
);

CREATE POLICY "Business admins manage deliveries"
ON public.deliveries
FOR ALL
TO authenticated
USING (public.is_business_admin(auth.uid(), business_id))
WITH CHECK (public.is_business_admin(auth.uid(), business_id));

-- 6) delivery_stops: visible if its parent delivery is visible (assigned driver / business member / elevated)
ALTER TABLE public.delivery_stops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stops_select" ON public.delivery_stops;

CREATE POLICY "Users can view stops for accessible deliveries"
ON public.delivery_stops
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.deliveries d
    WHERE d.id = delivery_stops.delivery_id
      AND (
        public.is_business_member(auth.uid(), d.business_id)
        OR public.is_owner(auth.uid())
        OR public.is_elevated_user(auth.uid())
        OR d.assigned_driver_id IN (
          SELECT dr.id
          FROM public.drivers dr
          WHERE dr.user_id = auth.uid()
            AND dr.status = 'active'
        )
      )
  )
);

-- 7) store_checks: allow assigned biker to view; allow business members + elevated; allow business admins to manage
ALTER TABLE public.store_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "checks_select" ON public.store_checks;

CREATE POLICY "Assigned biker can view store checks"
ON public.store_checks
FOR SELECT
TO authenticated
USING (
  assigned_biker_id IN (
    SELECT b.id
    FROM public.bikers b
    WHERE b.user_id = auth.uid()
      AND b.status = 'active'
  )
);

CREATE POLICY "Business members can view store checks"
ON public.store_checks
FOR SELECT
TO authenticated
USING (
  public.is_business_member(auth.uid(), business_id)
  OR public.is_owner(auth.uid())
  OR public.is_elevated_user(auth.uid())
);

CREATE POLICY "Business admins manage store checks"
ON public.store_checks
FOR ALL
TO authenticated
USING (public.is_business_admin(auth.uid(), business_id))
WITH CHECK (public.is_business_admin(auth.uid(), business_id));
