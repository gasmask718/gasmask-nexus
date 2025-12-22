-- Add policy to allow authenticated users to insert inventory records
CREATE POLICY "Authenticated users can insert tube inventory"
ON public.store_tube_inventory
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Add policy to allow authenticated users to update their own records
CREATE POLICY "Authenticated users can update tube inventory"
ON public.store_tube_inventory
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Add policy to allow authenticated users to delete inventory
CREATE POLICY "Authenticated users can delete tube inventory"
ON public.store_tube_inventory
FOR DELETE
TO authenticated
USING (true);