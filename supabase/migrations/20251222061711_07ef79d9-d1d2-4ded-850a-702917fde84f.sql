-- Add policy to allow authenticated users to view suppliers
CREATE POLICY "Authenticated users can view suppliers"
ON public.suppliers
FOR SELECT
TO authenticated
USING (true);

-- Add policy to allow authenticated users to insert suppliers
CREATE POLICY "Authenticated users can insert suppliers"
ON public.suppliers
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Add policy to allow authenticated users to update suppliers
CREATE POLICY "Authenticated users can update suppliers"
ON public.suppliers
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Add policy to allow authenticated users to delete suppliers
CREATE POLICY "Authenticated users can delete suppliers"
ON public.suppliers
FOR DELETE
TO authenticated
USING (true);