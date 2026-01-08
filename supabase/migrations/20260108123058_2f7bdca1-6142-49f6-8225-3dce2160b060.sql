-- Add INSERT policy for route_stops
CREATE POLICY "Authenticated users can insert route stops" 
ON public.route_stops 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Add UPDATE policy for route_stops
CREATE POLICY "Authenticated users can update route stops" 
ON public.route_stops 
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);

-- Add DELETE policy for route_stops
CREATE POLICY "Authenticated users can delete route stops" 
ON public.route_stops 
FOR DELETE 
TO authenticated
USING (true);