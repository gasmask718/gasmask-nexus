-- Fix INSERT failing with `return=representation` by allowing creators to SELECT their own rows
-- (Postgres applies SELECT policies to INSERT ... RETURNING *)

-- DRIVERS: allow creators to see their newly-inserted row
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Drivers can select created_by" ON public.drivers;
CREATE POLICY "Drivers can select created_by"
ON public.drivers
FOR SELECT
TO authenticated
USING (created_by = auth.uid());

-- BIKERS: allow creators to see their newly-inserted row
ALTER TABLE public.bikers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Bikers can select created_by" ON public.bikers;
CREATE POLICY "Bikers can select created_by"
ON public.bikers
FOR SELECT
TO authenticated
USING (created_by = auth.uid());
