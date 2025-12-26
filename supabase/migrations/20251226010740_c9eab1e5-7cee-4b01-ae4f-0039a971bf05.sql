-- Add policy allowing owners/admins to see all active businesses
-- This prevents the need to manually add business_members rows for each owner

CREATE POLICY "Owners and admins can view all active businesses"
ON public.businesses
FOR SELECT
USING (
  is_active = true 
  AND (
    public.is_owner(auth.uid()) 
    OR public.is_admin(auth.uid())
    OR id IN (
      SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
    )
  )
);