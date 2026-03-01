
-- Drop existing functions with old signatures
DROP FUNCTION IF EXISTS public.resolve_audience_segment(uuid);
DROP FUNCTION IF EXISTS public.resolve_audience_count(uuid);

-- PHASE 1: Unified Customer Orders View
CREATE OR REPLACE VIEW public.unified_customer_orders AS
SELECT
  i.id AS order_id,
  CASE WHEN i.is_historical = true THEN 'legacy' ELSE 'store' END AS invoice_source,
  i.store_id,
  sm.store_name,
  sm.phone,
  sm.address,
  COALESCE(i.total, i.total_amount, 0) AS total_amount,
  COALESCE(i.payment_status, i.status, 'unknown') AS status,
  i.created_at,
  i.paid_at
FROM public.invoices i
LEFT JOIN public.store_master sm ON sm.id = i.store_id
WHERE i.deleted_at IS NULL
UNION ALL
SELECT
  ci.id, 'crm', NULL::uuid, cc.name, cc.phone, cc.address,
  COALESCE(ci.total_amount, 0), COALESCE(ci.status, 'unknown'),
  ci.created_at, ci.receipt_delivered_at
FROM public.customer_invoices ci
LEFT JOIN public.crm_customers cc ON cc.id = ci.customer_id
UNION ALL
SELECT
  wo.id, 'wholesale', wo.store_id, sm2.store_name, sm2.phone, sm2.address,
  COALESCE(wo.total, 0), COALESCE(wo.status, 'unknown'),
  wo.created_at, wo.delivered_at
FROM public.wholesale_orders wo
LEFT JOIN public.store_master sm2 ON sm2.id = wo.store_id
UNION ALL
SELECT
  mo.id, 'marketplace', NULL::uuid,
  COALESCE(mo.customer_email, 'Marketplace Customer'),
  mo.customer_phone, (mo.shipping_address->>'line1')::text,
  COALESCE(mo.total, 0), COALESCE(mo.payment_status, 'unknown'),
  mo.created_at, NULL::timestamptz
FROM public.marketplace_orders mo;

-- PHASE 2: Phone Normalizer
CREATE OR REPLACE FUNCTION public.normalize_phone(raw_phone text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN regexp_replace(COALESCE(raw_phone, ''), '[^0-9]', '', 'g') = '' THEN NULL
    ELSE regexp_replace(COALESCE(raw_phone, ''), '[^0-9]', '', 'g')
  END;
$$;

-- PHASE 3: Unified Customer Identity Resolver
CREATE OR REPLACE FUNCTION public.resolve_previous_customers()
RETURNS TABLE(
  store_id uuid, store_name text, phone text,
  total_orders bigint, lifetime_spend numeric, last_order_date timestamptz,
  sources_used text[], match_method text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH order_data AS (
    SELECT o.* FROM unified_customer_orders o
    WHERE o.status IN ('paid','completed','sent','finalized','delivered','active','partial')
  ),
  id_matched AS (
    SELECT sm.id AS mid, sm.store_name AS mname, sm.phone AS mphone,
      od.order_id, od.total_amount, od.created_at AS order_date, od.invoice_source, 'id'::text AS method
    FROM order_data od JOIN store_master sm ON sm.id = od.store_id WHERE od.store_id IS NOT NULL
  ),
  phone_matched AS (
    SELECT sm.id, sm.store_name, sm.phone,
      od.order_id, od.total_amount, od.created_at, od.invoice_source, 'phone'::text
    FROM order_data od JOIN store_master sm
      ON normalize_phone(od.phone) = normalize_phone(sm.phone)
      AND length(normalize_phone(od.phone)) >= 10
    WHERE od.store_id IS NULL AND od.phone IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM id_matched im WHERE im.order_id = od.order_id)
  ),
  name_matched AS (
    SELECT sm.id, sm.store_name, sm.phone,
      od.order_id, od.total_amount, od.created_at, od.invoice_source, 'name'::text
    FROM order_data od JOIN store_master sm ON lower(trim(od.store_name)) = lower(trim(sm.store_name))
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
  JOIN store_master sf ON sf.id = am.mid
  WHERE sf.phone IS NOT NULL AND length(normalize_phone(sf.phone)) >= 10
    AND sf.last_opt_out_timestamp IS NULL
  GROUP BY am.mid, am.mname, am.mphone;
END;
$$;

-- PHASE 4: Fast Count
CREATE OR REPLACE FUNCTION public.resolve_previous_customers_count()
RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT count(DISTINCT store_id) FROM resolve_previous_customers();
$$;

-- Audience Diagnostics
CREATE OR REPLACE FUNCTION public.audience_diagnostics()
RETURNS TABLE(
  total_invoices_scanned bigint, matched_by_id bigint,
  matched_by_phone bigint, matched_by_name bigint,
  unmatched_invoices bigint, unique_customers bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total bigint; v_id bigint; v_phone bigint; v_name bigint; v_customers bigint;
BEGIN
  SELECT count(*) INTO v_total FROM unified_customer_orders
    WHERE status IN ('paid','completed','sent','finalized','delivered','active','partial');
  SELECT count(*) INTO v_id FROM resolve_previous_customers() WHERE match_method = 'id';
  SELECT count(*) INTO v_phone FROM resolve_previous_customers() WHERE match_method = 'phone';
  SELECT count(*) INTO v_name FROM resolve_previous_customers() WHERE match_method = 'name';
  SELECT count(DISTINCT store_id) INTO v_customers FROM resolve_previous_customers();
  RETURN QUERY SELECT v_total, v_id, v_phone, v_name, v_total - (v_id + v_phone + v_name), v_customers;
END;
$$;

-- Updated resolve_audience_segment with new signature (sources_used + match_method)
CREATE OR REPLACE FUNCTION public.resolve_audience_segment(p_segment_id uuid)
RETURNS TABLE(
  store_id uuid, store_name text, phone text,
  total_orders bigint, lifetime_spend numeric, last_order_date timestamptz,
  sources_used text[], match_method text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY SELECT r.store_id, r.store_name, r.phone,
    r.total_orders, r.lifetime_spend, r.last_order_date,
    r.sources_used, r.match_method
  FROM resolve_previous_customers() r;
END;
$$;

-- Updated resolve_audience_count
CREATE OR REPLACE FUNCTION public.resolve_audience_count(p_segment_id uuid)
RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT resolve_previous_customers_count();
$$;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_store_master_phone_norm ON public.store_master (phone);
CREATE INDEX IF NOT EXISTS idx_invoices_store_id ON public.invoices (store_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON public.invoices (payment_status) WHERE deleted_at IS NULL;
