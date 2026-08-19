ALTER TABLE public.brandaro_pending_messages ADD COLUMN IF NOT EXISTS campaign_id uuid;

UPDATE public.brandaro_pending_messages
SET campaign_id = md5('brandaro-pending|' || coalesce(ai_agent,'unknown') || '|' || coalesce(created_at,now())::date::text)::uuid
WHERE campaign_id IS NULL;

CREATE INDEX IF NOT EXISTS brandaro_pending_messages_status_campaign_idx
  ON public.brandaro_pending_messages (status, campaign_id);