-- Fix store_contacts RLS so authenticated staff can add contacts reliably
-- (Previous policy relied on user_roles having a 'va' row, which currently isn't set up for VA accounts.)

-- Ensure RLS is on
ALTER TABLE public.store_contacts ENABLE ROW LEVEL SECURITY;

-- Restrict reads to authenticated users (phone numbers / emails are PII)
DROP POLICY IF EXISTS "Anyone can view store contacts" ON public.store_contacts;
CREATE POLICY "Authenticated users can view store contacts"
ON public.store_contacts
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to manage store contacts (insert/update/delete)
DROP POLICY IF EXISTS "Staff can manage store contacts" ON public.store_contacts;
CREATE POLICY "Authenticated users can manage store contacts"
ON public.store_contacts
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);
