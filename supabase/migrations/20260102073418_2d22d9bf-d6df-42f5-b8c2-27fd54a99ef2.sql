-- Drop incorrect policies that check profiles.role
DROP POLICY IF EXISTS "Admins can insert store opportunities" ON public.store_opportunities;
DROP POLICY IF EXISTS "Admins can update store opportunities" ON public.store_opportunities;
DROP POLICY IF EXISTS "Admins can delete store opportunities" ON public.store_opportunities;

-- Create correct policies using is_elevated_user() function
CREATE POLICY "Elevated users can insert store opportunities"
ON public.store_opportunities
FOR INSERT
TO authenticated
WITH CHECK (public.is_elevated_user(auth.uid()));

CREATE POLICY "Elevated users can update store opportunities"
ON public.store_opportunities
FOR UPDATE
TO authenticated
USING (public.is_elevated_user(auth.uid()));

CREATE POLICY "Elevated users can delete store opportunities"
ON public.store_opportunities
FOR DELETE
TO authenticated
USING (public.is_elevated_user(auth.uid()));