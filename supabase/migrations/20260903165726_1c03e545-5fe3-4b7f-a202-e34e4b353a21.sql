ALTER TABLE public.icw_candidate_leads
  ADD COLUMN IF NOT EXISTS source_posted_at timestamptz,
  ADD COLUMN IF NOT EXISTS independent_signal text,
  ADD COLUMN IF NOT EXISTS independent_signal_source text,
  ADD COLUMN IF NOT EXISTS owns_supplies boolean,
  ADD COLUMN IF NOT EXISTS owns_supplies_source text,
  ADD COLUMN IF NOT EXISTS contact_method text;

ALTER TABLE public.icw_candidate_leads
  ADD CONSTRAINT icw_candidate_leads_independent_signal_check
  CHECK (independent_signal IN ('explicit_yes','explicit_no'));

ALTER TABLE public.icw_candidate_leads
  ADD CONSTRAINT icw_candidate_leads_contact_method_check
  CHECK (contact_method IN ('platform_relay','public_phone','public_email'));

UPDATE public.icw_candidate_leads
SET status = 'candidate'
WHERE status IS NULL
   OR status NOT IN ('candidate','reviewing','contacted','qualified','converted','rejected');

ALTER TABLE public.icw_candidate_leads
  ADD CONSTRAINT icw_candidate_leads_status_check
  CHECK (status IN ('candidate','reviewing','contacted','qualified','converted','rejected'));