
ALTER TABLE public.messaging_campaigns
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'twilio';

ALTER TABLE public.messaging_targets
  ADD COLUMN IF NOT EXISTS contact_type text,
  ADD COLUMN IF NOT EXISTS contact_id text;
