-- Simplify RLS policies for sales_playbooks to ensure they work reliably
-- The helper functions exist and are SECURITY DEFINER, but let's simplify the logic

-- Drop existing policies
DROP POLICY IF EXISTS "sales_playbooks_select" ON public.sales_playbooks;
DROP POLICY IF EXISTS "sales_playbooks_insert" ON public.sales_playbooks;
DROP POLICY IF EXISTS "sales_playbooks_update" ON public.sales_playbooks;
DROP POLICY IF EXISTS "sales_playbooks_delete" ON public.sales_playbooks;

-- SELECT: Allow if user is global admin/owner OR member of the business
CREATE POLICY "sales_playbooks_select"
ON public.sales_playbooks
FOR SELECT
TO authenticated
USING (
  -- Global owner check
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
  OR
  -- Business membership check
  EXISTS (
    SELECT 1 FROM public.business_members
    WHERE user_id = auth.uid() AND business_id = sales_playbooks.business_id
  )
);

-- INSERT: Allow if user is global admin/owner OR member of the business
CREATE POLICY "sales_playbooks_insert"
ON public.sales_playbooks
FOR INSERT
TO authenticated
WITH CHECK (
  business_id IS NOT NULL
  AND (
    -- Global owner/admin check
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR
    -- Business membership check
    EXISTS (
      SELECT 1 FROM public.business_members
      WHERE user_id = auth.uid() AND business_id = sales_playbooks.business_id
    )
  )
);

-- UPDATE: Allow if user is global admin/owner OR business admin/owner
CREATE POLICY "sales_playbooks_update"
ON public.sales_playbooks
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.business_members
    WHERE user_id = auth.uid() 
      AND business_id = sales_playbooks.business_id 
      AND role IN ('owner', 'admin')
  )
)
WITH CHECK (
  business_id IS NOT NULL
);

-- DELETE: Allow if user is global admin/owner OR business admin/owner
CREATE POLICY "sales_playbooks_delete"
ON public.sales_playbooks
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.business_members
    WHERE user_id = auth.uid() 
      AND business_id = sales_playbooks.business_id 
      AND role IN ('owner', 'admin')
  )
);