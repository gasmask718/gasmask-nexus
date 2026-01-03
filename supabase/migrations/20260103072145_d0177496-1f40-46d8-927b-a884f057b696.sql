-- Create is_va function
CREATE OR REPLACE FUNCTION public.is_va(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
    AND role = 'va'
  )
$$;

-- Now recreate the policy with all staff roles
DROP POLICY IF EXISTS "Admins can manage store contacts" ON public.store_contacts;

CREATE POLICY "Staff can manage store contacts" 
ON public.store_contacts 
FOR ALL 
USING (
  is_admin(auth.uid()) OR 
  is_owner(auth.uid()) OR 
  is_va(auth.uid()) OR
  is_elevated_user(auth.uid())
)
WITH CHECK (
  is_admin(auth.uid()) OR 
  is_owner(auth.uid()) OR 
  is_va(auth.uid()) OR
  is_elevated_user(auth.uid())
);