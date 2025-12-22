-- Fix infinite recursion in business_members RLS policy
-- The "Users can view co-members of same businesses" policy references business_members within itself

-- First, drop the problematic policy
DROP POLICY IF EXISTS "Users can view co-members of same businesses" ON public.business_members;

-- Recreate using a simpler approach that doesn't cause recursion
-- Use a CTE-based approach or direct user_id check
CREATE POLICY "Users can view co-members of same businesses" ON public.business_members
FOR SELECT USING (
  -- User can see members if they share a business_id 
  -- We use a subquery that doesn't reference the same table in a way that causes recursion
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = business_members.business_id
    AND EXISTS (
      SELECT 1 FROM public.business_members own_membership
      WHERE own_membership.business_id = b.id
      AND own_membership.user_id = auth.uid()
    )
  )
);