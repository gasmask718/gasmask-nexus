-- Add store_name column to territory_addresses
ALTER TABLE territory_addresses ADD COLUMN IF NOT EXISTS store_name TEXT;

-- Backfill OSM records: extract name between "OSM: " and " |" or " ["
UPDATE territory_addresses
SET store_name = TRIM(
  CASE
    WHEN notes LIKE 'OSM: %' THEN
      CASE
        WHEN POSITION(' | ' IN SUBSTRING(notes FROM 5)) > 0 THEN SUBSTRING(notes FROM 5 FOR POSITION(' | ' IN SUBSTRING(notes FROM 5)) - 1)
        WHEN POSITION(' [' IN SUBSTRING(notes FROM 5)) > 0 THEN SUBSTRING(notes FROM 5 FOR POSITION(' [' IN SUBSTRING(notes FROM 5)) - 1)
        ELSE SUBSTRING(notes FROM 5)
      END
    ELSE NULL
  END
)
WHERE discovered_by = 'openstreetmap' AND store_name IS NULL AND notes LIKE 'OSM: %';

-- Backfill Yelp edge function records: extract name between "Yelp: " and " |"
UPDATE territory_addresses
SET store_name = TRIM(
  CASE
    WHEN notes LIKE 'Yelp: %' THEN
      CASE
        WHEN POSITION(' | ' IN SUBSTRING(notes FROM 7)) > 0 THEN SUBSTRING(notes FROM 7 FOR POSITION(' | ' IN SUBSTRING(notes FROM 7)) - 1)
        ELSE SUBSTRING(notes FROM 7)
      END
    ELSE NULL
  END
)
WHERE discovered_by = 'yelp' AND store_name IS NULL AND notes LIKE 'Yelp: %';

-- Backfill Yelp client-side records (no "Yelp: " prefix, name before first " | ")
UPDATE territory_addresses
SET store_name = TRIM(
  CASE
    WHEN POSITION(' | ' IN notes) > 0 THEN SUBSTRING(notes FROM 1 FOR POSITION(' | ' IN notes) - 1)
    ELSE NULL
  END
)
WHERE discovered_by = 'yelp' AND store_name IS NULL AND notes NOT LIKE 'Yelp: %' AND notes IS NOT NULL;