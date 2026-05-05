-- Add post-call wrap-up fields for VA dashboard
ALTER TABLE public.va_call_logs
  ADD COLUMN IF NOT EXISTS call_summary text,
  ADD COLUMN IF NOT EXISTS follow_up_status text,
  ADD COLUMN IF NOT EXISTS next_call_context text,
  ADD COLUMN IF NOT EXISTS follow_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS wrap_up_completed_at timestamptz;

-- Allowed follow-up statuses
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'va_call_logs_follow_up_status_check'
  ) THEN
    ALTER TABLE public.va_call_logs
      ADD CONSTRAINT va_call_logs_follow_up_status_check
      CHECK (follow_up_status IS NULL OR follow_up_status = ANY (ARRAY[
        'won_back',
        'callback_needed',
        'follow_up_later',
        'not_interested',
        'no_answer',
        'closed_deal',
        'nurture'
      ]));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_va_call_logs_lead_called_at
  ON public.va_call_logs (lead_id, called_at DESC);

CREATE INDEX IF NOT EXISTS idx_va_call_logs_follow_up_at
  ON public.va_call_logs (follow_up_at)
  WHERE follow_up_at IS NOT NULL;