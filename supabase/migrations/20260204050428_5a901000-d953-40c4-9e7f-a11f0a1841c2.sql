-- PHASE 1: Fix v_contact_cadence_intelligence to include ALL contacts (even never-contacted)
-- Change filter from WHERE phone IS NOT NULL to always include contacts
-- Use LEFT JOIN and safe defaults for never-contacted

DROP VIEW IF EXISTS public.v_contact_cadence_intelligence;

CREATE OR REPLACE VIEW public.v_contact_cadence_intelligence AS
SELECT 
  sc.id as contact_id,
  sc.store_id,
  sc.name as contact_name,
  sc.phone,
  sc.role as contact_role,
  sc.is_primary,
  sm.store_name,
  sm.address as store_address,
  sm.city as store_city,
  sm.state as store_state,
  
  -- Call metrics (default to 0 if null)
  COALESCE(sc.total_calls_attempted, 0) as total_calls_attempted,
  COALESCE(sc.total_calls_answered, 0) as total_calls_answered,
  sc.last_call_attempt_at,
  sc.last_call_answered_at,
  
  -- Text metrics (default to 0 if null)
  COALESCE(sc.total_texts_sent, 0) as total_texts_sent,
  COALESCE(sc.total_texts_received, 0) as total_texts_received,
  sc.last_text_sent_at,
  sc.last_text_received_at,
  
  -- Responsiveness
  COALESCE(sc.responsiveness_status, 'unknown') as responsiveness_status,
  COALESCE(sc.responsive_by_call, false) as responsive_by_call,
  COALESCE(sc.responsive_by_text, false) as responsive_by_text,
  sc.last_responded_at,
  
  -- Cadence status
  COALESCE(sc.cadence_status, 'never_contacted') as cadence_status,
  COALESCE(sc.escalation_flag, false) as escalation_flag,
  sc.cadence_updated_at,
  
  -- Computed: Days since last touch (999 for never-contacted)
  LEAST(
    COALESCE(EXTRACT(EPOCH FROM (now() - sc.last_call_attempt_at)) / 86400, 999),
    COALESCE(EXTRACT(EPOCH FROM (now() - sc.last_text_sent_at)) / 86400, 999)
  )::integer as days_since_last_touch,
  
  -- Computed: Last touch date (epoch 0 for never-contacted)
  GREATEST(
    COALESCE(sc.last_call_attempt_at, '1970-01-01'::timestamptz),
    COALESCE(sc.last_text_sent_at, '1970-01-01'::timestamptz)
  ) as last_touch_at,
  
  -- Computed: Suggested action
  CASE 
    WHEN COALESCE(sc.responsiveness_status, 'unknown') = 'unresponsive' AND COALESCE(sc.escalation_flag, false) THEN 'physical_visit'
    WHEN COALESCE(sc.responsive_by_call, false) = true THEN 'call'
    WHEN COALESCE(sc.responsive_by_text, false) = true THEN 'text'
    ELSE 'call'
  END as suggested_action,
  
  sc.created_at
FROM public.store_contacts sc
LEFT JOIN public.store_master sm ON sm.id = sc.store_id;
-- REMOVED: WHERE sc.phone IS NOT NULL filter to include ALL contacts

COMMENT ON VIEW public.v_contact_cadence_intelligence IS 'Read-only cadence intelligence for ALL contacts. Includes never-contacted. NO AUTOMATION.';

-- Grant access
GRANT SELECT ON public.v_contact_cadence_intelligence TO authenticated;