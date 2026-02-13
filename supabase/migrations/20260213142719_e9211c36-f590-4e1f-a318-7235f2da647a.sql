
-- Admin can read all location events
CREATE POLICY "Admins can view all location events"
ON public.location_events FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.user_id = auth.uid()
    AND user_profiles.primary_role IN ('admin','owner','ceo','va')
  )
  OR
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin','owner')
  )
);
