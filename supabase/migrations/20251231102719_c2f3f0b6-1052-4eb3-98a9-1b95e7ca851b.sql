-- Drop the old policy that checks profiles.role
DROP POLICY IF EXISTS "Admins can manage store contacts" ON store_contacts;

-- Create new policy using the is_admin() function
CREATE POLICY "Admins can manage store contacts" ON store_contacts
  FOR ALL
  USING (public.is_admin(auth.uid()) OR public.is_owner(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_owner(auth.uid()));