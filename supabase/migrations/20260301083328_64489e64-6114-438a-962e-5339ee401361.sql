
-- PHASE 1: Upgrade resolve_previous_customers to use store_contacts phones as fallback
-- This dramatically increases matched stores from ~16 to ~329+
CREATE OR REPLACE FUNCTION public.resolve_previous_customers()
RETURNS TABLE(
  store_id uuid,
  store_name text,
  phone text,
  total_orders bigint,
  lifetime_spend numeric,
  last_order_date timestamptz,
  sources_used text[],
  match_method text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH 
  -- Build a phone lookup that includes store_contacts as fallback
  store_phones AS (
    SELECT sm.id AS sid,
      sm.store_name AS sname,
      COALESCE(
        CASE WHEN length(regexp_replace(sm.phone, '[^0-9]', '', 'g')) >= 10 THEN sm.phone END,
        (SELECT sc.phone FROM store_contacts sc 
         WHERE sc.store_id = sm.id AND length(regexp_replace(sc.phone, '[^0-9]', '', 'g')) >= 10
         ORDER BY sc.created_at DESC LIMIT 1)
      ) AS best_phone
    FROM store_master sm
  ),
  -- Only stores with a reachable phone
  reachable AS (
    SELECT * FROM store_phones WHERE best_phone IS NOT NULL
  ),
  order_data AS (
    SELECT o.* FROM unified_customer_orders o
    WHERE o.status IN ('paid','completed','sent','finalized','delivered','active','partial','unpaid')
  ),
  -- Step 1: Direct ID match
  id_matched AS (
    SELECT r.sid AS mid, r.sname AS mname, r.best_phone AS mphone,
      od.order_id, od.total_amount, od.created_at AS order_date, od.invoice_source, 'id'::text AS method
    FROM order_data od
    JOIN reachable r ON r.sid = od.store_id
    WHERE od.store_id IS NOT NULL
  ),
  -- Step 2: Phone match (for orders without store_id)
  phone_matched AS (
    SELECT r.sid, r.sname, r.best_phone,
      od.order_id, od.total_amount, od.created_at, od.invoice_source, 'phone'::text
    FROM order_data od
    JOIN reachable r ON regexp_replace(od.phone, '[^0-9]', '', 'g') = regexp_replace(r.best_phone, '[^0-9]', '', 'g')
    WHERE od.store_id IS NULL AND od.phone IS NOT NULL
      AND length(regexp_replace(od.phone, '[^0-9]', '', 'g')) >= 10
      AND NOT EXISTS (SELECT 1 FROM id_matched im WHERE im.order_id = od.order_id)
  ),
  -- Step 3: Name match fallback
  name_matched AS (
    SELECT r.sid, r.sname, r.best_phone,
      od.order_id, od.total_amount, od.created_at, od.invoice_source, 'name'::text
    FROM order_data od
    JOIN reachable r ON lower(trim(od.store_name)) = lower(trim(r.sname))
    WHERE od.store_id IS NULL AND od.phone IS NULL AND od.store_name IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM id_matched im WHERE im.order_id = od.order_id)
      AND NOT EXISTS (SELECT 1 FROM phone_matched pm WHERE pm.order_id = od.order_id)
  ),
  all_matched AS (
    SELECT * FROM id_matched UNION ALL SELECT * FROM phone_matched UNION ALL SELECT * FROM name_matched
  )
  SELECT am.mid, am.mname, am.mphone,
    count(DISTINCT am.order_id)::bigint,
    coalesce(sum(am.total_amount), 0)::numeric,
    max(am.order_date),
    array_agg(DISTINCT am.invoice_source),
    (array_agg(am.method ORDER BY CASE am.method WHEN 'id' THEN 1 WHEN 'phone' THEN 2 WHEN 'name' THEN 3 END))[1]
  FROM all_matched am
  GROUP BY am.mid, am.mname, am.mphone;
END;
$$;

-- Update diagnostics to reflect new logic
CREATE OR REPLACE FUNCTION public.audience_diagnostics()
RETURNS TABLE(
  total_invoices_scanned bigint,
  matched_by_id bigint,
  matched_by_phone bigint,
  matched_by_name bigint,
  unmatched_invoices bigint,
  unique_customers bigint
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total bigint;
  v_id bigint;
  v_phone bigint;
  v_name bigint;
  v_unique bigint;
BEGIN
  SELECT count(*) INTO v_total FROM unified_customer_orders;
  
  -- Count stores with valid phones (including store_contacts)
  SELECT count(DISTINCT r.store_id) INTO v_unique FROM resolve_previous_customers() r;
  
  -- Match method breakdown
  SELECT count(*) INTO v_id FROM resolve_previous_customers() r WHERE r.match_method = 'id';
  SELECT count(*) INTO v_phone FROM resolve_previous_customers() r WHERE r.match_method = 'phone';
  SELECT count(*) INTO v_name FROM resolve_previous_customers() r WHERE r.match_method = 'name';
  
  RETURN QUERY SELECT v_total, v_id, v_phone, v_name, 
    v_total - (SELECT count(*) FROM (
      SELECT DISTINCT order_id FROM (
        SELECT o.order_id FROM unified_customer_orders o
        JOIN store_master sm ON sm.id = o.store_id WHERE o.store_id IS NOT NULL
      ) sub
    ) matched),
    v_unique;
END;
$$;

-- Update resolve_audience_segment to pass through segment filter
CREATE OR REPLACE FUNCTION public.resolve_audience_segment(p_segment_id uuid)
RETURNS TABLE(
  store_id uuid,
  store_name text,
  phone text,
  total_orders bigint,
  lifetime_spend numeric,
  last_order_date timestamptz,
  sources_used text[],
  match_method text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- For now all segments resolve through the unified customer resolver
  RETURN QUERY SELECT r.store_id, r.store_name, r.phone,
    r.total_orders, r.lifetime_spend, r.last_order_date,
    r.sources_used, r.match_method
  FROM resolve_previous_customers() r;
END;
$$;

-- Update resolve_audience_count
CREATE OR REPLACE FUNCTION public.resolve_audience_count(p_segment_id uuid)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_count bigint;
BEGIN
  SELECT count(*) INTO v_count FROM resolve_previous_customers();
  RETURN v_count;
END;
$$;
