-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Admins can manage invoices" ON invoices;

-- Create new policy that allows owners and admins to manage all invoices
CREATE POLICY "Owners and admins can manage invoices"
ON invoices
FOR ALL
USING (
  public.is_owner(auth.uid()) OR 
  public.is_admin(auth.uid())
)
WITH CHECK (
  public.is_owner(auth.uid()) OR 
  public.is_admin(auth.uid())
);

-- Update the SELECT policy to also allow elevated users to view all invoices
DROP POLICY IF EXISTS "Stores can view their invoices" ON invoices;

CREATE POLICY "Users can view relevant invoices"
ON invoices
FOR SELECT
USING (
  public.is_owner(auth.uid()) OR 
  public.is_admin(auth.uid()) OR
  public.is_elevated_user(auth.uid()) OR
  store_id IN (SELECT id FROM stores WHERE id = invoices.store_id)
);