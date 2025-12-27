-- Normalize tube inventory brands to only valid values
-- Valid brands: gasmask, hotmama, hotscolatti

-- First, update all variant spellings to the correct ones
UPDATE store_tube_inventory SET brand = 'gasmask' WHERE brand ILIKE 'gasmask%' OR brand ILIKE 'gas%mask%';
UPDATE store_tube_inventory SET brand = 'hotmama' WHERE brand ILIKE 'hotmama%' OR brand ILIKE 'hot%mama%';
UPDATE store_tube_inventory SET brand = 'hotscolatti' WHERE brand IN ('scalati', 'hot scalati', 'Hot Scalati', 'hotscolati', 'hot_scalati', 'HotScolati', 'Hot Scolatti', 'hotscolatti');

-- Delete invalid brands that don't belong (fronto, grabba_r_us, etc.)
DELETE FROM store_tube_inventory WHERE brand NOT IN ('gasmask', 'hotmama', 'hotscolatti');

-- Add a check constraint to enforce valid brands going forward
ALTER TABLE store_tube_inventory DROP CONSTRAINT IF EXISTS valid_tube_brands;
ALTER TABLE store_tube_inventory ADD CONSTRAINT valid_tube_brands 
  CHECK (brand IN ('gasmask', 'hotmama', 'hotscolatti'));