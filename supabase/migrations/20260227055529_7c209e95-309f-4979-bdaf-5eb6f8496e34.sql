-- Indexes for dialer performance
CREATE INDEX IF NOT EXISTS idx_store_master_phone ON public.store_master(phone);
CREATE INDEX IF NOT EXISTS idx_store_master_state ON public.store_master(state);
CREATE INDEX IF NOT EXISTS idx_territory_addresses_state ON public.territory_addresses(state);

-- Add agent routing columns
DO $$ BEGIN
  ALTER TABLE public.dialer_agent_availability 
    ADD COLUMN IF NOT EXISTS phone_route_type text DEFAULT 'browser',
    ADD COLUMN IF NOT EXISTS forward_phone_e164 text,
    ADD COLUMN IF NOT EXISTS ai_agent_id uuid;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Server-side paginated store search RPC
CREATE OR REPLACE FUNCTION public.search_callable_stores(
  p_search text DEFAULT '',
  p_state text DEFAULT '',
  p_has_phone boolean DEFAULT false,
  p_not_dnc boolean DEFAULT false,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  store_name text,
  owner_name text,
  phone text,
  address text,
  city text,
  state text,
  do_not_call boolean,
  last_order_date timestamptz,
  notes text,
  status text,
  total_count bigint
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total bigint;
BEGIN
  SELECT count(*) INTO v_total
  FROM public.store_master sm
  WHERE (p_search = '' OR sm.store_name ILIKE '%' || p_search || '%' 
       OR sm.phone ILIKE '%' || p_search || '%'
       OR sm.city ILIKE '%' || p_search || '%'
       OR sm.owner_name ILIKE '%' || p_search || '%')
    AND (p_state = '' OR sm.state = p_state)
    AND (NOT p_has_phone OR (sm.phone IS NOT NULL AND sm.phone != ''))
    AND (NOT p_not_dnc OR sm.do_not_call IS NOT TRUE);

  RETURN QUERY
  SELECT 
    sm.id, sm.store_name, sm.owner_name, sm.phone, sm.address,
    sm.city, sm.state,
    COALESCE(sm.do_not_call, false),
    sm.last_order_date, sm.notes, sm.status, v_total
  FROM public.store_master sm
  WHERE (p_search = '' OR sm.store_name ILIKE '%' || p_search || '%' 
       OR sm.phone ILIKE '%' || p_search || '%'
       OR sm.city ILIKE '%' || p_search || '%'
       OR sm.owner_name ILIKE '%' || p_search || '%')
    AND (p_state = '' OR sm.state = p_state)
    AND (NOT p_has_phone OR (sm.phone IS NOT NULL AND sm.phone != ''))
    AND (NOT p_not_dnc OR sm.do_not_call IS NOT TRUE)
  ORDER BY sm.store_name
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Server-side paginated prospect search RPC
CREATE OR REPLACE FUNCTION public.search_callable_prospects(
  p_search text DEFAULT '',
  p_state text DEFAULT '',
  p_source text DEFAULT '',
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  store_name text,
  full_address text,
  city text,
  state text,
  discovered_by text,
  created_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total bigint;
BEGIN
  SELECT count(*) INTO v_total
  FROM public.territory_addresses ta
  WHERE (p_search = '' OR ta.store_name ILIKE '%' || p_search || '%'
       OR ta.city ILIKE '%' || p_search || '%'
       OR ta.full_address ILIKE '%' || p_search || '%')
    AND (p_state = '' OR ta.state = p_state)
    AND (p_source = '' OR ta.discovered_by = p_source);

  RETURN QUERY
  SELECT 
    ta.id, ta.store_name, ta.full_address, ta.city, ta.state,
    ta.discovered_by, ta.created_at, v_total
  FROM public.territory_addresses ta
  WHERE (p_search = '' OR ta.store_name ILIKE '%' || p_search || '%'
       OR ta.city ILIKE '%' || p_search || '%'
       OR ta.full_address ILIKE '%' || p_search || '%')
    AND (p_state = '' OR ta.state = p_state)
    AND (p_source = '' OR ta.discovered_by = p_source)
  ORDER BY ta.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;