
-- Add place_id and website columns
ALTER TABLE territory_addresses ADD COLUMN IF NOT EXISTS place_id text;
ALTER TABLE territory_addresses ADD COLUMN IF NOT EXISTS website text;

-- Create index on place_id for duplicate detection
CREATE INDEX IF NOT EXISTS idx_territory_addresses_place_id ON territory_addresses(place_id);

-- Update discovered_by CHECK constraint to allow 'google_places' and 'openstreetmap'
ALTER TABLE territory_addresses DROP CONSTRAINT IF EXISTS territory_addresses_discovered_by_check;
ALTER TABLE territory_addresses ADD CONSTRAINT territory_addresses_discovered_by_check 
  CHECK (discovered_by = ANY (ARRAY['ai','human','import','yelp','google_places','openstreetmap']));
