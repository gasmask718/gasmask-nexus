-- Door sticker tracking columns
ALTER TABLE stores ADD COLUMN IF NOT EXISTS sticker_door_put_on_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS sticker_door_last_seen_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS sticker_door_taken_down_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS sticker_door_note TEXT;

-- In-store sticker tracking columns
ALTER TABLE stores ADD COLUMN IF NOT EXISTS sticker_instore_put_on_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS sticker_instore_last_seen_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS sticker_instore_taken_down_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS sticker_instore_note TEXT;

-- Phone sticker tracking columns
ALTER TABLE stores ADD COLUMN IF NOT EXISTS sticker_phone_put_on_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS sticker_phone_last_seen_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS sticker_phone_taken_down_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS sticker_phone_note TEXT;