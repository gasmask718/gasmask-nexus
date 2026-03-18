
-- Execution worker queue table for autonomous action dispatch
CREATE TABLE IF NOT EXISTS public.brandaro_execution_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.brandaro_qualified_leads(id) ON DELETE CASCADE NOT NULL,
  prediction_id UUID REFERENCES public.brandaro_conversion_predictions(id) ON DELETE SET NULL,
  priority_tier TEXT NOT NULL DEFAULT 'low',
  action_strategy TEXT NOT NULL DEFAULT 'slow_nurture',
  conversion_probability NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ DEFAULT now(),
  cooldown_until TIMESTAMPTZ,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for worker polling
CREATE INDEX idx_exec_queue_pending ON public.brandaro_execution_queue(status, next_attempt_at) WHERE status = 'pending';
CREATE INDEX idx_exec_queue_lead ON public.brandaro_execution_queue(lead_id);

-- Disable RLS (internal system table)
ALTER TABLE public.brandaro_execution_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.brandaro_execution_queue FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read" ON public.brandaro_execution_queue FOR SELECT TO anon USING (true);
