CREATE OR REPLACE FUNCTION public.check_store_address_duplicates(p_address text)
RETURNS TABLE (
  id uuid,
  store_name text,
  address text,
  city text,
  state text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sm.id, sm.store_name, sm.address, sm.city, sm.state
  FROM public.store_master sm
  WHERE sm.deleted_at IS NULL
    AND p_address IS NOT NULL
    AND length(btrim(p_address)) >= 5
    AND upper(sm.address) ILIKE '%' || upper(btrim(p_address)) || '%'
  LIMIT 5;
$$;

GRANT EXECUTE ON FUNCTION public.check_store_address_duplicates(text) TO authenticated;