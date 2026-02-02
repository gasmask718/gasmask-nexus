-- Enhanced AI Playbooks with governance fields
ALTER TABLE public.ai_playbooks 
ADD COLUMN IF NOT EXISTS domain text DEFAULT 'general',
ADD COLUMN IF NOT EXISTS trigger_conditions jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS allowed_data_sources text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS decision_rules jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS output_types text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS confidence_threshold numeric DEFAULT 0.7,
ADD COLUMN IF NOT EXISTS escalation_rules jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS requires_approval boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS version integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS approved_by uuid,
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone;

-- Enhanced AI Routines with scheduling and execution fields
ALTER TABLE public.ai_routines
ADD COLUMN IF NOT EXISTS routine_name text,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS input_sources jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS expected_outputs text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS notification_rules jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS failure_handling text DEFAULT 'escalate',
ADD COLUMN IF NOT EXISTS last_run_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_result jsonb,
ADD COLUMN IF NOT EXISTS run_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS success_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS failure_count integer DEFAULT 0;

-- AI Instinct Log - immutable memory of AI decisions
CREATE TABLE IF NOT EXISTS public.ai_instinct_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid REFERENCES public.ai_workers(id),
  task_id uuid REFERENCES public.ai_work_tasks(id),
  playbook_id uuid REFERENCES public.ai_playbooks(id),
  action_type text NOT NULL,
  input_data jsonb NOT NULL DEFAULT '{}',
  reasoning text NOT NULL,
  decision_path jsonb DEFAULT '[]',
  confidence_score numeric NOT NULL,
  human_feedback text,
  feedback_status text DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- AI Action Queue - human-AI handoff
CREATE TABLE IF NOT EXISTS public.ai_action_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.ai_work_tasks(id),
  worker_id uuid REFERENCES public.ai_workers(id),
  action_type text NOT NULL,
  action_summary text NOT NULL,
  ai_recommendation text NOT NULL,
  reasoning jsonb NOT NULL DEFAULT '{}',
  risk_level text NOT NULL DEFAULT 'low',
  sla_deadline timestamp with time zone,
  status text NOT NULL DEFAULT 'pending',
  human_decision text,
  decision_notes text,
  decided_by uuid,
  decided_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- AI Performance Results - ROI tracking
CREATE TABLE IF NOT EXISTS public.ai_performance_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  worker_id uuid REFERENCES public.ai_workers(id),
  playbook_id uuid REFERENCES public.ai_playbooks(id),
  tasks_auto_resolved integer DEFAULT 0,
  tasks_escalated integer DEFAULT 0,
  time_saved_minutes integer DEFAULT 0,
  errors_prevented integer DEFAULT 0,
  revenue_protected numeric DEFAULT 0,
  revenue_generated numeric DEFAULT 0,
  human_trust_score numeric DEFAULT 0,
  confidence_trend jsonb DEFAULT '[]',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- AI Kill Switch State enhancement
ALTER TABLE public.ai_kill_switch_state
ADD COLUMN IF NOT EXISTS scope text DEFAULT 'global',
ADD COLUMN IF NOT EXISTS target_worker_id uuid REFERENCES public.ai_workers(id),
ADD COLUMN IF NOT EXISTS target_playbook_id uuid REFERENCES public.ai_playbooks(id),
ADD COLUMN IF NOT EXISTS activated_by uuid,
ADD COLUMN IF NOT EXISTS activation_reason text,
ADD COLUMN IF NOT EXISTS deactivated_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS deactivated_by uuid;

-- Enable RLS on new tables
ALTER TABLE public.ai_instinct_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_action_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_performance_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_instinct_log
CREATE POLICY "Authenticated users can view instinct logs"
ON public.ai_instinct_log FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Service role can insert instinct logs"
ON public.ai_instinct_log FOR INSERT
TO authenticated
WITH CHECK (true);

-- RLS Policies for ai_action_queue
CREATE POLICY "Authenticated users can view action queue"
ON public.ai_action_queue FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can update action queue"
ON public.ai_action_queue FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert action queue"
ON public.ai_action_queue FOR INSERT
TO authenticated
WITH CHECK (true);

-- RLS Policies for ai_performance_results
CREATE POLICY "Authenticated users can view performance results"
ON public.ai_performance_results FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Service role can manage performance results"
ON public.ai_performance_results FOR ALL
TO authenticated
USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_instinct_log_worker ON public.ai_instinct_log(worker_id);
CREATE INDEX IF NOT EXISTS idx_ai_instinct_log_task ON public.ai_instinct_log(task_id);
CREATE INDEX IF NOT EXISTS idx_ai_instinct_log_created ON public.ai_instinct_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_action_queue_status ON public.ai_action_queue(status);
CREATE INDEX IF NOT EXISTS idx_ai_action_queue_risk ON public.ai_action_queue(risk_level);
CREATE INDEX IF NOT EXISTS idx_ai_performance_period ON public.ai_performance_results(period_start, period_end);