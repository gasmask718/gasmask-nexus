
ALTER TABLE public.store_contacts
  ADD COLUMN IF NOT EXISTS number_verification_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS number_verification_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS number_verification_delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS number_verification_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS number_verification_failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS number_verification_message_sid text,
  ADD COLUMN IF NOT EXISTS number_verification_sent_by uuid,
  ADD COLUMN IF NOT EXISTS number_verification_error text;

ALTER TABLE public.store_contacts
  DROP CONSTRAINT IF EXISTS store_contacts_number_verification_status_check;

ALTER TABLE public.store_contacts
  ADD CONSTRAINT store_contacts_number_verification_status_check
  CHECK (number_verification_status IN ('unverified','sent','delivered','confirmed','failed'));

CREATE INDEX IF NOT EXISTS idx_store_contacts_verif_sid
  ON public.store_contacts (number_verification_message_sid)
  WHERE number_verification_message_sid IS NOT NULL;
