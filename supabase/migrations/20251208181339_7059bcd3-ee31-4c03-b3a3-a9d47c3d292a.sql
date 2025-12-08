-- Inventory Engine Floor 3 - Part 1: Products enhancements
ALTER TABLE products
ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES businesses(id),
ADD COLUMN IF NOT EXISTS vertical_id uuid REFERENCES brand_verticals(id),
ADD COLUMN IF NOT EXISTS barcode text,
ADD COLUMN IF NOT EXISTS variant text,
ADD COLUMN IF NOT EXISTS cost numeric(10,2),
ADD COLUMN IF NOT EXISTS case_size integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS moq integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS reorder_point integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS reorder_qty integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS safety_stock integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS hero_score numeric(5,2),
ADD COLUMN IF NOT EXISTS ghost_score numeric(5,2),
ADD COLUMN IF NOT EXISTS image_url text,
ADD COLUMN IF NOT EXISTS description text;

-- Part 2: Warehouses enhancements
ALTER TABLE warehouses
ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES businesses(id),
ADD COLUMN IF NOT EXISTS capacity integer,
ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/New_York';

-- Part 3: Warehouse bins
ALTER TABLE warehouse_bins
ADD COLUMN IF NOT EXISTS aisle text,
ADD COLUMN IF NOT EXISTS shelf text,
ADD COLUMN IF NOT EXISTS max_weight numeric;

-- Part 4: Inventory stock
ALTER TABLE inventory_stock
ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES businesses(id);

-- Part 5: Purchase orders
ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES businesses(id),
ADD COLUMN IF NOT EXISTS target_warehouse_id uuid REFERENCES warehouses(id);

-- Part 6: Create inventory alerts table
CREATE TABLE IF NOT EXISTS inventory_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid,
  alert_warehouse_id uuid,
  business_id uuid,
  alert_type text NOT NULL,
  severity text DEFAULT 'warning',
  current_quantity integer,
  threshold integer,
  message text,
  is_resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz DEFAULT now()
);

-- Part 7: Create inventory snapshots
CREATE TABLE IF NOT EXISTS inventory_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL,
  snapshot_warehouse_id uuid,
  business_id uuid,
  total_units integer DEFAULT 0,
  total_value numeric(12,2) DEFAULT 0,
  total_products integer DEFAULT 0,
  low_stock_count integer DEFAULT 0,
  out_of_stock_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Part 8: Enable RLS
ALTER TABLE inventory_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_snapshots ENABLE ROW LEVEL SECURITY;

-- Part 9: RLS policies
CREATE POLICY "authenticated_read_inventory_alerts" ON inventory_alerts
FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert_inventory_alerts" ON inventory_alerts
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated_update_inventory_alerts" ON inventory_alerts
FOR UPDATE TO authenticated USING (true);

CREATE POLICY "authenticated_read_inventory_snapshots" ON inventory_snapshots
FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert_inventory_snapshots" ON inventory_snapshots
FOR INSERT TO authenticated WITH CHECK (true);