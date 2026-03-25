
-- Batch control tables for parallel dialer
CREATE TABLE public.solar_call_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id),
  batch_name TEXT NOT NULL,
  campaign_id TEXT,
  total_contacts INT DEFAULT 0,
  calls_started INT DEFAULT 0,
  calls_completed INT DEFAULT 0,
  calls_answered INT DEFAULT 0,
  calls_interested INT DEFAULT 0,
  max_concurrent INT DEFAULT 10,
  pacing_delay_ms INT DEFAULT 2000,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','paused','completed','failed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.solar_call_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES public.solar_call_batches(id) ON DELETE CASCADE,
  lead_id UUID,
  contact_id UUID,
  phone TEXT NOT NULL,
  contact_name TEXT,
  priority_score INT DEFAULT 50,
  call_status TEXT NOT NULL DEFAULT 'queued' CHECK (call_status IN ('queued','dialing','active','completed','failed','no_answer','voicemail','retry')),
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  call_sid TEXT,
  outcome TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_solar_call_queue_batch_status ON public.solar_call_queue(batch_id, call_status);
CREATE INDEX idx_solar_call_queue_priority ON public.solar_call_queue(batch_id, priority_score DESC);
CREATE INDEX idx_solar_call_batches_status ON public.solar_call_batches(status);

ALTER TABLE public.solar_call_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_call_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage batches" ON public.solar_call_batches FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage queue" ON public.solar_call_queue FOR ALL TO authenticated USING (true) WITH CHECK (true);
