-- Allow elevated users (owner, admin, etc.) to update any profile
CREATE POLICY "Elevated users can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (is_elevated_user())
WITH CHECK (is_elevated_user());
