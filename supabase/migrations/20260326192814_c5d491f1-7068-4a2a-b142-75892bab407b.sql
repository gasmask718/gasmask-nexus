
-- Add production fields to ut_partner_leads
ALTER TABLE public.ut_partner_leads
  ADD COLUMN IF NOT EXISTS follow_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS callback_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_outcome text,
  ADD COLUMN IF NOT EXISTS outreach_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS owner_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS best_time_to_call text,
  ADD COLUMN IF NOT EXISTS assigned_va text,
  ADD COLUMN IF NOT EXISTS priority_bucket text DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS ai_call_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_call_last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_call_result text,
  ADD COLUMN IF NOT EXISTS ai_handoff_reason text,
  ADD COLUMN IF NOT EXISTS recommended_ai_agent text;

-- Add template_name to ut_outreach_logs for SMS tracking  
ALTER TABLE public.ut_outreach_logs
  ADD COLUMN IF NOT EXISTS template_name text;

-- Add onboarding fields to ut_partner_profiles
ALTER TABLE public.ut_partner_profiles
  ADD COLUMN IF NOT EXISTS onboarding_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS source_lead_id uuid REFERENCES public.ut_partner_leads(id) ON DELETE SET NULL;

-- Create indexes for production queries
CREATE INDEX IF NOT EXISTS idx_ut_leads_follow_up ON public.ut_partner_leads (follow_up_at) WHERE follow_up_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ut_leads_callback_due ON public.ut_partner_leads (callback_due_at) WHERE callback_due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ut_leads_last_contacted ON public.ut_partner_leads (last_contacted_at);
CREATE INDEX IF NOT EXISTS idx_ut_leads_assigned_va ON public.ut_partner_leads (assigned_va);
CREATE INDEX IF NOT EXISTS idx_ut_leads_priority ON public.ut_partner_leads (priority_bucket);
