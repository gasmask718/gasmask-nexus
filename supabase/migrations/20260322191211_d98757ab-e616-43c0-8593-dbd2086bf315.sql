ALTER TABLE sbo_player_props ADD COLUMN IF NOT EXISTS player_image_url text;
ALTER TABLE sbo_player_props ADD COLUMN IF NOT EXISTS player_image_cached boolean DEFAULT false;
ALTER TABLE sbo_player_props ADD COLUMN IF NOT EXISTS player_image_cached_at timestamptz;