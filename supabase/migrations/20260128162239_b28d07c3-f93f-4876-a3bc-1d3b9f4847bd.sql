-- MASTER GENIUS ARCHITECT: Fix RLS for leads visibility
-- Add owner role to the SELECT policy

-- Create comprehensive SELECT policy that covers all valid access patterns
CREATE POLICY "Users can view leads they own or are assigned"
ON public.sales_prospects
FOR SELECT
TO authenticated
USING (
  -- Anyone assigned to the lead can see it
  assigned_to = auth.uid()
  -- Admins, owners, and CSRs can see all leads
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'owner', 'csr')
  )
);