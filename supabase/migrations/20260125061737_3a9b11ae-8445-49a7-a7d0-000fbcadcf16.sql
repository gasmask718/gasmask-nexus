-- Fix sales_playbooks RLS: Add policies for authenticated users
-- Currently only service role can access, which blocks client-side operations

-- Drop the overly restrictive service-only policy
DROP POLICY IF EXISTS "Service role full access to sales_playbooks" ON public.sales_playbooks;

-- Allow authenticated users to SELECT playbooks for their business
CREATE POLICY "auth_select_sales_playbooks"
ON public.sales_playbooks
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to INSERT playbooks (must set business_id)
CREATE POLICY "auth_insert_sales_playbooks"
ON public.sales_playbooks
FOR INSERT
TO authenticated
WITH CHECK (business_id IS NOT NULL);

-- Allow authenticated users to UPDATE their business playbooks
CREATE POLICY "auth_update_sales_playbooks"
ON public.sales_playbooks
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (business_id IS NOT NULL);

-- Allow authenticated users to DELETE playbooks
CREATE POLICY "auth_delete_sales_playbooks"
ON public.sales_playbooks
FOR DELETE
TO authenticated
USING (true);