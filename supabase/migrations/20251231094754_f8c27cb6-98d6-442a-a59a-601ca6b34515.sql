-- Drop existing policy
DROP POLICY IF EXISTS "Owners and admins can manage invoices" ON invoices;

-- Create updated policy that includes elevated users
CREATE POLICY "Elevated users can manage invoices"
ON invoices
FOR ALL
USING (
  public.is_owner(auth.uid()) OR 
  public.is_admin(auth.uid()) OR
  public.is_elevated_user(auth.uid())
)
WITH CHECK (
  public.is_owner(auth.uid()) OR 
  public.is_admin(auth.uid()) OR
  public.is_elevated_user(auth.uid())
);