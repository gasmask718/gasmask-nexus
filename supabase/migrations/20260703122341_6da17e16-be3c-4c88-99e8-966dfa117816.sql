-- Ensure explicit Data API grants on dnc_list
GRANT SELECT, INSERT, DELETE ON public.dnc_list TO authenticated;
GRANT ALL ON public.dnc_list TO service_role;

-- Relax INSERT policy: allow any authenticated user to add DNC entries
-- (DNC additions are audit-logged via dc-log-compliance-event; suppression is
-- fail-safe — an over-broad DNC only prevents outbound calls.)
DROP POLICY IF EXISTS "Admins can insert DNC entries" ON public.dnc_list;
CREATE POLICY "Authenticated users can add DNC entries"
ON public.dnc_list
FOR INSERT
TO authenticated
WITH CHECK (true);