-- Harden sales_playbooks persistence + tighten RLS to business scope
-- Goals:
-- 1) No more permissive USING(true) policies (prevents cross-business access)
-- 2) Allow members to read playbooks for businesses they belong to
-- 3) Allow only business admins (or global owner/admin) to create/update/delete
-- 4) Ensure created_by is populated from the authenticated user by default

-- Ensure required scoping field is not nullable (safe: table is empty in both Test and Live as of analysis)
ALTER TABLE public.sales_playbooks
  ALTER COLUMN business_id SET NOT NULL;

-- Ensure creator attribution is automatically set on client inserts
ALTER TABLE public.sales_playbooks
  ALTER COLUMN created_by SET DEFAULT auth.uid();

-- Drop previous overly-permissive policies
DROP POLICY IF EXISTS "auth_select_sales_playbooks" ON public.sales_playbooks;
DROP POLICY IF EXISTS "auth_insert_sales_playbooks" ON public.sales_playbooks;
DROP POLICY IF EXISTS "auth_update_sales_playbooks" ON public.sales_playbooks;
DROP POLICY IF EXISTS "auth_delete_sales_playbooks" ON public.sales_playbooks;

-- READ: any authenticated business member (or global owner/admin) can read playbooks for that business
CREATE POLICY "sales_playbooks_select_scoped"
ON public.sales_playbooks
FOR SELECT
TO authenticated
USING (
  public.is_owner(auth.uid())
  OR public.is_admin(auth.uid())
  OR public.is_business_member(auth.uid(), business_id)
);

-- WRITE: only business admins (or global owner/admin) may create playbooks
CREATE POLICY "sales_playbooks_insert_admin"
ON public.sales_playbooks
FOR INSERT
TO authenticated
WITH CHECK (
  (public.is_owner(auth.uid())
   OR public.is_admin(auth.uid())
   OR public.is_business_admin(auth.uid(), business_id))
  AND business_id IS NOT NULL
  AND created_by = auth.uid()
);

-- WRITE: only business admins (or global owner/admin) may update playbooks
CREATE POLICY "sales_playbooks_update_admin"
ON public.sales_playbooks
FOR UPDATE
TO authenticated
USING (
  public.is_owner(auth.uid())
  OR public.is_admin(auth.uid())
  OR public.is_business_admin(auth.uid(), business_id)
)
WITH CHECK (
  (public.is_owner(auth.uid())
   OR public.is_admin(auth.uid())
   OR public.is_business_admin(auth.uid(), business_id))
  AND business_id IS NOT NULL
  AND created_by = auth.uid()
);

-- WRITE: only business admins (or global owner/admin) may delete playbooks
CREATE POLICY "sales_playbooks_delete_admin"
ON public.sales_playbooks
FOR DELETE
TO authenticated
USING (
  public.is_owner(auth.uid())
  OR public.is_admin(auth.uid())
  OR public.is_business_admin(auth.uid(), business_id)
);

-- Note: RLS is already enabled on this table; keep as-is.
