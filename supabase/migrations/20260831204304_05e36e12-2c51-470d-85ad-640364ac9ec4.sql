-- v_store_who_to_contact is security_invoker: underlying store_master /
-- store_contacts RLS still scopes each caller. Without this grant the VA
-- dialer list returns a permission error for every signed-in user.
GRANT SELECT ON public.v_store_who_to_contact TO authenticated;
REVOKE ALL ON public.v_store_who_to_contact FROM anon;