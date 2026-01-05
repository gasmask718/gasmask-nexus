-- =====================================================
-- Add is_simulation column to stores table
-- This migration adds the is_simulation flag to the stores table
-- to separate live and simulation data
-- =====================================================

-- 1. Add is_simulation column to stores table (if it doesn't exist)
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS is_simulation BOOLEAN DEFAULT false;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_stores_is_simulation 
ON public.stores(is_simulation);

-- 2. Update the sync function to copy is_simulation from stores to store_master
-- Preserve SECURITY DEFINER and search_path from existing function
CREATE OR REPLACE FUNCTION sync_store_to_store_master()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_mode BOOLEAN;
BEGIN
  -- Get current simulation mode from system_settings
  SELECT (setting_value->>'mode')::TEXT = 'simulation' INTO current_mode
  FROM system_settings
  WHERE setting_key = 'simulation_mode'
  LIMIT 1;
  
  -- Default to false (live) if not set
  current_mode := COALESCE(current_mode, false);
  
  -- Use is_simulation from stores table if it exists, otherwise use current mode
  INSERT INTO store_master (id, store_name, address, city, state, zip, is_simulation)
  VALUES (
    NEW.id,
    NEW.name,
    COALESCE(NEW.address_street, ''),
    COALESCE(NEW.address_city, ''),
    COALESCE(NEW.address_state, ''),
    COALESCE(NEW.address_zip, ''),
    COALESCE(NEW.is_simulation, current_mode) -- Use store's is_simulation or current mode
  )
  ON CONFLICT (id) 
  DO UPDATE SET
    store_name = EXCLUDED.store_name,
    address = EXCLUDED.address,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    zip = EXCLUDED.zip,
    is_simulation = COALESCE(EXCLUDED.is_simulation, store_master.is_simulation); -- Update is_simulation if provided
  
  RETURN NEW;
END;
$$;

-- Note: The trigger already exists from previous migration, so we don't need to recreate it
-- The function update above will automatically apply to the existing trigger

-- 3. Backfill is_simulation for existing stores based on store_master
-- This ensures existing stores match their store_master records
UPDATE public.stores s
SET is_simulation = COALESCE(sm.is_simulation, false)
FROM public.store_master sm
WHERE s.id = sm.id
AND (s.is_simulation IS NULL OR s.is_simulation = false);

-- For stores without store_master records, set based on current mode
DO $$
DECLARE
  current_mode BOOLEAN;
BEGIN
  SELECT (setting_value->>'mode')::TEXT = 'simulation' INTO current_mode
  FROM system_settings
  WHERE setting_key = 'simulation_mode'
  LIMIT 1;
  
  UPDATE public.stores
  SET is_simulation = COALESCE(current_mode, false)
  WHERE is_simulation IS NULL
  AND id NOT IN (SELECT id FROM public.store_master);
END $$;

