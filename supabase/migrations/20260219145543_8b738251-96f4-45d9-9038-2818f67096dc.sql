
-- Ensure the new diagnostic view runs with invoker rights (so RLS/permissions are the caller's)
ALTER VIEW public.v_tube_integrity_check SET (security_invoker = true);
