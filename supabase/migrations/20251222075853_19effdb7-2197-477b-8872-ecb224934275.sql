-- Add sticker tracking columns to stores table
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS sticker_last_seen_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sticker_taken_down BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sticker_taken_down_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sticker_door BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sticker_instore BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sticker_phone BOOLEAN DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.stores.sticker_last_seen_at IS 'Last time sticker was confirmed visible';
COMMENT ON COLUMN public.stores.sticker_taken_down IS 'Whether sticker was taken down';
COMMENT ON COLUMN public.stores.sticker_taken_down_at IS 'When sticker was taken down';
COMMENT ON COLUMN public.stores.sticker_door IS 'Door sticker present';
COMMENT ON COLUMN public.stores.sticker_instore IS 'In-store sticker present';
COMMENT ON COLUMN public.stores.sticker_phone IS 'Phone sticker present';