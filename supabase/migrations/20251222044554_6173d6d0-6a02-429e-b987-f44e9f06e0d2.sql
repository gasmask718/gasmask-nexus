-- Create a security definer function to check business membership without triggering RLS
CREATE OR REPLACE FUNCTION public.is_business_member(_user_id uuid, _business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.business_members
    WHERE user_id = _user_id
    AND business_id = _business_id
  )
$$;

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can insert logs in their businesses" ON public.communication_logs;

-- Recreate policy using the security definer function
CREATE POLICY "Users can insert logs in their businesses"
ON public.communication_logs
FOR INSERT
WITH CHECK (
  business_id IS NULL 
  OR public.is_business_member(auth.uid(), business_id)
);