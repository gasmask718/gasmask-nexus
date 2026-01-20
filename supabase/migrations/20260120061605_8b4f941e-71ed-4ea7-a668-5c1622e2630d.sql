-- Fix overly permissive INSERT policy on portal_security_events
-- Drop the permissive policy and create a more restrictive one
DROP POLICY IF EXISTS "System can create security events" ON portal_security_events;

-- Allow authenticated users to create security events (logged events from portals)
CREATE POLICY "Authenticated users can create security events" ON portal_security_events
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);