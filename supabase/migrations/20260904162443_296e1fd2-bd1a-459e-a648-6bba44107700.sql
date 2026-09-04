ALTER TABLE public.outbound_messages
  ADD COLUMN IF NOT EXISTS status_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

ALTER TABLE public.outbound_messages DROP CONSTRAINT IF EXISTS outbound_messages_status_check;
ALTER TABLE public.outbound_messages ADD CONSTRAINT outbound_messages_status_check
  CHECK (status = ANY (ARRAY['pending','queued','sent','delivered','undelivered','failed','blocked']));

CREATE INDEX IF NOT EXISTS outbound_messages_provider_message_id_idx
  ON public.outbound_messages (provider_message_id);