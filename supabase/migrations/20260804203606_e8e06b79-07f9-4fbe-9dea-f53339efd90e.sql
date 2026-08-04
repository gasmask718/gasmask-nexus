ALTER TABLE public.sbo_capper_picks   ADD COLUMN IF NOT EXISTS source_message_id text;
ALTER TABLE public.sbo_telegram_posts ADD COLUMN IF NOT EXISTS content_hash      text;
CREATE INDEX IF NOT EXISTS idx_sbo_capper_picks_source_message_id
  ON public.sbo_capper_picks (source_message_id) WHERE source_message_id IS NOT NULL;