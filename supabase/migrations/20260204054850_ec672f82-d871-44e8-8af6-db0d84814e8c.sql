-- ═══════════════════════════════════════════════════════════════════════════════
-- FIELD SUBMISSION REVIEW & APPROVAL LAYER
-- Governance layer for all field-user mutations
-- ═══════════════════════════════════════════════════════════════════════════════

-- Create enum for entity types
CREATE TYPE public.field_entity_type AS ENUM (
  'brand_sticker',
  'tube_inventory', 
  'invoice',
  'invoice_line_item',
  'order_note',
  'visit_log',
  'store_update'
);

-- Create enum for action types
CREATE TYPE public.field_action_type AS ENUM (
  'create',
  'update',
  'delete'
);

-- Create enum for submission status
CREATE TYPE public.field_submission_status AS ENUM (
  'pending_review',
  'approved',
  'rejected',
  'auto_approved'
);

-- Create the main field_submissions table
CREATE TABLE public.field_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Submitter info
  submitted_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitted_by_role TEXT NOT NULL CHECK (submitted_by_role IN ('driver', 'biker', 'ambassador')),
  
  -- Target info
  store_id UUID NOT NULL REFERENCES public.store_master(id) ON DELETE CASCADE,
  entity_type field_entity_type NOT NULL,
  entity_id UUID, -- Reference to the affected record (if exists)
  
  -- Action details
  action_type field_action_type NOT NULL,
  payload_before JSONB, -- Previous state (null for creates)
  payload_after JSONB NOT NULL, -- Intended new state
  
  -- Review workflow
  submission_status field_submission_status NOT NULL DEFAULT 'pending_review',
  reviewed_by_user_id UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  amendment_notes TEXT,
  
  -- Flags
  is_applied BOOLEAN DEFAULT FALSE, -- Whether change was written to production
  is_rolled_back BOOLEAN DEFAULT FALSE, -- Whether change was undone
  risk_score INTEGER DEFAULT 0, -- 0-100 computed risk level
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_field_submissions_store ON public.field_submissions(store_id);
CREATE INDEX idx_field_submissions_user ON public.field_submissions(submitted_by_user_id);
CREATE INDEX idx_field_submissions_status ON public.field_submissions(submission_status);
CREATE INDEX idx_field_submissions_entity ON public.field_submissions(entity_type);
CREATE INDEX idx_field_submissions_created ON public.field_submissions(created_at DESC);

-- Enable RLS
ALTER TABLE public.field_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Field users can INSERT their own submissions
CREATE POLICY "Field users can create submissions"
ON public.field_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = submitted_by_user_id
  AND submitted_by_role IN ('driver', 'biker', 'ambassador')
);

-- Field users can SELECT their own submissions
CREATE POLICY "Field users can view own submissions"
ON public.field_submissions
FOR SELECT
TO authenticated
USING (
  auth.uid() = submitted_by_user_id
);

-- Admins/Owners can view all submissions
CREATE POLICY "Admins can view all submissions"
ON public.field_submissions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'owner')
  )
);

-- Admins/Owners can update submissions (for approval/rejection)
CREATE POLICY "Admins can review submissions"
ON public.field_submissions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'owner')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'owner')
  )
);

-- Create auto-approval rules table
CREATE TABLE public.field_submission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type field_entity_type NOT NULL,
  action_type field_action_type NOT NULL,
  rule_name TEXT NOT NULL,
  rule_condition JSONB NOT NULL, -- Condition definition
  auto_approve BOOLEAN DEFAULT FALSE,
  require_approval BOOLEAN DEFAULT FALSE,
  risk_score_modifier INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.field_submission_rules ENABLE ROW LEVEL SECURITY;

-- Only admins can manage rules
CREATE POLICY "Admins manage submission rules"
ON public.field_submission_rules
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'owner')
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_field_submissions_updated_at
BEFORE UPDATE ON public.field_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default auto-approval rules
INSERT INTO public.field_submission_rules (entity_type, action_type, rule_name, rule_condition, auto_approve, risk_score_modifier) VALUES
  ('tube_inventory', 'update', 'Standard tube update', '{"max_quantity": 10}', true, 0),
  ('brand_sticker', 'update', 'Sticker note edit', '{"fields": ["notes"]}', true, 0),
  ('order_note', 'create', 'New order note', '{}', true, 0),
  ('visit_log', 'create', 'Visit log entry', '{}', true, 0),
  ('invoice', 'create', 'High value invoice', '{"min_amount": 500}', false, 30),
  ('store_update', 'update', 'First-time store edit', '{"is_first_edit": true}', false, 50);