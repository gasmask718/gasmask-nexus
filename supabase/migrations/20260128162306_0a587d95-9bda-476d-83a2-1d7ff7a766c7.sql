-- Clean up duplicate SELECT policy and unify
DROP POLICY IF EXISTS "Sales reps can view assigned prospects" ON public.sales_prospects;

-- Also fix the UPDATE policy to include owner role
DROP POLICY IF EXISTS "Sales reps can update assigned prospects" ON public.sales_prospects;

CREATE POLICY "Users can update leads they own or are assigned"
ON public.sales_prospects
FOR UPDATE
TO authenticated
USING (
  assigned_to = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'owner', 'csr')
  )
);