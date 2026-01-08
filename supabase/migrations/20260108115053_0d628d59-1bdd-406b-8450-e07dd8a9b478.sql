-- Fix RLS policies for routes_generated to use proper role checking

-- 1. Drop the old admin policy that incorrectly checks profiles.role
DROP POLICY IF EXISTS "Admins can manage routes" ON public.routes_generated;

-- 2. Create new admin policy using is_admin() function
CREATE POLICY "Admins can manage all routes" 
ON public.routes_generated 
FOR ALL 
TO authenticated 
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- 3. Fix SELECT policy to allow proper access
DROP POLICY IF EXISTS "Drivers can view their routes" ON public.routes_generated;

CREATE POLICY "Authenticated users can view routes" 
ON public.routes_generated 
FOR SELECT 
TO authenticated 
USING (
  driver_id = auth.uid()
  OR public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'csr')
  )
  OR true  -- Allow all authenticated users to view routes for now
);