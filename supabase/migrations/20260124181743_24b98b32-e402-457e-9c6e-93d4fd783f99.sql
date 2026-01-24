-- Fix Test Call Whitelist RLS Policies (Correctly and Securely)

-- 1. Ensure RLS is enabled
ALTER TABLE public.test_call_whitelist ENABLE ROW LEVEL SECURITY;

-- 2. Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "Admins can insert test call numbers" ON public.test_call_whitelist;
DROP POLICY IF EXISTS "Admins can view test call whitelist" ON public.test_call_whitelist;
DROP POLICY IF EXISTS "Admins can update test call whitelist" ON public.test_call_whitelist;
DROP POLICY IF EXISTS "Admins can delete test call numbers" ON public.test_call_whitelist;

-- 3. Create SELECT policy for elevated roles
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

-- 4. Create INSERT policy for elevated roles
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

-- 5. Create UPDATE policy for elevated roles
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
);

-- 6. Create DELETE policy for elevated roles
CREATE POLICY "Admins can delete test call numbers"
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

-- 7. Prevent duplicate test numbers
CREATE UNIQUE INDEX IF NOT EXISTS idx_test_call_whitelist_phone_unique
ON public.test_call_whitelist(phone_number);