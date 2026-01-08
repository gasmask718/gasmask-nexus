-- Drop the existing policy that uses profiles.role (incorrect)
DROP POLICY IF EXISTS "Admins and assigned users can modify routes" ON public.routes;

-- Create a new policy using the proper is_admin() function
CREATE POLICY "Admins and assigned users can modify routes" 
ON public.routes 
FOR ALL 
TO authenticated
USING (
  public.is_admin(auth.uid()) 
  OR public.is_owner(auth.uid()) 
  OR assigned_to = auth.uid()
)
WITH CHECK (
  public.is_admin(auth.uid()) 
  OR public.is_owner(auth.uid()) 
  OR assigned_to = auth.uid()
);