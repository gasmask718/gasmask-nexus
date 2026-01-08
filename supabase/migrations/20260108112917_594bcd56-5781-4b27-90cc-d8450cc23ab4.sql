-- Drop and recreate the INSERT policy to allow any authenticated user to create routes
-- The issue: Users need to create routes for OTHER drivers, not just themselves

DROP POLICY IF EXISTS "Authenticated users can create routes" ON public.routes_generated;

-- New INSERT policy: Allow any authenticated user to create routes (for any driver)
CREATE POLICY "Authenticated users can create routes" 
ON public.routes_generated 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Keep the UPDATE policy but expand it to allow route creators to update routes
DROP POLICY IF EXISTS "Users can update their own routes" ON public.routes_generated;

CREATE POLICY "Authenticated users can update routes" 
ON public.routes_generated 
FOR UPDATE 
TO authenticated 
USING (
  driver_id = auth.uid() 
  OR public.is_admin(auth.uid())
  OR true  -- Allow updates by any authenticated user for now
)
WITH CHECK (true);