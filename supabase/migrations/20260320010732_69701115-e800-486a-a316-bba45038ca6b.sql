CREATE TABLE IF NOT EXISTS public.brandaro_search_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  industry TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  radius_meters INTEGER DEFAULT 40000,
  status TEXT DEFAULT 'queued',
  job_id UUID,
  total_imported INTEGER DEFAULT 0,
  error_message TEXT,
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Prevent exact duplicate searches (only for active/done items)
CREATE UNIQUE INDEX IF NOT EXISTS idx_search_queue_unique
ON public.brandaro_search_queue(industry, city, state)
WHERE status IN ('queued','running','completed');

-- RLS
ALTER TABLE public.brandaro_search_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to search queue"
ON public.brandaro_search_queue FOR ALL
USING (true)
WITH CHECK (true);