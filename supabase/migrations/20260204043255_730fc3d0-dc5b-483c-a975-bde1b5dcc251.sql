
-- PHASE 2: Extend store_contacts with cadence tracking
-- Add cadence_status and escalation_flag columns

ALTER TABLE public.store_contacts
ADD COLUMN IF NOT EXISTS cadence_status text DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS escalation_flag boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS cadence_updated_at timestamptz DEFAULT now();

COMMENT ON COLUMN public.store_contacts.cadence_status IS 'Cadence status: within_window, due_soon, overdue_7_days, overdue_14_days, unknown';
COMMENT ON COLUMN public.store_contacts.escalation_flag IS 'True if contact requires escalation (physical visit)';
COMMENT ON COLUMN public.store_contacts.cadence_updated_at IS 'When cadence status was last computed';

-- Create a view for contact cadence intelligence (read-only, no automation)
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
  
  -- Call metrics
  sc.total_calls_attempted,
  sc.total_calls_answered,
  sc.last_call_attempt_at,
  sc.last_call_answered_at,
  
  -- Text metrics
  sc.total_texts_sent,
  sc.total_texts_received,
  sc.last_text_sent_at,
  sc.last_text_received_at,
  
  -- Responsiveness
  sc.responsiveness_status,
  sc.responsive_by_call,
  sc.responsive_by_text,
  sc.last_responded_at,
  
  -- Cadence status
  sc.cadence_status,
  sc.escalation_flag,
  sc.cadence_updated_at,
  
  -- Computed: Days since last touch
  GREATEST(
    COALESCE(EXTRACT(EPOCH FROM (now() - sc.last_call_attempt_at)) / 86400, 999),
    COALESCE(EXTRACT(EPOCH FROM (now() - sc.last_text_sent_at)) / 86400, 999)
  )::integer as days_since_last_touch,
  
  -- Computed: Last touch date (whichever is more recent)
  GREATEST(
    COALESCE(sc.last_call_attempt_at, '1970-01-01'::timestamptz),
    COALESCE(sc.last_text_sent_at, '1970-01-01'::timestamptz)
  ) as last_touch_at,
  
  -- Computed: Suggested action
  CASE 
    WHEN sc.responsiveness_status = 'unresponsive' AND sc.escalation_flag THEN 'physical_visit'
    WHEN sc.responsive_by_call = true THEN 'call'
    WHEN sc.responsive_by_text = true THEN 'text'
    ELSE 'call'
  END as suggested_action,
  
  sc.created_at
FROM public.store_contacts sc
LEFT JOIN public.store_master sm ON sm.id = sc.store_id
WHERE sc.phone IS NOT NULL AND sc.phone != '';

COMMENT ON VIEW public.v_contact_cadence_intelligence IS 'Read-only view for contact cadence tracking. NO AUTOMATION - visibility only.';

-- Create a function to compute cadence status (callable manually or via cron)
CREATE OR REPLACE FUNCTION public.compute_contact_cadence_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact RECORD;
  v_days_since_touch integer;
  v_new_status text;
  v_should_escalate boolean;
BEGIN
  FOR v_contact IN 
    SELECT 
      id,
      last_call_attempt_at,
      last_text_sent_at,
      last_responded_at,
      responsiveness_status,
      total_calls_attempted,
      total_texts_sent
    FROM store_contacts
    WHERE phone IS NOT NULL AND phone != ''
  LOOP
    -- Calculate days since last touch
    v_days_since_touch := LEAST(
      COALESCE(EXTRACT(EPOCH FROM (now() - v_contact.last_call_attempt_at)) / 86400, 999)::integer,
      COALESCE(EXTRACT(EPOCH FROM (now() - v_contact.last_text_sent_at)) / 86400, 999)::integer
    );
    
    -- Determine cadence status
    IF v_days_since_touch >= 999 THEN
      v_new_status := 'never_contacted';
    ELSIF v_days_since_touch <= 7 THEN
      v_new_status := 'within_window';
    ELSIF v_days_since_touch <= 10 THEN
      v_new_status := 'due_soon';
    ELSIF v_days_since_touch <= 14 THEN
      v_new_status := 'overdue_7_days';
    ELSE
      v_new_status := 'overdue_14_days';
    END IF;
    
    -- Determine escalation (14+ days overdue AND unresponsive after multiple attempts)
    v_should_escalate := (
      v_days_since_touch > 14 
      AND v_contact.responsiveness_status = 'unresponsive'
      AND (v_contact.total_calls_attempted >= 3 OR v_contact.total_texts_sent >= 3)
    );
    
    -- Update the contact
    UPDATE store_contacts
    SET 
      cadence_status = v_new_status,
      escalation_flag = v_should_escalate,
      cadence_updated_at = now()
    WHERE id = v_contact.id;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.compute_contact_cadence_status IS 'Computes cadence status for all contacts. Run manually or via scheduled job. NO AUTO-SEND.';

-- Grant access
GRANT SELECT ON public.v_contact_cadence_intelligence TO authenticated;
