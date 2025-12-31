-- Drop the existing overly restrictive policy
DROP POLICY IF EXISTS "Admins manage store_master" ON public.store_master;

-- Allow authenticated users to view all store_master records
CREATE POLICY "Authenticated users can view store_master"
ON public.store_master
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to create store_master records
CREATE POLICY "Authenticated users can create store_master"
ON public.store_master
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update store_master records
CREATE POLICY "Authenticated users can update store_master"
ON public.store_master
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Only admins can delete store_master records (protection)
CREATE POLICY "Admins can delete store_master"
ON public.store_master
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));