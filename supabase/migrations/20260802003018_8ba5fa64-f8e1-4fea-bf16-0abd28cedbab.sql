ALTER TABLE public.brandaro_pending_messages
  DROP CONSTRAINT brandaro_pending_messages_status_check;

ALTER TABLE public.brandaro_pending_messages
  ADD CONSTRAINT brandaro_pending_messages_status_check
  CHECK (status IN ('pending','approved','sent','rejected','edited','failed'));