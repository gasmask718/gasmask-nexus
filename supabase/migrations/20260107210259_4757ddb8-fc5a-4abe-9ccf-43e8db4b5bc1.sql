-- Tighten RLS policies for crm_deals (avoid overly-permissive true literals)
DROP POLICY IF EXISTS "Users can view all crm_deals" ON public.crm_deals;
DROP POLICY IF EXISTS "Users can create crm_deals" ON public.crm_deals;
DROP POLICY IF EXISTS "Users can update crm_deals" ON public.crm_deals;
DROP POLICY IF EXISTS "Users can delete crm_deals" ON public.crm_deals;

CREATE POLICY "Users can view crm_deals"
ON public.crm_deals
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create crm_deals"
ON public.crm_deals
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update crm_deals"
ON public.crm_deals
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete crm_deals"
ON public.crm_deals
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);