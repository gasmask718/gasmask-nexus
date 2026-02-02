-- ============================================================
-- FLOOR 9: LEARNING FEEDBACK SYSTEM
-- Phase 9.2.1 - Results → Learning Feedback Loop
-- ============================================================

-- 1. Structured feedback capture table
CREATE TABLE public.ai_feedback_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Link to source
  task_id UUID REFERENCES public.ai_work_tasks(id),
  action_queue_id UUID REFERENCES public.ai_action_queue(id),
  worker_id UUID REFERENCES public.ai_workers(id),
  playbook_id UUID REFERENCES public.ai_playbooks(id),
  
  -- Decision context
  decision_type TEXT NOT NULL CHECK (decision_type IN ('approved', 'rejected', 'modified', 'rolled_back', 'escalated')),
  confidence_at_decision INTEGER,
  task_type TEXT,
  target_entity_type TEXT,
  
  -- Structured feedback fields
  feedback_category TEXT NOT NULL CHECK (feedback_category IN (
    'accuracy', 'timing', 'context_missing', 'wrong_target', 
    'tone_inappropriate', 'data_stale', 'permission_issue',
    'ambiguous_instructions', 'other'
  )),
  feedback_subcategory TEXT,
  feedback_reasoning TEXT NOT NULL, -- Min 10 chars enforced at app level
  
  -- Modification details (when decision = modified)
  original_recommendation TEXT,
  modified_to TEXT,
  what_changed TEXT,
  why_changed TEXT,
  
  -- Sentiment signals
  was_overconfident BOOLEAN DEFAULT false,
  was_underconfident BOOLEAN DEFAULT false,
  escalation_was_correct BOOLEAN,
  
  -- Learning signals
  should_retrain_on BOOLEAN DEFAULT false,
  pattern_detected TEXT,
  suggested_rule_change TEXT,
  
  -- Audit
  submitted_by UUID,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_feedback_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies for feedback
CREATE POLICY "Authenticated users can view feedback" 
ON public.ai_feedback_entries FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create feedback" 
ON public.ai_feedback_entries FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- 2. Aggregated feedback patterns table
CREATE TABLE public.ai_feedback_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Pattern scope
  task_type TEXT,
  target_entity_type TEXT,
  worker_id UUID REFERENCES public.ai_workers(id),
  playbook_id UUID REFERENCES public.ai_playbooks(id),
  
  -- Aggregated stats
  total_feedback_count INTEGER NOT NULL DEFAULT 0,
  approved_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  modified_count INTEGER NOT NULL DEFAULT 0,
  rolled_back_count INTEGER NOT NULL DEFAULT 0,
  
  -- Confidence calibration
  avg_confidence_when_approved NUMERIC(5,2),
  avg_confidence_when_rejected NUMERIC(5,2),
  overconfidence_rate NUMERIC(5,2),
  underconfidence_rate NUMERIC(5,2),
  
  -- Top rejection reasons
  top_rejection_categories JSONB DEFAULT '[]'::jsonb,
  top_modification_reasons JSONB DEFAULT '[]'::jsonb,
  
  -- Pattern insights
  confidence_recommendation TEXT,
  suggested_adjustments JSONB DEFAULT '[]'::jsonb,
  
  -- Time tracking
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_feedback_patterns ENABLE ROW LEVEL SECURITY;

-- RLS policies for patterns (read-only for users)
CREATE POLICY "Authenticated users can view patterns" 
ON public.ai_feedback_patterns FOR SELECT 
USING (auth.role() = 'authenticated');

-- 3. Confidence recalibration log (audit trail of AI learning)
CREATE TABLE public.ai_confidence_recalibrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Scope
  task_type TEXT,
  worker_id UUID REFERENCES public.ai_workers(id),
  playbook_id UUID REFERENCES public.ai_playbooks(id),
  
  -- Before/after
  previous_baseline_confidence INTEGER,
  new_baseline_confidence INTEGER,
  adjustment_delta INTEGER,
  
  -- Reasoning
  recalibration_reason TEXT NOT NULL,
  based_on_feedback_count INTEGER,
  based_on_pattern_id UUID REFERENCES public.ai_feedback_patterns(id),
  
  -- Audit
  triggered_by TEXT CHECK (triggered_by IN ('system', 'human')),
  approved_by UUID,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_confidence_recalibrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view recalibrations" 
ON public.ai_confidence_recalibrations FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create recalibrations" 
ON public.ai_confidence_recalibrations FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- 4. Add feedback reference to action queue
ALTER TABLE public.ai_action_queue 
ADD COLUMN IF NOT EXISTS feedback_id UUID REFERENCES public.ai_feedback_entries(id),
ADD COLUMN IF NOT EXISTS feedback_submitted_at TIMESTAMP WITH TIME ZONE;

-- 5. Add learning signals to work tasks
ALTER TABLE public.ai_work_tasks
ADD COLUMN IF NOT EXISTS feedback_id UUID REFERENCES public.ai_feedback_entries(id),
ADD COLUMN IF NOT EXISTS learning_applied BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS confidence_adjustment_applied INTEGER;

-- 6. Indexes for efficient querying
CREATE INDEX idx_feedback_entries_task_type ON public.ai_feedback_entries(task_type);
CREATE INDEX idx_feedback_entries_decision_type ON public.ai_feedback_entries(decision_type);
CREATE INDEX idx_feedback_entries_submitted_at ON public.ai_feedback_entries(submitted_at);
CREATE INDEX idx_feedback_patterns_task_type ON public.ai_feedback_patterns(task_type);
CREATE INDEX idx_feedback_patterns_period ON public.ai_feedback_patterns(period_start, period_end);

-- 7. Function to aggregate feedback into patterns (called periodically)
CREATE OR REPLACE FUNCTION public.aggregate_feedback_patterns(
  p_period_start TIMESTAMP WITH TIME ZONE,
  p_period_end TIMESTAMP WITH TIME ZONE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted_count INTEGER := 0;
BEGIN
  INSERT INTO ai_feedback_patterns (
    task_type,
    target_entity_type,
    total_feedback_count,
    approved_count,
    rejected_count,
    modified_count,
    rolled_back_count,
    avg_confidence_when_approved,
    avg_confidence_when_rejected,
    overconfidence_rate,
    underconfidence_rate,
    period_start,
    period_end
  )
  SELECT
    task_type,
    target_entity_type,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE decision_type = 'approved') as approved,
    COUNT(*) FILTER (WHERE decision_type = 'rejected') as rejected,
    COUNT(*) FILTER (WHERE decision_type = 'modified') as modified,
    COUNT(*) FILTER (WHERE decision_type = 'rolled_back') as rolled_back,
    AVG(confidence_at_decision) FILTER (WHERE decision_type = 'approved') as avg_conf_approved,
    AVG(confidence_at_decision) FILTER (WHERE decision_type = 'rejected') as avg_conf_rejected,
    (COUNT(*) FILTER (WHERE was_overconfident = true)::numeric / NULLIF(COUNT(*), 0) * 100) as overconf_rate,
    (COUNT(*) FILTER (WHERE was_underconfident = true)::numeric / NULLIF(COUNT(*), 0) * 100) as underconf_rate,
    p_period_start,
    p_period_end
  FROM ai_feedback_entries
  WHERE submitted_at >= p_period_start AND submitted_at < p_period_end
  GROUP BY task_type, target_entity_type;
  
  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  RETURN v_inserted_count;
END;
$$;