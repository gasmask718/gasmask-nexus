
DROP MATERIALIZED VIEW IF EXISTS public.store_intelligence_v CASCADE;

CREATE MATERIALIZED VIEW public.store_intelligence_v AS
SELECT 
  s.id AS store_id,
  s.name AS store_name,
  sm.store_name AS master_name,
  s.address_street, s.address_city, s.address_state, s.address_zip,
  CONCAT_WS(', ',
    NULLIF(s.address_street,''),
    NULLIF(s.address_city,''),
    NULLIF(TRIM(COALESCE(s.address_state,'') || ' ' || COALESCE(s.address_zip,'')), '')
  ) AS full_address,
  s.phone, s.email,
  s.created_at AS store_created_at,
  s.deleted_at AS store_deleted_at,

  (SELECT COUNT(*) FROM public.invoices WHERE store_id = s.id) AS invoice_count,
  (SELECT COUNT(*) FROM public.orders WHERE store_id = s.id) AS order_count,
  (SELECT COUNT(*) FROM public.store_notes WHERE store_id = s.id) AS note_count,
  (SELECT COUNT(*) FROM public.store_contacts WHERE store_id = s.id) AS contact_count,
  (SELECT COUNT(*) FROM public.communication_events WHERE store_id = s.id) AS comm_event_count,
  (SELECT COUNT(*) FROM public.manual_call_logs WHERE store_id = s.id) AS call_count,

  (SELECT MAX(created_at) FROM public.invoices WHERE store_id = s.id) AS last_invoice_date,
  (SELECT MAX(created_at) FROM public.orders WHERE store_id = s.id) AS last_order_date,
  (SELECT MAX(created_at) FROM public.store_notes WHERE store_id = s.id) AS last_note_date,
  (SELECT MAX(created_at) FROM public.communication_events WHERE store_id = s.id) AS last_comm_date,
  (SELECT MAX(created_at) FROM public.manual_call_logs WHERE store_id = s.id) AS last_call_date,

  (SELECT COALESCE(SUM(total_amount),0) FROM public.invoices WHERE store_id = s.id) AS total_revenue,
  (SELECT COALESCE(AVG(total_amount),0) FROM public.invoices WHERE store_id = s.id) AS avg_invoice_amount,

  CASE 
    WHEN (SELECT COUNT(*) FROM public.invoices WHERE store_id = s.id) > 0 THEN 'TIER_1_REVENUE_ACTIVE'
    WHEN (SELECT COUNT(*) FROM public.store_notes WHERE store_id = s.id) > 0 
      OR (SELECT COUNT(*) FROM public.manual_call_logs WHERE store_id = s.id) > 0
      OR (SELECT COUNT(*) FROM public.communication_events WHERE store_id = s.id) > 0 
      THEN 'TIER_2_ENGAGEMENT_ACTIVE'
    WHEN (SELECT COUNT(*) FROM public.store_contacts WHERE store_id = s.id) > 0 
      THEN 'TIER_3_CONTACTS_ONLY'
    ELSE 'TIER_4_DEAD'
  END AS activity_tier,

  EXTRACT(DAY FROM (now() - GREATEST(
    COALESCE((SELECT MAX(created_at) FROM public.invoices WHERE store_id = s.id), '1970-01-01'::timestamptz),
    COALESCE((SELECT MAX(created_at) FROM public.orders WHERE store_id = s.id), '1970-01-01'::timestamptz),
    COALESCE((SELECT MAX(created_at) FROM public.store_notes WHERE store_id = s.id), '1970-01-01'::timestamptz),
    COALESCE((SELECT MAX(created_at) FROM public.manual_call_logs WHERE store_id = s.id), '1970-01-01'::timestamptz)
  )))::int AS days_since_last_activity,

  CASE WHEN sm.id IS NOT NULL AND ((s.deleted_at IS NULL) <> (sm.deleted_at IS NULL))
       THEN true ELSE false END AS has_drift,

  now() AS computed_at
FROM public.stores s
LEFT JOIN public.store_master sm ON sm.id = s.id
WHERE s.deleted_at IS NULL;

-- Required for REFRESH CONCURRENTLY
CREATE UNIQUE INDEX idx_store_intel_pk ON public.store_intelligence_v(store_id);
CREATE INDEX idx_store_intel_tier ON public.store_intelligence_v(activity_tier);
CREATE INDEX idx_store_intel_last_invoice ON public.store_intelligence_v(last_invoice_date DESC NULLS LAST);
CREATE INDEX idx_store_intel_revenue ON public.store_intelligence_v(total_revenue DESC NULLS LAST);
CREATE INDEX idx_store_intel_name ON public.store_intelligence_v USING gin (to_tsvector('english'::regconfig, store_name));
CREATE INDEX idx_store_intel_address ON public.store_intelligence_v USING gin (to_tsvector('english'::regconfig, COALESCE(full_address,'')));

-- Read access
GRANT SELECT ON public.store_intelligence_v TO authenticated;

CREATE OR REPLACE FUNCTION public.refresh_store_intelligence()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.store_intelligence_v;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_store_intelligence() TO authenticated;
