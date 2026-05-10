ALTER TABLE public.bland_call_logs
  ADD COLUMN IF NOT EXISTS delivery_requested boolean,
  ADD COLUMN IF NOT EXISTS preferred_day text,
  ADD COLUMN IF NOT EXISTS preferred_window text,
  ADD COLUMN IF NOT EXISTS urgency text,
  ADD COLUMN IF NOT EXISTS intent_summary text,
  ADD COLUMN IF NOT EXISTS is_reactivation_lead boolean,
  ADD COLUMN IF NOT EXISTS structured_outcome_received_at timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_preferred_day') THEN
    ALTER TABLE public.bland_call_logs
      ADD CONSTRAINT chk_preferred_day
        CHECK (preferred_day IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday') OR preferred_day IS NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_preferred_window') THEN
    ALTER TABLE public.bland_call_logs
      ADD CONSTRAINT chk_preferred_window
        CHECK (preferred_window IN ('morning','afternoon','evening') OR preferred_window IS NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_urgency') THEN
    ALTER TABLE public.bland_call_logs
      ADD CONSTRAINT chk_urgency
        CHECK (urgency IN ('today','this_week','next_week','no_rush') OR urgency IS NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bland_delivery_requested
  ON public.bland_call_logs(delivery_requested, created_at DESC)
  WHERE delivery_requested = true;