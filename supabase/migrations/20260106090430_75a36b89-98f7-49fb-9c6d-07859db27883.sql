-- Create the reverse sync function with proper type mapping
CREATE OR REPLACE FUNCTION sync_store_master_to_stores()
RETURNS TRIGGER AS $$
DECLARE
  mapped_type store_type;
BEGIN
  -- Map store_type to valid enum values
  mapped_type := CASE LOWER(COALESCE(NEW.store_type, 'other'))
    WHEN 'bodega' THEN 'bodega'::store_type
    WHEN 'smoke_shop' THEN 'smoke_shop'::store_type
    WHEN 'smoke shop' THEN 'smoke_shop'::store_type
    WHEN 'tobacco shop' THEN 'smoke_shop'::store_type
    WHEN 'gas_station' THEN 'gas_station'::store_type
    WHEN 'gas station' THEN 'gas_station'::store_type
    WHEN 'wholesaler' THEN 'wholesaler'::store_type
    WHEN 'convenience store' THEN 'bodega'::store_type
    WHEN 'retail' THEN 'other'::store_type
    ELSE 'other'::store_type
  END;

  INSERT INTO stores (id, name, type, address_street, address_city, address_state, address_zip, is_simulation)
  VALUES (
    NEW.id,
    NEW.store_name,
    mapped_type,
    COALESCE(NEW.address, ''),
    COALESCE(NEW.city, ''),
    COALESCE(NEW.state, ''),
    COALESCE(NEW.zip, ''),
    COALESCE(NEW.is_simulation, false)
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    address_street = EXCLUDED.address_street,
    address_city = EXCLUDED.address_city,
    address_state = EXCLUDED.address_state,
    address_zip = EXCLUDED.address_zip,
    is_simulation = EXCLUDED.is_simulation;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on store_master
DROP TRIGGER IF EXISTS sync_store_master_to_stores_trigger ON public.store_master;
CREATE TRIGGER sync_store_master_to_stores_trigger
AFTER INSERT OR UPDATE ON public.store_master
FOR EACH ROW EXECUTE FUNCTION sync_store_master_to_stores();

-- Backfill missing stores with proper type mapping
INSERT INTO stores (id, name, type, address_street, address_city, address_state, address_zip, is_simulation)
SELECT 
  sm.id, 
  sm.store_name,
  CASE LOWER(COALESCE(sm.store_type, 'other'))
    WHEN 'bodega' THEN 'bodega'::store_type
    WHEN 'smoke_shop' THEN 'smoke_shop'::store_type
    WHEN 'smoke shop' THEN 'smoke_shop'::store_type
    WHEN 'tobacco shop' THEN 'smoke_shop'::store_type
    WHEN 'gas_station' THEN 'gas_station'::store_type
    WHEN 'gas station' THEN 'gas_station'::store_type
    WHEN 'wholesaler' THEN 'wholesaler'::store_type
    WHEN 'convenience store' THEN 'bodega'::store_type
    WHEN 'retail' THEN 'other'::store_type
    ELSE 'other'::store_type
  END,
  COALESCE(sm.address, ''),
  COALESCE(sm.city, ''),
  COALESCE(sm.state, ''),
  COALESCE(sm.zip, ''),
  COALESCE(sm.is_simulation, false)
FROM store_master sm
LEFT JOIN stores s ON sm.id = s.id
WHERE s.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Drop old permissive RLS policies on stores
DROP POLICY IF EXISTS "Anyone can view stores" ON public.stores;

-- Add simulation-aware RLS policies for stores
DROP POLICY IF EXISTS "stores_simulation_select" ON public.stores;
DROP POLICY IF EXISTS "stores_simulation_insert" ON public.stores;
DROP POLICY IF EXISTS "stores_simulation_update" ON public.stores;

CREATE POLICY "stores_simulation_select" ON public.stores
  FOR SELECT USING (is_simulation = is_simulation_mode());

CREATE POLICY "stores_simulation_insert" ON public.stores
  FOR INSERT WITH CHECK (is_simulation = is_simulation_mode());

CREATE POLICY "stores_simulation_update" ON public.stores
  FOR UPDATE USING (is_simulation = is_simulation_mode());