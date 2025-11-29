-- Create ai_ops_log table for operational intelligence logging
CREATE TABLE public.ai_ops_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cycle_type TEXT NOT NULL CHECK (cycle_type IN ('morning', 'midday', 'evening')),
  results JSONB NOT NULL DEFAULT '{}',
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  success BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  errors JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_ai_ops_log_cycle_type ON public.ai_ops_log(cycle_type);
CREATE INDEX idx_ai_ops_log_run_at ON public.ai_ops_log(run_at DESC);
CREATE INDEX idx_ai_ops_log_success ON public.ai_ops_log(success);

-- Enable RLS
ALTER TABLE public.ai_ops_log ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view ops logs"
  ON public.ai_ops_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert ops logs"
  ON public.ai_ops_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add auto_ops_enabled column to ai_follow_up_settings if not exists
ALTER TABLE public.ai_follow_up_settings 
ADD COLUMN IF NOT EXISTS morning_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS midday_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS evening_enabled BOOLEAN DEFAULT true;