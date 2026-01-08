-- Fix valid_tube_brands constraint to include Hot Scolatti Light and Dark variants

-- Drop the existing constraint
ALTER TABLE public.store_tube_inventory 
DROP CONSTRAINT IF EXISTS valid_tube_brands;

-- Create new constraint with Hot Scolatti Light and Dark variants
ALTER TABLE public.store_tube_inventory 
ADD CONSTRAINT valid_tube_brands 
CHECK (brand = ANY (ARRAY[
  'gasmask',
  'gasmasktubes', 
  'hotmama',
  'grabba',
  'hotscolatti',
  'hotscolatti-light',
  'hotscolatti-dark'
]));