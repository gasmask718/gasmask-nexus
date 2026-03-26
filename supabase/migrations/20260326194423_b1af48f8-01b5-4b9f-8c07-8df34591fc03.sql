
-- Add production fields to ut_partner_leads
ALTER TABLE ut_partner_leads 
  ADD COLUMN IF NOT EXISTS next_step text,
  ADD COLUMN IF NOT EXISTS onboarding_link_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sms_template text,
  ADD COLUMN IF NOT EXISTS sms_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS automation_state text DEFAULT 'idle';

-- Create ut_partner_onboarding table
CREATE TABLE IF NOT EXISTS public.ut_partner_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_profile_id uuid REFERENCES ut_partner_profiles(id) ON DELETE SET NULL,
  source_lead_id uuid REFERENCES ut_partner_leads(id) ON DELETE SET NULL,
  onboarding_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  onboarding_link text,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ut_partner_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage onboarding" ON public.ut_partner_onboarding
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
