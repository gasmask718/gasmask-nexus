-- Fix RLS for test_call_whitelist - ensure proper INSERT/SELECT/UPDATE/DELETE policies

-- First ensure RLS is enabled
ALTER TABLE public.test_call_whitelist ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to recreate cleanly
DROP POLICY IF EXISTS "Allow admins to insert test numbers" ON public.test_call_whitelist;
DROP POLICY IF EXISTS "Admins can insert test call numbers" ON public.test_call_whitelist;
DROP POLICY IF EXISTS "Admins can view test call whitelist" ON public.test_call_whitelist;
DROP POLICY IF EXISTS "Admins can update test call whitelist" ON public.test_call_whitelist;
DROP POLICY IF EXISTS "Admins can delete test call whitelist" ON public.test_call_whitelist;

-- Create SELECT policy for elevated roles (uses user_profiles.primary_role)
CREATE POLICY "Admins can view test call whitelist"
ON public.test_call_whitelist
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.user_id = auth.uid()
      AND up.primary_role IN ('admin', 'owner', 'ceo', 'va')
  )
);

-- Create INSERT policy for elevated roles
CREATE POLICY "Admins can insert test call numbers"
ON public.test_call_whitelist
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.user_id = auth.uid()
      AND up.primary_role IN ('admin', 'owner', 'ceo', 'va')
  )
);

-- Create UPDATE policy for elevated roles
CREATE POLICY "Admins can update test call whitelist"
ON public.test_call_whitelist
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.user_id = auth.uid()
      AND up.primary_role IN ('admin', 'owner', 'ceo', 'va')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.user_id = auth.uid()
      AND up.primary_role IN ('admin', 'owner', 'ceo', 'va')
  )
);

-- Create DELETE policy for elevated roles
CREATE POLICY "Admins can delete test call whitelist"
ON public.test_call_whitelist
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.user_id = auth.uid()
      AND up.primary_role IN ('admin', 'owner', 'ceo', 'va')
  )
);

-- Ensure unique index exists to prevent duplicate test numbers
CREATE UNIQUE INDEX IF NOT EXISTS idx_test_call_whitelist_phone_unique
ON public.test_call_whitelist(phone_number);