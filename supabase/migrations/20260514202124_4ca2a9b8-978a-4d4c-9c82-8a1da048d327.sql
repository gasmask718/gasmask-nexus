ALTER TABLE public.outbound_call_queue
  ADD COLUMN IF NOT EXISTS follow_up_status text,
  ADD COLUMN IF NOT EXISTS call_summary text,
  ADD COLUMN IF NOT EXISTS next_call_context text,
  ADD COLUMN IF NOT EXISTS follow_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS wrap_up_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_analysis jsonb;

CREATE INDEX IF NOT EXISTS idx_ocq_follow_up_status ON public.outbound_call_queue(follow_up_status);
CREATE INDEX IF NOT EXISTS idx_ocq_follow_up_at ON public.outbound_call_queue(follow_up_at);