
CREATE TABLE IF NOT EXISTS public.sbo_telegram_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL,
  channel_name TEXT,
  channel_username TEXT,
  capper_name TEXT,
  message_id TEXT NOT NULL,
  message_text TEXT,
  image_url TEXT,
  has_media BOOLEAN NOT NULL DEFAULT false,
  edited BOOLEAN NOT NULL DEFAULT false,
  deleted BOOLEAN NOT NULL DEFAULT false,
  posted_at TIMESTAMPTZ,
  processing_status TEXT NOT NULL DEFAULT 'received',
  dispatched_to TEXT,
  dispatch_error TEXT,
  raw_payload JSONB,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sbo_telegram_posts_channel_msg_unique UNIQUE (channel_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_sbo_telegram_posts_capper ON public.sbo_telegram_posts (capper_name);
CREATE INDEX IF NOT EXISTS idx_sbo_telegram_posts_posted_at ON public.sbo_telegram_posts (posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_sbo_telegram_posts_status ON public.sbo_telegram_posts (processing_status);

GRANT SELECT ON public.sbo_telegram_posts TO authenticated;
GRANT ALL ON public.sbo_telegram_posts TO service_role;

ALTER TABLE public.sbo_telegram_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read telegram posts"
  ON public.sbo_telegram_posts FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Service role manages telegram posts"
  ON public.sbo_telegram_posts FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.sbo_telegram_posts_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_sbo_telegram_posts_updated_at ON public.sbo_telegram_posts;
CREATE TRIGGER trg_sbo_telegram_posts_updated_at
  BEFORE UPDATE ON public.sbo_telegram_posts
  FOR EACH ROW EXECUTE FUNCTION public.sbo_telegram_posts_touch_updated_at();
