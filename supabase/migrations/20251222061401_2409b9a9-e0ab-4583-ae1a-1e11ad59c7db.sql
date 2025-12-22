-- Add policy to allow authenticated users to view warehouses
CREATE POLICY "Authenticated users can view warehouses"
ON public.warehouses
FOR SELECT
TO authenticated
USING (true);

-- Add policy to allow authenticated users to insert warehouses
CREATE POLICY "Authenticated users can insert warehouses"
ON public.warehouses
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Add policy to allow authenticated users to update warehouses
CREATE POLICY "Authenticated users can update warehouses"
ON public.warehouses
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Add policy to allow authenticated users to delete warehouses
CREATE POLICY "Authenticated users can delete warehouses"
ON public.warehouses
FOR DELETE
TO authenticated
USING (true);