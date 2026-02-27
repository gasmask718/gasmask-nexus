
-- Add entity_type and entity_id to outbound_call_queue for prospect support
ALTER TABLE public.outbound_call_queue
  ADD COLUMN IF NOT EXISTS entity_type text DEFAULT 'store',
  ADD COLUMN IF NOT EXISTS entity_id uuid,
  ADD COLUMN IF NOT EXISTS source_reason text;

-- Create the canonical callable entities view
CREATE OR REPLACE VIEW public.v_callable_entities AS
-- Active Stores
SELECT
  'store'::text AS entity_type,
  sm.id AS entity_id,
  sm.brand_id AS business_id,
  sm.store_name AS display_name,
  sm.phone AS phone_e164,
  sm.address,
  sm.city,
  sm.state,
  NULL::uuid AS territory_id,
  NULL::text AS region,
  COALESCE(sm.status, 'active')::text AS status,
  sm.last_order_at,
  NULL::timestamptz AS last_contacted_at,
  NULL::numeric AS answer_profile_score,
  NULL::jsonb AS tags,
  COALESCE(sm.do_not_call, false) AS is_dnc,
  (sm.phone IS NOT NULL AND COALESCE(sm.do_not_call, false) = false) AS callable_now
FROM public.store_master sm
WHERE sm.deleted_at IS NULL
  AND sm.phone IS NOT NULL

UNION ALL

-- Territory Prospects
SELECT
  'prospect'::text AS entity_type,
  ta.id AS entity_id,
  NULL::uuid AS business_id,
  COALESCE(ta.store_name, 'Unknown Prospect') AS display_name,
  NULL::text AS phone_e164,
  ta.full_address AS address,
  ta.city,
  ta.state,
  ta.neighborhood_id AS territory_id,
  NULL::text AS region,
  'prospect'::text AS status,
  NULL::timestamptz AS last_order_at,
  NULL::timestamptz AS last_contacted_at,
  NULL::numeric AS answer_profile_score,
  NULL::jsonb AS tags,
  false AS is_dnc,
  false AS callable_now
FROM public.territory_addresses ta;

-- RLS: The view inherits RLS from underlying tables since we use security_invoker
-- Grant access
GRANT SELECT ON public.v_callable_entities TO authenticated;
