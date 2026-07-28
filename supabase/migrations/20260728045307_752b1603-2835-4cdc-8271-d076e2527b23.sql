ALTER TABLE public.communication_logs
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS error_code text,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS cost_amount numeric,
  ADD COLUMN IF NOT EXISTS media_urls jsonb,
  ADD COLUMN IF NOT EXISTS metadata jsonb,
  ADD COLUMN IF NOT EXISTS campaign_id uuid,
  ADD COLUMN IF NOT EXISTS message_hash text,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS linked_entity_type text,
  ADD COLUMN IF NOT EXISTS linked_entity_id uuid,
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS next_action text;

CREATE UNIQUE INDEX IF NOT EXISTS communication_logs_idempotency_key_uidx
  ON public.communication_logs (idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS communication_logs_twilio_sid_uidx
  ON public.communication_logs (twilio_sid) WHERE twilio_sid IS NOT NULL;

CREATE INDEX IF NOT EXISTS communication_logs_store_created_idx
  ON public.communication_logs (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS communication_logs_contact_created_idx
  ON public.communication_logs (contact_id, created_at DESC);