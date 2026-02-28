
-- ═══════════════════════════════════════════════════════════════
-- STORE CONTACT INTELLIGENCE — Extend store_answer_profile
-- ═══════════════════════════════════════════════════════════════

-- Add missing intelligence columns
ALTER TABLE public.store_answer_profile
ADD COLUMN IF NOT EXISTS voicemail_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS busy_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS no_answer_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_call_duration NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS pickup_probability NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_voicemails INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_busy INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_no_answer INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS intelligence_calculated_at TIMESTAMPTZ;

-- ═══════════════════════════════════════════════════════════════
-- RECALCULATE FUNCTION — Uses follow_up_events (last 30 days)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.recalculate_store_contact_intelligence(p_store_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total INT;
  v_answered INT;
  v_voicemail INT;
  v_busy INT;
  v_no_answer INT;
  v_failed INT;
  v_avg_dur NUMERIC;
  v_pickup NUMERIC;
  v_biz_id UUID;
BEGIN
  -- Aggregate last 30 days of events
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE outcome IN ('answered', 'completed')),
    COUNT(*) FILTER (WHERE outcome = 'voicemail'),
    COUNT(*) FILTER (WHERE outcome = 'busy'),
    COUNT(*) FILTER (WHERE outcome = 'no_answer'),
    COUNT(*) FILTER (WHERE outcome = 'failed'),
    COALESCE(AVG(call_duration) FILTER (WHERE outcome IN ('answered', 'completed') AND call_duration > 0), 0)
  INTO v_total, v_answered, v_voicemail, v_busy, v_no_answer, v_failed, v_avg_dur
  FROM public.follow_up_events
  WHERE store_id = p_store_id
    AND created_at >= now() - interval '30 days';

  IF v_total = 0 THEN
    RETURN;
  END IF;

  -- Pickup probability with recency decay:
  -- Recent events weighted more heavily
  SELECT COALESCE(
    SUM(CASE WHEN outcome IN ('answered', 'completed') THEN weight ELSE 0 END) /
    NULLIF(SUM(weight), 0),
    0
  )
  INTO v_pickup
  FROM (
    SELECT outcome,
      -- Exponential decay: recent = more weight
      EXP(-0.05 * EXTRACT(EPOCH FROM (now() - created_at)) / 86400.0) AS weight
    FROM public.follow_up_events
    WHERE store_id = p_store_id
      AND created_at >= now() - interval '30 days'
  ) weighted;

  -- Get business_id
  SELECT business_id INTO v_biz_id
  FROM public.follow_up_events
  WHERE store_id = p_store_id
  ORDER BY created_at DESC LIMIT 1;

  -- Upsert into store_answer_profile
  INSERT INTO public.store_answer_profile (
    store_id, business_id,
    total_attempts, total_answers, total_voicemails, total_busy, total_no_answer,
    answer_rate, voicemail_rate, busy_rate, no_answer_rate,
    avg_call_duration, pickup_probability,
    intelligence_calculated_at, updated_at
  ) VALUES (
    p_store_id, v_biz_id,
    v_total, v_answered, v_voicemail, v_busy, v_no_answer,
    CASE WHEN v_total > 0 THEN v_answered::NUMERIC / v_total ELSE 0 END,
    CASE WHEN v_total > 0 THEN v_voicemail::NUMERIC / v_total ELSE 0 END,
    CASE WHEN v_total > 0 THEN v_busy::NUMERIC / v_total ELSE 0 END,
    CASE WHEN v_total > 0 THEN v_no_answer::NUMERIC / v_total ELSE 0 END,
    v_avg_dur, v_pickup,
    now(), now()
  )
  ON CONFLICT (store_id) DO UPDATE SET
    total_attempts = EXCLUDED.total_attempts,
    total_answers = EXCLUDED.total_answers,
    total_voicemails = EXCLUDED.total_voicemails,
    total_busy = EXCLUDED.total_busy,
    total_no_answer = EXCLUDED.total_no_answer,
    answer_rate = EXCLUDED.answer_rate,
    voicemail_rate = EXCLUDED.voicemail_rate,
    busy_rate = EXCLUDED.busy_rate,
    no_answer_rate = EXCLUDED.no_answer_rate,
    avg_call_duration = EXCLUDED.avg_call_duration,
    pickup_probability = EXCLUDED.pickup_probability,
    intelligence_calculated_at = now(),
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════
-- AUTO-TRIGGER: Recalculate after each processed event
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.trg_recalculate_intelligence()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.store_id IS NOT NULL THEN
    PERFORM public.recalculate_store_contact_intelligence(NEW.store_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_intelligence_after_event
  AFTER INSERT ON public.follow_up_events
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_recalculate_intelligence();
