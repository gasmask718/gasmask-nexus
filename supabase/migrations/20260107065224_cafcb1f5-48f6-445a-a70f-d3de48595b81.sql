-- Add policy to allow authenticated users to view all orders for Brand CRM
CREATE POLICY "Authenticated users can view orders"
ON public.wholesale_orders
FOR SELECT
USING (auth.uid() IS NOT NULL);