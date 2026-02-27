
DROP FUNCTION IF EXISTS public.search_callable_stores(text,text,boolean,boolean,integer,integer);

CREATE FUNCTION public.search_callable_stores(
  p_search text DEFAULT '',
  p_state text DEFAULT '',
  p_has_phone boolean DEFAULT false,
  p_not_dnc boolean DEFAULT false,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  store_name text,
  owner_name text,
  phone text,
  city text,
  state text,
  do_not_call boolean,
  last_order_date timestamptz,
  total_count bigint
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sm.id,
    sm.store_name,
    sm.owner_name,
    sm.phone,
    sm.city,
    sm.state,
    COALESCE(sm.do_not_call, false),
    sm.last_order_date::timestamptz,
    count(*) OVER() AS total_count
  FROM public.store_master sm
  WHERE
    (p_search = '' OR sm.store_name ILIKE '%' || p_search || '%' OR sm.phone ILIKE '%' || p_search || '%' OR sm.city ILIKE '%' || p_search || '%' OR sm.owner_name ILIKE '%' || p_search || '%')
    AND (p_state = '' OR sm.state = p_state)
    AND (NOT p_has_phone OR (sm.phone IS NOT NULL AND sm.phone <> ''))
    AND (NOT p_not_dnc OR COALESCE(sm.do_not_call, false) = false)
  ORDER BY sm.store_name
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
