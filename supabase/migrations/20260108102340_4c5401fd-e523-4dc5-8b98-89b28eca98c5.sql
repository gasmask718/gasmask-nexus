-- Add INSERT policy for authenticated users to create routes
CREATE POLICY "Authenticated users can create routes" 
ON public.routes_generated 
FOR INSERT 
TO authenticated 
WITH CHECK (
  driver_id IS NULL 
  OR driver_id = auth.uid()
  OR public.is_admin(auth.uid())
);

-- Add UPDATE policy for route owners
CREATE POLICY "Users can update their own routes" 
ON public.routes_generated 
FOR UPDATE 
TO authenticated 
USING (
  driver_id = auth.uid() 
  OR public.is_admin(auth.uid())
)
WITH CHECK (
  driver_id = auth.uid() 
  OR public.is_admin(auth.uid())
);