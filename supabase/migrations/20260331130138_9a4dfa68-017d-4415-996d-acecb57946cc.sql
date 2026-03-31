
-- Add service_role policies to staff_members_ut for edge function safety
DROP POLICY IF EXISTS "Allow service role full access staff_ut" ON public.staff_members_ut;

CREATE POLICY "Allow service role full access staff_ut"
ON public.staff_members_ut
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Also ensure unforgettable_ambassadors has service_role access
DROP POLICY IF EXISTS "Allow service role full access ambassadors" ON public.unforgettable_ambassadors;

CREATE POLICY "Allow service role full access ambassadors"
ON public.unforgettable_ambassadors
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
