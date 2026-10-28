-- redeem_portal_invite logs portal_type = invite role ('store'); the check only allowed driver/biker, so every store sign-in redemption failed.
ALTER TABLE public.portal_security_events DROP CONSTRAINT IF EXISTS portal_security_events_portal_type_check;
ALTER TABLE public.portal_security_events ADD CONSTRAINT portal_security_events_portal_type_check
  CHECK (portal_type = ANY (ARRAY['driver','biker','store','ambassador']));