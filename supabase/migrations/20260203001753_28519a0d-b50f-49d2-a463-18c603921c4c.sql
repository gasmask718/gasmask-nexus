-- Phase 4.5: Task Observations Table
-- Records human decisions and behavior for learning

CREATE TABLE IF NOT EXISTS public.task_observations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES public.ai_work_tasks(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,
  floor_id TEXT NOT NULL,
  observation_type TEXT NOT NULL,
  decision TEXT,
  decision_latency_ms INTEGER,
  dry_run_passed BOOLEAN,
  confidence_at_decision NUMERIC(5,2),
  human_override BOOLEAN DEFAULT false,
  override_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX idx_task_observations_floor ON public.task_observations(floor_id);
CREATE INDEX idx_task_observations_type ON public.task_observations(task_type);
CREATE INDEX idx_task_observations_created ON public.task_observations(created_at DESC);
CREATE INDEX idx_task_observations_decision ON public.task_observations(observation_type) WHERE observation_type = 'decision_made';

-- Enable RLS
ALTER TABLE public.task_observations ENABLE ROW LEVEL SECURITY;

-- RLS Policies: System can insert, authenticated users can read
CREATE POLICY "Anyone can insert observations"
  ON public.task_observations
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view observations"
  ON public.task_observations
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Add comment for documentation
COMMENT ON TABLE public.task_observations IS 'Phase 4.5: Records task decisions and behavior for automation readiness learning';
COMMENT ON COLUMN public.task_observations.observation_type IS 'Type: task_created, task_started, dry_run_executed, approval_requested, decision_made, task_completed, task_cancelled, task_failed';
COMMENT ON COLUMN public.task_observations.decision IS 'Human decision: approved, rejected, modified, cancelled, auto_approved';