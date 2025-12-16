-- Fix linter issues:
-- 1) RLS enabled but no policy on public.store_extracted_profiles
-- 2) Function public.update_thread_on_message missing fixed search_path

-- Ensure RLS is enabled (safe if already enabled)
ALTER TABLE public.store_extracted_profiles ENABLE ROW LEVEL SECURITY;

-- Add admin-only access policies
DROP POLICY IF EXISTS "Admins can access store extracted profiles" ON public.store_extracted_profiles;

CREATE POLICY "Admins can access store extracted profiles"
ON public.store_extracted_profiles
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Lock function search_path
ALTER FUNCTION public.update_thread_on_message() SET search_path TO 'public';