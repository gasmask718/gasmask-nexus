-- 1. Create dynasty_call_history table (does not exist yet)
CREATE TABLE IF NOT EXISTS public.dynasty_call_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id TEXT UNIQUE NOT NULL,
  queue_id UUID REFERENCES public.dynasty_call_queue(id) ON DELETE SET NULL,
  phone_number TEXT,
  from_number TEXT,
  status TEXT NOT NULL DEFAULT 'initiated',
  started_at TIMESTAMPTZ DEFAULT now(),
  rang_at TIMESTAMPTZ,
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration INTEGER,
  recording_url TEXT,
  call_summary TEXT,
  variables JSONB,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dch_call_id ON public.dynasty_call_history(call_id);
CREATE INDEX IF NOT EXISTS idx_dch_queue_id ON public.dynasty_call_history(queue_id);
CREATE INDEX IF NOT EXISTS idx_dch_status ON public.dynasty_call_history(status);

ALTER TABLE public.dynasty_call_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view call history"
  ON public.dynasty_call_history FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Service role manages call history"
  ON public.dynasty_call_history FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE TRIGGER update_dynasty_call_history_updated_at
  BEFORE UPDATE ON public.dynasty_call_history
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Create dynasty_call_transcripts table for live transcript segments
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

CREATE POLICY "Authenticated can view transcripts"
  ON public.dynasty_call_transcripts FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Service role manages transcripts"
  ON public.dynasty_call_transcripts FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- 3. Add missing columns to dynasty_call_queue
ALTER TABLE public.dynasty_call_queue
  ADD COLUMN IF NOT EXISTS error_message TEXT;

-- 4. Enable realtime for live monitoring
ALTER TABLE public.dynasty_call_history REPLICA IDENTITY FULL;
ALTER TABLE public.dynasty_call_transcripts REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dynasty_call_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dynasty_call_transcripts;