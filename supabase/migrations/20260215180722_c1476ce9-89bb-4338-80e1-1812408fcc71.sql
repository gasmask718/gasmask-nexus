
-- Add identity & contact fields per Influencer Profile Upgrade spec
ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/New_York';

-- Add operational metadata fields
ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS onboarding_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_method_on_file boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_form_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS preferred_contact_method text DEFAULT 'sms';

-- Add constraint for onboarding_status
ALTER TABLE public.influencers
  ADD CONSTRAINT chk_onboarding_status CHECK (onboarding_status IN ('pending', 'verified', 'approved'));

-- Add constraint for tax_form_status  
ALTER TABLE public.influencers
  ADD CONSTRAINT chk_tax_form_status CHECK (tax_form_status IN ('not_required', 'pending', 'completed'));

-- Add constraint for preferred_contact_method
ALTER TABLE public.influencers
  ADD CONSTRAINT chk_preferred_contact_method CHECK (preferred_contact_method IN ('sms', 'call', 'email'));
