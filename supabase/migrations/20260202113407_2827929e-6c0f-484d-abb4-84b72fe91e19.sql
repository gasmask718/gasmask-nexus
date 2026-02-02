-- Phase 9.2: Assisted Execution Engine Schema
-- Extends ai_work_tasks for bounded execution and creates artifact tracking

-- Add execution-specific columns to ai_work_tasks
ALTER TABLE public.ai_work_tasks 
ADD COLUMN IF NOT EXISTS task_type text DEFAULT 'general',
ADD COLUMN IF NOT EXISTS execution_mode text DEFAULT 'draft_only' CHECK (execution_mode IN ('draft_only', 'execute_with_approval', 'recommendation_only')),
ADD COLUMN IF NOT EXISTS target_entity_type text,
ADD COLUMN IF NOT EXISTS target_entity_id uuid,
ADD COLUMN IF NOT EXISTS instructions text,
ADD COLUMN IF NOT EXISTS deadline timestamptz,
ADD COLUMN IF NOT EXISTS confidence_score numeric(5,2),
ADD COLUMN IF NOT EXISTS risk_level text DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'not_required' CHECK (approval_status IN ('not_required', 'pending', 'approved', 'rejected', 'modified')),
ADD COLUMN IF NOT EXISTS approved_by uuid,
ADD COLUMN IF NOT EXISTS approved_at timestamptz,
ADD COLUMN IF NOT EXISTS approval_notes text,
ADD COLUMN IF NOT EXISTS execution_log jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS validation_errors jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS time_saved_minutes integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS rollback_until timestamptz;

-- Create task artifacts table
CREATE TABLE IF NOT EXISTS public.ai_task_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.ai_work_tasks(id) ON DELETE CASCADE,
  artifact_type text NOT NULL CHECK (artifact_type IN (
    'crm_note', 'invoice_draft', 'categorization_tag', 'audit_summary', 
    'answer_log', 'report', 'follow_up', 'data_correction'
  )),
  artifact_title text NOT NULL,
  artifact_content jsonb NOT NULL DEFAULT '{}',
  target_entity_type text,
  target_entity_id uuid,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'applied', 'rejected', 'rolled_back')),
  approved_by uuid,
  approved_at timestamptz,
  applied_at timestamptz,
  rolled_back_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create task execution audit log
CREATE TABLE IF NOT EXISTS public.ai_task_execution_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.ai_work_tasks(id) ON DELETE CASCADE,
  step_number integer NOT NULL,
  step_action text NOT NULL,
  step_status text NOT NULL CHECK (step_status IN ('started', 'completed', 'failed', 'skipped', 'blocked')),
  step_details jsonb DEFAULT '{}',
  error_message text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create allowed task types table (the allowlist)
CREATE TABLE IF NOT EXISTS public.ai_executable_task_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  allowed_execution_modes text[] DEFAULT ARRAY['draft_only'],
  max_risk_level text DEFAULT 'medium' CHECK (max_risk_level IN ('low', 'medium', 'high')),
  requires_approval boolean DEFAULT true,
  allowed_roles text[] DEFAULT ARRAY['owner', 'admin'],
  sandbox_permissions jsonb DEFAULT '{"read": true, "write_drafts": true, "generate": true, "execute": false}',
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.ai_task_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_task_execution_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_executable_task_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_task_artifacts
CREATE POLICY "Elevated users can view artifacts"
ON public.ai_task_artifacts FOR SELECT
TO authenticated
USING (public.is_elevated_user(auth.uid()));

CREATE POLICY "Elevated users can manage artifacts"
ON public.ai_task_artifacts FOR ALL
TO authenticated
USING (public.is_elevated_user(auth.uid()));

-- RLS Policies for ai_task_execution_log
CREATE POLICY "Elevated users can view execution logs"
ON public.ai_task_execution_log FOR SELECT
TO authenticated
USING (public.is_elevated_user(auth.uid()));

CREATE POLICY "System can write execution logs"
ON public.ai_task_execution_log FOR INSERT
TO authenticated
WITH CHECK (true);

-- RLS Policies for ai_executable_task_types
CREATE POLICY "Anyone can view task types"
ON public.ai_executable_task_types FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only admins can manage task types"
ON public.ai_executable_task_types FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_work_tasks_task_type ON public.ai_work_tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_ai_work_tasks_execution_mode ON public.ai_work_tasks(execution_mode);
CREATE INDEX IF NOT EXISTS idx_ai_work_tasks_approval_status ON public.ai_work_tasks(approval_status);
CREATE INDEX IF NOT EXISTS idx_ai_task_artifacts_task_id ON public.ai_task_artifacts(task_id);
CREATE INDEX IF NOT EXISTS idx_ai_task_artifacts_status ON public.ai_task_artifacts(status);
CREATE INDEX IF NOT EXISTS idx_ai_task_execution_log_task_id ON public.ai_task_execution_log(task_id);

-- Insert default executable task types (the allowlist)
INSERT INTO public.ai_executable_task_types (task_type, display_name, description, allowed_execution_modes, max_risk_level, requires_approval, sandbox_permissions) VALUES
  ('customer_service_response', 'Customer Service Response', 'Draft responses to customer inquiries', ARRAY['draft_only', 'execute_with_approval'], 'low', true, '{"read": true, "write_drafts": true, "generate": true, "execute": false}'),
  ('store_audit_review', 'Store Audit Review', 'Review and verify store data for accuracy', ARRAY['draft_only', 'execute_with_approval'], 'medium', true, '{"read": true, "write_drafts": true, "generate": true, "execute": false}'),
  ('data_entry_verification', 'Data Entry Verification', 'Verify data accuracy against source records', ARRAY['draft_only', 'execute_with_approval'], 'low', true, '{"read": true, "write_drafts": true, "generate": true, "execute": false}'),
  ('store_categorization', 'Store Categorization', 'Categorize and tag stores based on attributes', ARRAY['draft_only', 'execute_with_approval'], 'low', false, '{"read": true, "write_drafts": true, "generate": true, "execute": false}'),
  ('invoice_draft_creation', 'Invoice Draft Creation', 'Generate draft invoices for review', ARRAY['draft_only'], 'high', true, '{"read": true, "write_drafts": true, "generate": true, "execute": false}'),
  ('crm_note_generation', 'CRM Note Generation', 'Generate CRM notes from interactions', ARRAY['draft_only', 'execute_with_approval'], 'low', false, '{"read": true, "write_drafts": true, "generate": true, "execute": false}'),
  ('follow_up_recommendation', 'Follow-up Recommendation', 'Recommend follow-up actions for stores/customers', ARRAY['draft_only', 'execute_with_approval'], 'low', true, '{"read": true, "write_drafts": true, "generate": true, "execute": false}'),
  ('report_generation', 'Report Generation', 'Generate analytical reports', ARRAY['draft_only', 'execute_with_approval'], 'low', false, '{"read": true, "write_drafts": true, "generate": true, "execute": false}')
ON CONFLICT (task_type) DO NOTHING;

-- Update ai_work_tasks status enum to include new execution states
-- First drop the old check constraint if it exists
ALTER TABLE public.ai_work_tasks DROP CONSTRAINT IF EXISTS ai_work_tasks_status_check;

-- Add new check constraint with expanded states
ALTER TABLE public.ai_work_tasks ADD CONSTRAINT ai_work_tasks_status_check 
CHECK (status IN ('pending', 'assigned', 'validating_inputs', 'processing', 'awaiting_approval', 'completed', 'failed', 'escalated', 'blocked', 'rolled_back'));