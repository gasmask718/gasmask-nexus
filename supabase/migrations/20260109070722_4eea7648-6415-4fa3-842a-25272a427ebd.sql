-- Add RLS policies for authenticated users to manage store_master records
-- Drop existing simulation-only insert policy
DROP POLICY IF EXISTS "store_master_simulation_insert" ON public.store_master;

-- Create new INSERT policy for authenticated users (admins and employees)
CREATE POLICY "Authenticated users can insert store_master"
ON public.store_master
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create UPDATE policy for authenticated users (admins and employees)
DROP POLICY IF EXISTS "store_master_simulation_update" ON public.store_master;

CREATE POLICY "Authenticated users can update store_master"
ON public.store_master
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Keep select policy open for authenticated users
DROP POLICY IF EXISTS "store_master_simulation_select" ON public.store_master;

CREATE POLICY "Authenticated users can select store_master"
ON public.store_master
FOR SELECT
TO authenticated
USING (true);