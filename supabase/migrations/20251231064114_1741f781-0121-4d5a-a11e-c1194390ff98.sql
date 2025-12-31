-- Drop existing constraint that only allows 3 brands
ALTER TABLE store_tube_inventory 
DROP CONSTRAINT IF EXISTS valid_tube_brands;

-- Create new constraint with all 5 brands
ALTER TABLE store_tube_inventory 
ADD CONSTRAINT valid_tube_brands 
CHECK (brand = ANY (ARRAY[
  'gasmask', 
  'gasmasktubes', 
  'hotmama', 
  'grabba', 
  'hotscolatti'
]));