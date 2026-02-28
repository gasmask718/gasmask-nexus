
-- ═══════════════════════════════════════════════════════════════
-- FOLLOW-UP EVENTS TABLE — Outcome event log from dialer
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.follow_up_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES public.store_master(id),
  business_id UUID REFERENCES public.businesses(id),
  call_sid TEXT,
  outcome TEXT NOT NULL,
  call_duration INTEGER DEFAULT 0,
  answered_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'dialer',
  queue_item_id UUID,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for unprocessed events (processor query)
CREATE INDEX idx_follow_up_events_unprocessed ON public.follow_up_events (processed, created_at) WHERE processed = false;
CREATE INDEX idx_follow_up_events_store ON public.follow_up_events (store_id, created_at DESC);

-- RLS
ALTER TABLE public.follow_up_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read follow_up_events"
  ON public.follow_up_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert follow_up_events"
  ON public.follow_up_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Enable realtime for live UI updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.follow_up_events;

-- ═══════════════════════════════════════════════════════════════
-- PROCESSOR FUNCTION — Trigger on insert to process cadence
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.process_follow_up_event()
RETURNS TRIGGER AS $$
DECLARE
  v_existing_pending UUID;
BEGIN
  -- Skip if already processed
  IF NEW.processed THEN
    RETURN NEW;
  END IF;

  -- ── ANSWERED: Mark store as engaged, pause cadence ──
  IF NEW.outcome = 'answered' OR NEW.outcome = 'completed' THEN
    -- Cancel any pending follow-ups for this store (engagement resets retry chain)
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
      AND context->>'source' = 'call_outcome_engine';

  -- ── VOICEMAIL: Advance cadence, schedule next step ──
  ELSIF NEW.outcome = 'voicemail' THEN
    -- Update existing pending follow-ups context with latest attempt info
    UPDATE public.follow_up_queue
    SET context = jsonb_set(
          COALESCE(context, '{}'::jsonb),
          '{last_outcome}',
          ('"' || NEW.outcome || '"')::jsonb
        ),
        updated_at = now()
    WHERE store_id = NEW.store_id
      AND status = 'pending'
      AND context->>'source' = 'call_outcome_engine';

  -- ── BUSY: Short retry (handled by createAutoFollowUp, just tag) ──
  ELSIF NEW.outcome = 'busy' THEN
    UPDATE public.follow_up_queue
    SET context = jsonb_set(
          COALESCE(context, '{}'::jsonb),
          '{last_outcome}',
          '"busy"'::jsonb
        ),
        updated_at = now()
    WHERE store_id = NEW.store_id
      AND status = 'pending'
      AND context->>'source' = 'call_outcome_engine';

  -- ── NO ANSWER: Tag for cadence progression ──
  ELSIF NEW.outcome = 'no_answer' THEN
    UPDATE public.follow_up_queue
    SET context = jsonb_set(
          COALESCE(context, '{}'::jsonb),
          '{last_outcome}',
          '"no_answer"'::jsonb
        ),
        updated_at = now()
    WHERE store_id = NEW.store_id
      AND status = 'pending'
      AND context->>'source' = 'call_outcome_engine';

  -- ── FAILED: Tag technical retry ──
  ELSIF NEW.outcome = 'failed' THEN
    UPDATE public.follow_up_queue
    SET context = jsonb_set(
          COALESCE(context, '{}'::jsonb),
          '{last_outcome}',
          '"failed"'::jsonb
        ),
        context = jsonb_set(
          COALESCE(context, '{}'::jsonb),
          '{technical_retry}',
          'true'::jsonb
        ),
        updated_at = now()
    WHERE store_id = NEW.store_id
      AND status = 'pending'
      AND context->>'source' = 'call_outcome_engine';
  END IF;

  -- Mark event as processed
  NEW.processed := true;
  NEW.processed_at := now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on insert
CREATE TRIGGER trg_process_follow_up_event
  BEFORE INSERT ON public.follow_up_events
  FOR EACH ROW
  EXECUTE FUNCTION public.process_follow_up_event();
