
-- Drop the parameterless overload that conflicts
DROP FUNCTION IF EXISTS public.resolve_previous_customers();

-- Now recreate everything cleanly

CREATE OR REPLACE FUNCTION public.normalize_phone(input text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE digits text;
BEGIN
  IF input IS NULL THEN RETURN NULL; END IF;
  digits := regexp_replace(input, '[^0-9]', '', 'g');
  IF length(digits) = 11 AND left(digits, 1) = '1' THEN digits := right(digits, 10); END IF;
  IF length(digits) < 10 THEN RETURN NULL; END IF;
  RETURN digits;
END;
$$;

CREATE OR REPLACE VIEW public.invoices_unified AS
SELECT 'store:' || i.id::text AS invoice_uid, i.id::text AS invoice_id, 'store'::text AS invoice_source,
  i.store_id, sm.store_name, COALESCE(sm.phone, sc_p.phone) AS phone,
  COALESCE(i.payment_status, i.status, 'unpaid') AS status,
  COALESCE(i.total, i.total_amount, 0) AS total_amount, i.created_at, i.paid_at,
  i.due_date::timestamptz AS due_date, to_jsonb(i) AS raw
FROM public.invoices i
LEFT JOIN public.store_master sm ON sm.id = i.store_id
LEFT JOIN LATERAL (SELECT sc.phone FROM public.store_contacts sc WHERE sc.store_id = i.store_id AND length(regexp_replace(sc.phone, '[^0-9]', '', 'g')) >= 10 ORDER BY sc.is_primary DESC NULLS LAST, sc.created_at DESC LIMIT 1) sc_p ON true
WHERE i.is_historical IS NOT TRUE AND i.deleted_at IS NULL AND i.entity_type IS DISTINCT FROM 'wholesaler'
UNION ALL
SELECT 'legacy:' || i.id::text, i.id::text, 'legacy', i.store_id, sm.store_name, COALESCE(sm.phone, sc_p.phone),
  COALESCE(i.payment_status, i.status, 'unpaid'), COALESCE(i.total, i.total_amount, 0), i.created_at, i.paid_at, i.due_date::timestamptz, to_jsonb(i)
FROM public.invoices i LEFT JOIN public.store_master sm ON sm.id = i.store_id
LEFT JOIN LATERAL (SELECT sc.phone FROM public.store_contacts sc WHERE sc.store_id = i.store_id AND length(regexp_replace(sc.phone, '[^0-9]', '', 'g')) >= 10 ORDER BY sc.is_primary DESC NULLS LAST, sc.created_at DESC LIMIT 1) sc_p ON true
WHERE i.is_historical = true AND i.deleted_at IS NULL
UNION ALL
SELECT 'crm:' || ci.id::text, ci.id::text, 'crm', NULL::uuid, c.name, c.phone, COALESCE(ci.status, 'unpaid'), COALESCE(ci.total_amount, 0), ci.created_at, NULL::timestamptz, ci.due_date::timestamptz, to_jsonb(ci)
FROM public.customer_invoices ci LEFT JOIN public.crm_customers c ON c.id = ci.customer_id
UNION ALL
SELECT 'wholesale:' || i.id::text, i.id::text, 'wholesale', NULL::uuid, COALESCE(wp.company_name, 'Wholesaler'), NULL::text,
  COALESCE(i.payment_status, i.status, 'unpaid'), COALESCE(i.total, i.total_amount, 0), i.created_at, i.paid_at, i.due_date::timestamptz, to_jsonb(i)
FROM public.invoices i LEFT JOIN public.wholesaler_profiles wp ON wp.id = i.entity_id
WHERE i.entity_type = 'wholesaler' AND i.deleted_at IS NULL;

CREATE OR REPLACE VIEW public.invoice_source_summary AS
SELECT invoice_source, COUNT(*) AS invoice_count, COALESCE(SUM(total_amount), 0) AS total_revenue
FROM public.invoices_unified GROUP BY invoice_source ORDER BY invoice_count DESC;

CREATE OR REPLACE FUNCTION public.resolve_previous_customers(p_days integer DEFAULT 3650)
RETURNS TABLE(store_id uuid, store_name text, phone text, total_orders bigint, lifetime_spend numeric, last_order_date timestamptz, sources_used text[], match_method text)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT sm.id, sm.store_name,
    COALESCE(CASE WHEN public.normalize_phone(sm.phone) IS NOT NULL THEN sm.phone END, bc.phone) AS phone,
    COUNT(*)::bigint, COALESCE(SUM(iu.total_amount),0)::numeric, MAX(iu.created_at),
    ARRAY_AGG(DISTINCT iu.invoice_source), 'store_id'::text
  FROM public.invoices_unified iu
  JOIN public.store_master sm ON sm.id = iu.store_id
  LEFT JOIN LATERAL (SELECT sc.phone FROM public.store_contacts sc WHERE sc.store_id = sm.id AND public.normalize_phone(sc.phone) IS NOT NULL ORDER BY sc.is_primary DESC NULLS LAST, sc.created_at DESC LIMIT 1) bc ON true
  WHERE iu.store_id IS NOT NULL AND iu.created_at >= (now() - (p_days || ' days')::interval)
  GROUP BY sm.id, sm.store_name, sm.phone, bc.phone
  HAVING COALESCE(CASE WHEN public.normalize_phone(sm.phone) IS NOT NULL THEN sm.phone END, bc.phone) IS NOT NULL

  UNION ALL

  SELECT sm.id, sm.store_name, COALESCE(sm.phone, bc.phone),
    COUNT(*)::bigint, COALESCE(SUM(iu.total_amount),0)::numeric, MAX(iu.created_at),
    ARRAY_AGG(DISTINCT iu.invoice_source), 'phone'::text
  FROM public.invoices_unified iu
  JOIN public.store_master sm ON public.normalize_phone(iu.phone) = public.normalize_phone(sm.phone)
  LEFT JOIN LATERAL (SELECT sc.phone FROM public.store_contacts sc WHERE sc.store_id = sm.id AND public.normalize_phone(sc.phone) IS NOT NULL ORDER BY sc.is_primary DESC NULLS LAST, sc.created_at DESC LIMIT 1) bc ON true
  WHERE iu.store_id IS NULL AND public.normalize_phone(iu.phone) IS NOT NULL
    AND iu.created_at >= (now() - (p_days || ' days')::interval)
    AND sm.id NOT IN (SELECT iu2.store_id FROM public.invoices_unified iu2 WHERE iu2.store_id IS NOT NULL)
  GROUP BY sm.id, sm.store_name, sm.phone, bc.phone

  UNION ALL

  SELECT sm.id, sm.store_name,
    COALESCE(CASE WHEN public.normalize_phone(sm.phone) IS NOT NULL THEN sm.phone END, bc.phone),
    COUNT(*)::bigint, COALESCE(SUM(iu.total_amount),0)::numeric, MAX(iu.created_at),
    ARRAY_AGG(DISTINCT iu.invoice_source), 'name'::text
  FROM public.invoices_unified iu
  JOIN public.store_master sm ON lower(trim(iu.store_name)) = lower(trim(sm.store_name))
  LEFT JOIN LATERAL (SELECT sc.phone FROM public.store_contacts sc WHERE sc.store_id = sm.id AND public.normalize_phone(sc.phone) IS NOT NULL ORDER BY sc.is_primary DESC NULLS LAST, sc.created_at DESC LIMIT 1) bc ON true
  WHERE iu.store_id IS NULL AND public.normalize_phone(iu.phone) IS NULL AND iu.store_name IS NOT NULL
    AND iu.created_at >= (now() - (p_days || ' days')::interval)
    AND sm.id NOT IN (SELECT iu2.store_id FROM public.invoices_unified iu2 WHERE iu2.store_id IS NOT NULL)
  GROUP BY sm.id, sm.store_name, sm.phone, bc.phone
  HAVING COALESCE(CASE WHEN public.normalize_phone(sm.phone) IS NOT NULL THEN sm.phone END, bc.phone) IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_previous_customers_count()
RETURNS bigint LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COUNT(DISTINCT store_id) FROM public.resolve_previous_customers(3650);
$$;

CREATE OR REPLACE FUNCTION public.resolve_audience_segment(p_segment_id uuid)
RETURNS TABLE(store_id uuid, store_name text, phone text)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_type text;
BEGIN
  SELECT segment_type INTO v_type FROM public.audience_segments WHERE id = p_segment_id;
  IF v_type = 'previous_customers' THEN
    RETURN QUERY SELECT r.store_id, r.store_name, r.phone FROM public.resolve_previous_customers(3650) r;
  ELSE
    RETURN QUERY
    SELECT asm.store_id, sm.store_name, COALESCE(sm.phone, sc.phone) AS phone
    FROM public.audience_segment_members asm
    JOIN public.store_master sm ON sm.id = asm.store_id
    LEFT JOIN LATERAL (SELECT scc.phone FROM public.store_contacts scc WHERE scc.store_id = sm.id AND public.normalize_phone(scc.phone) IS NOT NULL ORDER BY scc.is_primary DESC NULLS LAST, scc.created_at DESC LIMIT 1) sc ON true
    WHERE asm.segment_id = p_segment_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_audience_count(p_segment_id uuid)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_type text; v_count bigint;
BEGIN
  SELECT segment_type INTO v_type FROM public.audience_segments WHERE id = p_segment_id;
  IF v_type = 'previous_customers' THEN
    SELECT public.resolve_previous_customers_count() INTO v_count;
  ELSE
    SELECT COUNT(*) INTO v_count FROM public.audience_segment_members WHERE segment_id = p_segment_id;
  END IF;
  RETURN COALESCE(v_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.audience_diagnostics()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'source_summary', (SELECT jsonb_agg(jsonb_build_object('source', s.invoice_source, 'count', s.invoice_count, 'revenue', s.total_revenue)) FROM public.invoice_source_summary s),
    'total_invoices', (SELECT COUNT(*) FROM public.invoices_unified),
    'total_revenue', (SELECT COALESCE(SUM(total_amount), 0) FROM public.invoices_unified),
    'distinct_phones', (SELECT COUNT(DISTINCT public.normalize_phone(phone)) FROM public.invoices_unified WHERE public.normalize_phone(phone) IS NOT NULL),
    'distinct_store_ids', (SELECT COUNT(DISTINCT store_id) FROM public.invoices_unified WHERE store_id IS NOT NULL),
    'invoices_no_identity', (SELECT COUNT(*) FROM public.invoices_unified WHERE store_id IS NULL AND public.normalize_phone(phone) IS NULL AND store_name IS NULL),
    'resolved_customers', (SELECT public.resolve_previous_customers_count()),
    'match_breakdown', (SELECT jsonb_agg(jsonb_build_object('method', r.match_method, 'count', r.cnt)) FROM (SELECT match_method, COUNT(*) as cnt FROM public.resolve_previous_customers(3650) GROUP BY match_method) r)
  ) INTO result;
  RETURN result;
END;
$$;
