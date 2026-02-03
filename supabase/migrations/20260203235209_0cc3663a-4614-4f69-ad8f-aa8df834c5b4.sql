
-- =====================================================
-- CONTACT RESPONSIVENESS INTELLIGENCE SYSTEM
-- =====================================================

-- 1. Extend store_contacts with detailed tracking fields
ALTER TABLE public.store_contacts
ADD COLUMN IF NOT EXISTS total_calls_attempted integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_calls_answered integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_call_attempt_at timestamptz,
ADD COLUMN IF NOT EXISTS last_call_answered_at timestamptz,
ADD COLUMN IF NOT EXISTS total_texts_sent integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_texts_received integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_text_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS last_text_received_at timestamptz,
ADD COLUMN IF NOT EXISTS responsiveness_status text DEFAULT 'unknown' CHECK (responsiveness_status IN ('responsive', 'unresponsive', 'unknown')),
ADD COLUMN IF NOT EXISTS responsiveness_updated_at timestamptz DEFAULT now();

-- 2. Create a function to update contact responsiveness stats from communication_logs
CREATE OR REPLACE FUNCTION public.update_contact_responsiveness(p_contact_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_calls_attempted integer;
  v_calls_answered integer;
  v_texts_sent integer;
  v_texts_received integer;
  v_last_call_attempt timestamptz;
  v_last_call_answered timestamptz;
  v_last_text_sent timestamptz;
  v_last_text_received timestamptz;
  v_call_responsive boolean;
  v_text_responsive boolean;
  v_overall_status text;
  v_30_days_ago timestamptz := now() - interval '30 days';
BEGIN
  -- Calculate call metrics
  SELECT 
    COUNT(*) FILTER (WHERE channel = 'call' AND direction = 'outbound'),
    COUNT(*) FILTER (WHERE channel = 'call' AND (direction = 'inbound' OR outcome = 'answered')),
    MAX(created_at) FILTER (WHERE channel = 'call' AND direction = 'outbound'),
    MAX(created_at) FILTER (WHERE channel = 'call' AND (direction = 'inbound' OR outcome = 'answered'))
  INTO v_calls_attempted, v_calls_answered, v_last_call_attempt, v_last_call_answered
  FROM communication_logs
  WHERE contact_id = p_contact_id;

  -- Calculate text metrics
  SELECT 
    COUNT(*) FILTER (WHERE channel = 'sms' AND direction = 'outbound'),
    COUNT(*) FILTER (WHERE channel = 'sms' AND direction = 'inbound'),
    MAX(created_at) FILTER (WHERE channel = 'sms' AND direction = 'outbound'),
    MAX(created_at) FILTER (WHERE channel = 'sms' AND direction = 'inbound')
  INTO v_texts_sent, v_texts_received, v_last_text_sent, v_last_text_received
  FROM communication_logs
  WHERE contact_id = p_contact_id;

  -- Determine responsiveness (within last 30 days)
  v_call_responsive := (v_last_call_answered IS NOT NULL AND v_last_call_answered >= v_30_days_ago);
  v_text_responsive := (v_last_text_received IS NOT NULL AND v_last_text_received >= v_30_days_ago);

  -- Determine overall status
  IF v_call_responsive OR v_text_responsive THEN
    v_overall_status := 'responsive';
  ELSIF (v_calls_attempted > 0 OR v_texts_sent > 0) AND NOT v_call_responsive AND NOT v_text_responsive THEN
    v_overall_status := 'unresponsive';
  ELSE
    v_overall_status := 'unknown';
  END IF;

  -- Update the contact record
  UPDATE store_contacts
  SET
    total_calls_attempted = COALESCE(v_calls_attempted, 0),
    total_calls_answered = COALESCE(v_calls_answered, 0),
    last_call_attempt_at = v_last_call_attempt,
    last_call_answered_at = v_last_call_answered,
    total_texts_sent = COALESCE(v_texts_sent, 0),
    total_texts_received = COALESCE(v_texts_received, 0),
    last_text_sent_at = v_last_text_sent,
    last_text_received_at = v_last_text_received,
    responsive_by_call = v_call_responsive,
    responsive_by_text = v_text_responsive,
    last_responded_at = GREATEST(v_last_call_answered, v_last_text_received),
    responsiveness_status = v_overall_status,
    responsiveness_updated_at = now()
  WHERE id = p_contact_id;
END;
$$;

-- 3. Create trigger to auto-update responsiveness when communication_logs changes
CREATE OR REPLACE FUNCTION public.trigger_update_contact_responsiveness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.contact_id IS NOT NULL THEN
    PERFORM public.update_contact_responsiveness(NEW.contact_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS communication_logs_responsiveness_trigger ON public.communication_logs;
CREATE TRIGGER communication_logs_responsiveness_trigger
AFTER INSERT OR UPDATE ON public.communication_logs
FOR EACH ROW
EXECUTE FUNCTION public.trigger_update_contact_responsiveness();

-- 4. Create a view for contact communication stats (used for Quick Stats)
CREATE OR REPLACE VIEW public.v_contact_responsiveness_summary AS
SELECT 
  sc.id as contact_id,
  sc.name as contact_name,
  sc.phone,
  sc.email,
  sc.store_id,
  s.name as store_name,
  sc.role,
  sc.is_primary,
  sc.total_calls_attempted,
  sc.total_calls_answered,
  sc.last_call_attempt_at,
  sc.last_call_answered_at,
  sc.total_texts_sent,
  sc.total_texts_received,
  sc.last_text_sent_at,
  sc.last_text_received_at,
  sc.responsive_by_call,
  sc.responsive_by_text,
  sc.responsiveness_status,
  sc.last_responded_at,
  CASE 
    WHEN sc.total_calls_attempted > 0 THEN 
      ROUND((sc.total_calls_answered::numeric / sc.total_calls_attempted::numeric) * 100)
    ELSE 0 
  END as call_answer_rate,
  CASE 
    WHEN sc.total_texts_sent > 0 THEN 
      ROUND((sc.total_texts_received::numeric / sc.total_texts_sent::numeric) * 100)
    ELSE 0 
  END as text_reply_rate
FROM store_contacts sc
JOIN stores s ON s.id = sc.store_id
WHERE sc.is_simulation = false;

-- 5. Grant access
GRANT EXECUTE ON FUNCTION public.update_contact_responsiveness(uuid) TO authenticated;
GRANT SELECT ON public.v_contact_responsiveness_summary TO authenticated;
