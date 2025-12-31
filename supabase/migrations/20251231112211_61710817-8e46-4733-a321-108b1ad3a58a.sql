-- Part 1: Update invoice_line_items table schema
ALTER TABLE invoice_line_items ADD COLUMN brand_id uuid REFERENCES brands(id);
ALTER TABLE invoice_line_items ADD COLUMN product_id uuid REFERENCES products(id);
ALTER TABLE invoice_line_items RENAME COLUMN brand TO brand_name;
ALTER TABLE invoice_line_items RENAME COLUMN line_total TO total;
ALTER TABLE invoice_line_items ALTER COLUMN product_name DROP NOT NULL;

-- Part 2: Create sync function and trigger for stores -> store_master
CREATE OR REPLACE FUNCTION sync_store_to_store_master()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_stores_trigger
AFTER INSERT ON stores
FOR EACH ROW
EXECUTE FUNCTION sync_store_to_store_master();

-- Part 3: Backfill existing stores into store_master with COALESCE for null values
INSERT INTO store_master (id, store_name, address, city, state, zip)
SELECT id, name, COALESCE(address_street, ''), COALESCE(address_city, ''), COALESCE(address_state, ''), COALESCE(address_zip, '')
FROM stores
ON CONFLICT (id) DO NOTHING;