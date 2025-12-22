-- Add policies to allow authenticated users to manage supplier products
CREATE POLICY "Authenticated users can view supplier products"
ON public.supplier_products
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert supplier products"
ON public.supplier_products
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update supplier products"
ON public.supplier_products
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete supplier products"
ON public.supplier_products
FOR DELETE
TO authenticated
USING (true);