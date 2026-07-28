ALTER TABLE public.communication_logs DROP CONSTRAINT IF EXISTS communication_logs_store_id_fkey;

CREATE OR REPLACE VIEW public.store_directory
WITH (security_invoker = on) AS
SELECT
  sm.id,
  sm.store_name,
  sm.phone,
  sm.status,
  sm.store_type,
  sm.relationship_status,
  'store_master'::text AS source
FROM public.store_master sm
UNION
SELECT
  s.id,
  s.name AS store_name,
  s.phone,
  s.status::text,
  NULL::text AS store_type,
  NULL::text AS relationship_status,
  'stores'::text AS source
FROM public.stores s
WHERE NOT EXISTS (SELECT 1 FROM public.store_master sm2 WHERE sm2.id = s.id);

GRANT SELECT ON public.store_directory TO authenticated;
GRANT SELECT ON public.store_directory TO anon;
GRANT ALL ON public.store_directory TO service_role;