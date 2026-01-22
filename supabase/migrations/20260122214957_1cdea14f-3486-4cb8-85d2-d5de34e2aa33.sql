-- Ensure pgcrypto extension is in extensions schema (where Supabase puts it)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Recreate audit_compute_hash to use schema-qualified digest function
CREATE OR REPLACE FUNCTION public.audit_compute_hash(prev text, payload jsonb)
RETURNS text 
LANGUAGE sql 
IMMUTABLE 
SET search_path = public, extensions
AS $$
  SELECT encode(extensions.digest(coalesce(prev,'') || coalesce(payload::text,''), 'sha256'), 'hex');
$$;