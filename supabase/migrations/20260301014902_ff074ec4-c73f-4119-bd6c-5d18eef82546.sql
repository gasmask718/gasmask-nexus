-- RPC to resolve audience segment members from invoices
CREATE OR REPLACE FUNCTION public.resolve_audience_segment(p_segment_id uuid)
RETURNS TABLE(
  store_id uuid,
  store_name text,
  phone text,
  last_order_date timestamptz,
  total_orders bigint,
  lifetime_spend numeric
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_name text;
BEGIN
  SELECT name INTO v_name FROM audience_segments WHERE id = p_segment_id;

  IF v_name ILIKE '%previous customer%' THEN
    RETURN QUERY
      SELECT
        sm.id AS store_id,
        sm.store_name,
        sm.phone,
        MAX(i.created_at) AS last_order_date,
        COUNT(DISTINCT i.id) AS total_orders,
        COALESCE(SUM(i.total), 0) AS lifetime_spend
      FROM store_master sm
      JOIN invoices i ON i.store_id = sm.id
      WHERE i.payment_status IN ('paid','completed','sent','finalized')
        AND sm.phone IS NOT NULL
      GROUP BY sm.id, sm.store_name, sm.phone;
  ELSE
    RETURN QUERY
      SELECT
        sm.id AS store_id,
        sm.store_name,
        sm.phone,
        NULL::timestamptz AS last_order_date,
        0::bigint AS total_orders,
        0::numeric AS lifetime_spend
      FROM store_master sm
      WHERE sm.phone IS NOT NULL;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_audience_count(p_segment_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
  v_name text;
BEGIN
  SELECT name INTO v_name FROM audience_segments WHERE id = p_segment_id;

  IF v_name ILIKE '%previous customer%' THEN
    SELECT COUNT(DISTINCT sm.id) INTO v_count
    FROM store_master sm
    JOIN invoices i ON i.store_id = sm.id
    WHERE i.payment_status IN ('paid','completed','sent','finalized')
      AND sm.phone IS NOT NULL;
  ELSE
    SELECT COUNT(*) INTO v_count FROM store_master WHERE phone IS NOT NULL;
  END IF;

  RETURN v_count;
END;
$$;