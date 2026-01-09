-- Fix sync_store_to_store_master to properly copy is_simulation from stores to store_master
CREATE OR REPLACE FUNCTION sync_store_to_store_master()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mapped_type store_type;
BEGIN
  -- Map store_type to valid enum values
  mapped_type := CASE LOWER(COALESCE(NEW.type::text, 'other'))
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

  -- Insert into store_master, copying is_simulation from stores
  INSERT INTO store_master (id, store_name, address, city, state, zip, is_simulation)
  VALUES (
    NEW.id,
    NEW.name,
    COALESCE(NEW.address_street, ''),
    COALESCE(NEW.address_city, ''),
    COALESCE(NEW.address_state, ''),
    COALESCE(NEW.address_zip, ''),
    COALESCE(NEW.is_simulation, false)  -- Copy is_simulation from stores
  )
  ON CONFLICT (id) DO UPDATE SET
    store_name = EXCLUDED.store_name,
    address = EXCLUDED.address,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    zip = EXCLUDED.zip,
    is_simulation = EXCLUDED.is_simulation;  -- Also update is_simulation on conflict
  
  RETURN NEW;
END;
$$;

-- Fix existing mismatched records: sync is_simulation from stores to store_master
UPDATE store_master sm
SET is_simulation = s.is_simulation
FROM stores s
WHERE sm.id = s.id
AND sm.is_simulation != s.is_simulation;