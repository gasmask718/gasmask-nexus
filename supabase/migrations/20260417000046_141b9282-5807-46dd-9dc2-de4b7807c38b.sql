CREATE TABLE IF NOT EXISTS public.dynasty_call_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  speaker TEXT NOT NULL CHECK (speaker IN ('ai', 'prospect')),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transcripts_call_id ON public.dynasty_call_transcripts(call_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_timestamp ON public.dynasty_call_transcripts(timestamp);

ALTER TABLE public.dynasty_call_transcripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view transcripts" ON public.dynasty_call_transcripts;
CREATE POLICY "Authenticated users can view transcripts"
  ON public.dynasty_call_transcripts FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role can insert transcripts" ON public.dynasty_call_transcripts;
CREATE POLICY "Service role can insert transcripts"
  ON public.dynasty_call_transcripts FOR INSERT
  TO authenticated
  WITH CHECK (true);

ALTER TABLE public.dynasty_call_history
  ADD COLUMN IF NOT EXISTS rang_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS answered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recording_url TEXT,
  ADD COLUMN IF NOT EXISTS call_summary TEXT,
  ADD COLUMN IF NOT EXISTS variables JSONB,
  ADD COLUMN IF NOT EXISTS from_number TEXT;

ALTER TABLE public.dynasty_call_queue
  ADD COLUMN IF NOT EXISTS call_id TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS bland_call_id TEXT,
  ADD COLUMN IF NOT EXISTS called_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE public.dynasty_call_transcripts REPLICA IDENTITY FULL;