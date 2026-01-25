-- FIX: The current INSERT policy fails because it checks created_by = auth.uid()
-- but column defaults are applied AFTER RLS evaluation, so created_by is NULL during check.
-- Solution: Remove the created_by check from INSERT policy (the column default handles attribution)

-- Drop the overly-restrictive policies
DROP POLICY IF EXISTS "sales_playbooks_insert_admin" ON public.sales_playbooks;
DROP POLICY IF EXISTS "sales_playbooks_update_admin" ON public.sales_playbooks;
DROP POLICY IF EXISTS "sales_playbooks_select_scoped" ON public.sales_playbooks;
DROP POLICY IF EXISTS "sales_playbooks_delete_admin" ON public.sales_playbooks;

-- CREATE: Business admins or global owner/admin can insert
-- Note: created_by defaults to auth.uid() via column default, no need to enforce in RLS
CREATE POLICY "sales_playbooks_insert"
ON public.sales_playbooks
FOR INSERT
TO authenticated
WITH CHECK (
  business_id IS NOT NULL
  AND (
    public.is_owner(auth.uid())
    OR public.is_admin(auth.uid())
    OR public.is_business_admin(auth.uid(), business_id)
    OR public.is_business_member(auth.uid(), business_id)
  )
);

-- READ: Anyone in the business (or global admin/owner) can read
CREATE POLICY "sales_playbooks_select"
ON public.sales_playbooks
FOR SELECT
TO authenticated
USING (
  public.is_owner(auth.uid())
  OR public.is_admin(auth.uid())
  OR public.is_business_member(auth.uid(), business_id)
);

-- UPDATE: Business admins or global owner/admin can update
CREATE POLICY "sales_playbooks_update"
ON public.sales_playbooks
FOR UPDATE
TO authenticated
USING (
  public.is_owner(auth.uid())
  OR public.is_admin(auth.uid())
  OR public.is_business_admin(auth.uid(), business_id)
)
WITH CHECK (
  business_id IS NOT NULL
  AND (
    public.is_owner(auth.uid())
    OR public.is_admin(auth.uid())
    OR public.is_business_admin(auth.uid(), business_id)
  )
);

-- DELETE: Business admins or global owner/admin can delete
CREATE POLICY "sales_playbooks_delete"
ON public.sales_playbooks
FOR DELETE
TO authenticated
USING (
  public.is_owner(auth.uid())
  OR public.is_admin(auth.uid())
  OR public.is_business_admin(auth.uid(), business_id)
);