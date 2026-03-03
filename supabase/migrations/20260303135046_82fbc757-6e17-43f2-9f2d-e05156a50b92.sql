DROP FUNCTION IF EXISTS public.search_callable_prospects(text, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.search_callable_prospects(
  p_search text DEFAULT '',
  p_state text DEFAULT '',
  p_source text DEFAULT '',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(id uuid, store_name text, full_address text, city text, state text, phone text, discovered_by text, created_at timestamp with time zone, total_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
BEGIN
  SELECT count(*) INTO v_total
  FROM public.territory_addresses ta
  WHERE (p_search = '' OR ta.store_name ILIKE '%' || p_search || '%'
       OR ta.city ILIKE '%' || p_search || '%'
       OR ta.full_address ILIKE '%' || p_search || '%'
       OR ta.phone ILIKE '%' || p_search || '%')
    AND (p_state = '' OR ta.state = p_state)
    AND (p_source = '' OR ta.discovered_by = p_source);

  RETURN QUERY
  SELECT 
    ta.id, ta.store_name, ta.full_address, ta.city, ta.state, ta.phone,
    ta.discovered_by, ta.created_at, v_total
  FROM public.territory_addresses ta
  WHERE (p_search = '' OR ta.store_name ILIKE '%' || p_search || '%'
       OR ta.city ILIKE '%' || p_search || '%'
       OR ta.full_address ILIKE '%' || p_search || '%'
       OR ta.phone ILIKE '%' || p_search || '%')
    AND (p_state = '' OR ta.state = p_state)
    AND (p_source = '' OR ta.discovered_by = p_source)
  ORDER BY ta.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;