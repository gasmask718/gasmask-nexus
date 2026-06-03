-- Fix ON CONFLICT bug in bland-agent-webhook's logEvent helper.
-- The upsert targets dedupe_key but no unique constraint existed,
-- causing "no unique or exclusion constraint matching the ON CONFLICT specification".
CREATE UNIQUE INDEX IF NOT EXISTS dialer_call_events_dedupe_key_uidx
  ON public.dialer_call_events (dedupe_key)
  WHERE dedupe_key IS NOT NULL;