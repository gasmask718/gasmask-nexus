
-- Execution Runs table
CREATE TABLE public.follow_up_execution_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','paused','completed','failed','cancelled')),
  total_targets INT NOT NULL DEFAULT 0,
  callable_targets INT NOT NULL DEFAULT 0,
  queued_targets INT NOT NULL DEFAULT 0,
  completed_targets INT NOT NULL DEFAULT 0,
  failed_targets INT NOT NULL DEFAULT 0,
  mode TEXT NOT NULL DEFAULT 'human' CHECK (mode IN ('human','ai','hybrid')),
  voice_engine TEXT NOT NULL DEFAULT 'auto',
  concurrency_limit INT NOT NULL DEFAULT 1,
  batch_size INT NOT NULL DEFAULT 25,
  throttle_ms INT NOT NULL DEFAULT 250,
  notes TEXT
);

-- Execution Targets table
CREATE TABLE public.follow_up_execution_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.follow_up_execution_runs(id) ON DELETE CASCADE,
  store_id UUID NOT NULL,
  resolved_phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','queued','dialing','connected','completed','failed','skipped')),
  attempt_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_exec_targets_run_status ON public.follow_up_execution_targets(run_id, status);
CREATE INDEX idx_exec_targets_store ON public.follow_up_execution_targets(store_id);
CREATE UNIQUE INDEX idx_exec_targets_run_store ON public.follow_up_execution_targets(run_id, store_id);

-- RLS
ALTER TABLE public.follow_up_execution_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_execution_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage execution runs"
  ON public.follow_up_execution_runs FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage execution targets"
  ON public.follow_up_execution_targets FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- Enable realtime for progress tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.follow_up_execution_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.follow_up_execution_targets;
