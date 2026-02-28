
-- ═══════════════════════════════════════════════════════════════
-- FOLLOW-UP ENGINE HARDENING — Idempotency + Audit
-- ═══════════════════════════════════════════════════════════════

-- PART 1: Unique constraint prevents duplicate event inserts
ALTER TABLE public.follow_up_events
ADD CONSTRAINT uniq_follow_up_event_call_outcome
UNIQUE (call_sid, outcome);

-- PART 5: Audit log table
CREATE TABLE public.follow_up_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES public.store_master(id),
  event_id UUID REFERENCES public.follow_up_events(id),
  action_taken TEXT NOT NULL,
  previous_state TEXT,
  new_state TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_follow_up_audit_store ON public.follow_up_audit_log (store_id, processed_at DESC);

ALTER TABLE public.follow_up_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read follow_up_audit_log"
  ON public.follow_up_audit_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service can insert follow_up_audit_log"
  ON public.follow_up_audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- PART 2+3: Drop old trigger and replace with idempotent AFTER INSERT version
DROP TRIGGER IF EXISTS trg_process_follow_up_event ON public.follow_up_events;
DROP FUNCTION IF EXISTS public.process_follow_up_event();

CREATE OR REPLACE FUNCTION public.process_follow_up_event()
RETURNS TRIGGER AS $$
DECLARE
  v_rows_locked INT;
  v_prev_status TEXT;
  v_action TEXT;
BEGIN
  -- PART 3: Idempotency guard — skip if already processed
  IF NEW.processed = true THEN
    RETURN NULL;
  END IF;

  -- Atomically mark as processed (prevents concurrent re-processing)
  UPDATE public.follow_up_events
  SET processed = true, processed_at = now()
  WHERE id = NEW.id AND processed = false;

  GET DIAGNOSTICS v_rows_locked = ROW_COUNT;
  IF v_rows_locked = 0 THEN
    -- Already processed by another invocation
    RETURN NULL;
  END IF;

  -- ── ANSWERED: Cancel pending auto-follow-ups ──
  IF NEW.outcome IN ('answered', 'completed') THEN
    v_action := 'cancel_pending_followups';

    UPDATE public.follow_up_queue
    SET status = 'completed',
        completed_at = now(),
        context = jsonb_set(
          COALESCE(context, '{}'::jsonb),
          '{auto_completed_reason}',
          '"store_engaged_after_call"'::jsonb
        )
    WHERE store_id = NEW.store_id
      AND status = 'pending'
      AND COALESCE(context->>'source', '') = 'call_outcome_engine'
      AND updated_at < NEW.created_at;  -- PART 4: Temporal guard

  -- ── VOICEMAIL ──
  ELSIF NEW.outcome = 'voicemail' THEN
    v_action := 'tag_voicemail';

    UPDATE public.follow_up_queue
    SET context = jsonb_set(
          COALESCE(context, '{}'::jsonb),
          '{last_outcome}',
          '"voicemail"'::jsonb
        ),
        updated_at = now()
    WHERE store_id = NEW.store_id
      AND status = 'pending'
      AND COALESCE(context->>'source', '') = 'call_outcome_engine'
      AND updated_at < NEW.created_at;

  -- ── BUSY ──
  ELSIF NEW.outcome = 'busy' THEN
    v_action := 'tag_busy';

    UPDATE public.follow_up_queue
    SET context = jsonb_set(
          COALESCE(context, '{}'::jsonb),
          '{last_outcome}',
          '"busy"'::jsonb
        ),
        updated_at = now()
    WHERE store_id = NEW.store_id
      AND status = 'pending'
      AND COALESCE(context->>'source', '') = 'call_outcome_engine'
      AND updated_at < NEW.created_at;

  -- ── NO ANSWER ──
  ELSIF NEW.outcome = 'no_answer' THEN
    v_action := 'tag_no_answer';

    UPDATE public.follow_up_queue
    SET context = jsonb_set(
          COALESCE(context, '{}'::jsonb),
          '{last_outcome}',
          '"no_answer"'::jsonb
        ),
        updated_at = now()
    WHERE store_id = NEW.store_id
      AND status = 'pending'
      AND COALESCE(context->>'source', '') = 'call_outcome_engine'
      AND updated_at < NEW.created_at;

  -- ── FAILED ──
  ELSIF NEW.outcome = 'failed' THEN
    v_action := 'tag_failed_technical_retry';

    UPDATE public.follow_up_queue
    SET context = jsonb_set(
          jsonb_set(
            COALESCE(context, '{}'::jsonb),
            '{last_outcome}',
            '"failed"'::jsonb
          ),
          '{technical_retry}',
          'true'::jsonb
        ),
        updated_at = now()
    WHERE store_id = NEW.store_id
      AND status = 'pending'
      AND COALESCE(context->>'source', '') = 'call_outcome_engine'
      AND updated_at < NEW.created_at;

  ELSE
    v_action := 'no_action';
  END IF;

  -- PART 5: Audit log
  INSERT INTO public.follow_up_audit_log (store_id, event_id, action_taken, previous_state, new_state, details)
  VALUES (
    NEW.store_id,
    NEW.id,
    COALESCE(v_action, 'unknown'),
    NULL,
    NEW.outcome,
    jsonb_build_object(
      'call_sid', NEW.call_sid,
      'call_duration', NEW.call_duration,
      'source', NEW.source
    )
  );

  RETURN NULL; -- AFTER trigger, return value ignored
END;
$$ LANGUAGE plpgsql;

-- AFTER INSERT trigger (not BEFORE)
CREATE TRIGGER trg_process_follow_up_event
  AFTER INSERT ON public.follow_up_events
  FOR EACH ROW
  EXECUTE FUNCTION public.process_follow_up_event();
