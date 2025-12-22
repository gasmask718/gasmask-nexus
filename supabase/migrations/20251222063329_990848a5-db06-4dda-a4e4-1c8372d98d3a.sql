-- Add RLS policies for authenticated users on purchase_orders

-- Allow authenticated users to insert purchase orders
CREATE POLICY "Authenticated users can insert purchase_orders"
ON public.purchase_orders
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to view purchase orders
CREATE POLICY "Authenticated users can view purchase_orders"
ON public.purchase_orders
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to update purchase orders
CREATE POLICY "Authenticated users can update purchase_orders"
ON public.purchase_orders
FOR UPDATE
TO authenticated
USING (true);

-- Allow authenticated users to delete purchase orders
CREATE POLICY "Authenticated users can delete purchase_orders"
ON public.purchase_orders
FOR DELETE
TO authenticated
USING (true);