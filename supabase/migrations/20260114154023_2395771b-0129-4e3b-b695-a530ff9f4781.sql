-- Fix RLS insert violations for ambassadors/drivers/bikers by allowing authenticated inserts
-- Enforce ownership via created_by = auth.uid()

-- Ensure RLS is enabled
ALTER TABLE public.ambassadors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bikers ENABLE ROW LEVEL SECURITY;

-- AMBASSADORS
DROP POLICY IF EXISTS "Ambassadors can insert own" ON public.ambassadors;
CREATE POLICY "Ambassadors can insert own"
ON public.ambassadors
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Ambassadors can update own" ON public.ambassadors;
CREATE POLICY "Ambassadors can update own"
ON public.ambassadors
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_admin(auth.uid())
  OR public.is_owner(auth.uid())
)
WITH CHECK (
  created_by = auth.uid()
  OR public.is_admin(auth.uid())
  OR public.is_owner(auth.uid())
);

DROP POLICY IF EXISTS "Ambassadors can delete own" ON public.ambassadors;
CREATE POLICY "Ambassadors can delete own"
ON public.ambassadors
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_admin(auth.uid())
  OR public.is_owner(auth.uid())
);

DROP POLICY IF EXISTS "Ambassadors can select own or admin" ON public.ambassadors;
CREATE POLICY "Ambassadors can select own or admin"
ON public.ambassadors
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR user_id = auth.uid()
  OR public.is_admin(auth.uid())
  OR public.is_owner(auth.uid())
);

-- DRIVERS
DROP POLICY IF EXISTS "Drivers can insert own" ON public.drivers;
CREATE POLICY "Drivers can insert own"
ON public.drivers
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Drivers can update own" ON public.drivers;
CREATE POLICY "Drivers can update own"
ON public.drivers
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_admin(auth.uid())
  OR public.is_owner(auth.uid())
  OR public.is_business_admin(auth.uid(), business_id)
)
WITH CHECK (
  created_by = auth.uid()
  OR public.is_admin(auth.uid())
  OR public.is_owner(auth.uid())
  OR public.is_business_admin(auth.uid(), business_id)
);

DROP POLICY IF EXISTS "Drivers can delete own" ON public.drivers;
CREATE POLICY "Drivers can delete own"
ON public.drivers
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_admin(auth.uid())
  OR public.is_owner(auth.uid())
  OR public.is_business_admin(auth.uid(), business_id)
);

-- BIKERS
DROP POLICY IF EXISTS "Bikers can insert own" ON public.bikers;
CREATE POLICY "Bikers can insert own"
ON public.bikers
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Bikers can update own" ON public.bikers;
CREATE POLICY "Bikers can update own"
ON public.bikers
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_admin(auth.uid())
  OR public.is_owner(auth.uid())
  OR public.is_business_admin(auth.uid(), business_id)
)
WITH CHECK (
  created_by = auth.uid()
  OR public.is_admin(auth.uid())
  OR public.is_owner(auth.uid())
  OR public.is_business_admin(auth.uid(), business_id)
);

DROP POLICY IF EXISTS "Bikers can delete own" ON public.bikers;
CREATE POLICY "Bikers can delete own"
ON public.bikers
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_admin(auth.uid())
  OR public.is_owner(auth.uid())
  OR public.is_business_admin(auth.uid(), business_id)
);
