ALTER TABLE public.crm_partners
  ADD COLUMN IF NOT EXISTS tt_acquisition_stage text NOT NULL DEFAULT 'prospect',
  ADD COLUMN IF NOT EXISTS tt_last_call_at timestamptz,
  ADD COLUMN IF NOT EXISTS tt_last_disposition text,
  ADD COLUMN IF NOT EXISTS tt_call_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tt_callback_at timestamptz,
  ADD COLUMN IF NOT EXISTS tt_acquisition_notes text,
  ADD COLUMN IF NOT EXISTS phone_invalid boolean NOT NULL DEFAULT false;

ALTER TABLE public.crm_partners
  DROP CONSTRAINT IF EXISTS crm_partners_tt_acquisition_stage_chk;

ALTER TABLE public.crm_partners
  ADD CONSTRAINT crm_partners_tt_acquisition_stage_chk
  CHECK (tt_acquisition_stage IN (
    'prospect','queued','attempted','pending_vetting','info_requested',
    'wrong_vertical','existing_partner','activated','dnc',
    'manual_onboarding_required','vetting_rejected'
  ));

CREATE INDEX IF NOT EXISTS idx_crm_partners_tt_stage_slug
  ON public.crm_partners(tt_acquisition_stage)
  WHERE business_slug = 'toptier-experience';