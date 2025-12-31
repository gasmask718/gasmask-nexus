-- Fix search_path for sync function
CREATE OR REPLACE FUNCTION sync_store_to_store_master()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO store_master (id, store_name, address, city, state, zip)
  VALUES (
    NEW.id,
    NEW.name,
    COALESCE(NEW.address_street, ''),
    COALESCE(NEW.address_city, ''),
    COALESCE(NEW.address_state, ''),
    COALESCE(NEW.address_zip, '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;