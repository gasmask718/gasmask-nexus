
-- Match logging table for debugging and auditing
CREATE TABLE IF NOT EXISTS public.sbo_external_match_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id UUID REFERENCES public.sbo_capper_picks(id),
  external_result_id UUID REFERENCES public.sbo_external_results(id),
  match_type TEXT NOT NULL DEFAULT 'exact', -- exact, fuzzy, team, unmatched
  match_confidence NUMERIC DEFAULT 100,
  match_details JSONB DEFAULT '{}',
  result TEXT, -- win, loss, push, null if unmatched
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for quick lookups
CREATE INDEX idx_match_logs_pick ON public.sbo_external_match_logs(pick_id);
CREATE INDEX idx_match_logs_type ON public.sbo_external_match_logs(match_type);

-- Enable RLS but allow service role
ALTER TABLE public.sbo_external_match_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read" ON public.sbo_external_match_logs FOR SELECT TO authenticated USING (true);
