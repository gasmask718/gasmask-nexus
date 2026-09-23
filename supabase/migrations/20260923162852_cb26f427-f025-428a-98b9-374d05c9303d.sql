CREATE OR REPLACE FUNCTION public.ambassador_visible_store_geography()
RETURNS TABLE (
  store_id uuid,
  city text,
  borough text,
  neighborhood text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT sm.id, sm.city, sm.borough, sm.neighborhood
  FROM public.store_master sm
  WHERE sm.deleted_at IS NULL
    AND public.ambassador_has_store_access(auth.uid(), sm.id)
  ORDER BY sm.id;
$function$;

REVOKE ALL ON FUNCTION public.ambassador_visible_store_geography() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ambassador_visible_store_geography() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ambassador_visible_store_geography() TO service_role;