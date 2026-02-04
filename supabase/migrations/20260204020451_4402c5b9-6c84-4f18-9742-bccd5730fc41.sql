
-- =========================================================
-- PRODUCTS SOFT DELETE + PROFIT PER BOX SYSTEM
-- =========================================================

-- PART A: Products Soft Delete
-- Add soft delete columns to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS deleted_by uuid NULL;

-- Create index for efficient filtering of non-deleted products
CREATE INDEX IF NOT EXISTS idx_products_is_deleted ON public.products(is_deleted) WHERE is_deleted = false;

-- PART B: Profit Per Box - Store Order Items Snapshot Pricing
-- Add cost and profit snapshot columns to store_order_items
ALTER TABLE public.store_order_items
ADD COLUMN IF NOT EXISTS cost_per_unit_snapshot numeric(10,2) NULL,
ADD COLUMN IF NOT EXISTS units_per_box_snapshot integer NULL,
ADD COLUMN IF NOT EXISTS cost_per_box_snapshot numeric(10,2) NULL,
ADD COLUMN IF NOT EXISTS profit_per_box_snapshot numeric(10,2) NULL,
ADD COLUMN IF NOT EXISTS margin_percent_snapshot numeric(5,2) NULL,
ADD COLUMN IF NOT EXISTS revenue_total numeric(10,2) NULL,
ADD COLUMN IF NOT EXISTS cogs_total numeric(10,2) NULL,
ADD COLUMN IF NOT EXISTS profit_total numeric(10,2) NULL;

-- Create a function to compute profit on order item insert
CREATE OR REPLACE FUNCTION compute_order_item_profit()
RETURNS TRIGGER AS $$
DECLARE
  v_cost_per_unit numeric;
  v_units_per_box integer;
  v_cost_per_box numeric;
  v_sell_price_per_box numeric;
  v_profit_per_box numeric;
  v_margin_percent numeric;
  v_revenue_total numeric;
  v_cogs_total numeric;
  v_profit_total numeric;
BEGIN
  -- Fetch product cost data for snapshot
  SELECT 
    COALESCE(cost, 0),
    COALESCE(units_per_box, 1)
  INTO v_cost_per_unit, v_units_per_box
  FROM products
  WHERE id = NEW.product_id;
  
  -- Calculate derived values
  v_cost_per_box := v_cost_per_unit * v_units_per_box;
  v_sell_price_per_box := NEW.unit_price; -- unit_price in store_order_items is already per-box/unit
  
  -- For box-based sales, unit_price = price per box
  v_profit_per_box := v_sell_price_per_box - v_cost_per_box;
  
  -- Calculate margin (handle divide by zero)
  IF v_sell_price_per_box > 0 THEN
    v_margin_percent := ROUND((v_profit_per_box / v_sell_price_per_box) * 100, 2);
  ELSE
    v_margin_percent := 0;
  END IF;
  
  -- Calculate totals
  v_revenue_total := NEW.total_price;
  v_cogs_total := v_cost_per_box * NEW.quantity;
  v_profit_total := v_revenue_total - v_cogs_total;
  
  -- Set snapshot values
  NEW.cost_per_unit_snapshot := v_cost_per_unit;
  NEW.units_per_box_snapshot := v_units_per_box;
  NEW.cost_per_box_snapshot := v_cost_per_box;
  NEW.profit_per_box_snapshot := v_profit_per_box;
  NEW.margin_percent_snapshot := v_margin_percent;
  NEW.revenue_total := v_revenue_total;
  NEW.cogs_total := v_cogs_total;
  NEW.profit_total := v_profit_total;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-compute profit on insert
DROP TRIGGER IF EXISTS trigger_compute_order_item_profit ON store_order_items;
CREATE TRIGGER trigger_compute_order_item_profit
  BEFORE INSERT ON store_order_items
  FOR EACH ROW
  EXECUTE FUNCTION compute_order_item_profit();

-- Create aggregated view for order-level profit
CREATE OR REPLACE VIEW v_store_orders_with_profit AS
SELECT 
  so.*,
  COALESCE(SUM(soi.revenue_total), 0) as total_revenue,
  COALESCE(SUM(soi.cogs_total), 0) as total_cogs,
  COALESCE(SUM(soi.profit_total), 0) as total_profit,
  CASE 
    WHEN SUM(soi.revenue_total) > 0 
    THEN ROUND((SUM(soi.profit_total) / SUM(soi.revenue_total)) * 100, 2)
    ELSE 0
  END as overall_margin_percent,
  s.store_name,
  s.address,
  s.city
FROM store_orders so
LEFT JOIN store_order_items soi ON soi.order_id = so.id
LEFT JOIN store_master s ON s.id = so.store_id
GROUP BY so.id, s.store_name, s.address, s.city;

-- Create product profit summary view
CREATE OR REPLACE VIEW v_product_profit_summary AS
SELECT 
  p.id as product_id,
  p.name as product_name,
  p.brand_id,
  b.name as brand_name,
  p.cost as cost_per_unit,
  p.units_per_box,
  COALESCE(p.cost, 0) * COALESCE(p.units_per_box, 1) as cost_per_box,
  p.wholesale_price,
  COUNT(DISTINCT soi.order_id) as total_orders,
  COALESCE(SUM(soi.quantity), 0) as total_units_sold,
  COALESCE(SUM(soi.revenue_total), 0) as total_revenue,
  COALESCE(SUM(soi.cogs_total), 0) as total_cogs,
  COALESCE(SUM(soi.profit_total), 0) as total_profit,
  CASE 
    WHEN SUM(soi.revenue_total) > 0 
    THEN ROUND((SUM(soi.profit_total) / SUM(soi.revenue_total)) * 100, 2)
    ELSE 0
  END as margin_percent
FROM products p
LEFT JOIN brands b ON b.id = p.brand_id
LEFT JOIN store_order_items soi ON soi.product_id = p.id
WHERE p.is_deleted = false
GROUP BY p.id, p.name, p.brand_id, b.name, p.cost, p.units_per_box, p.wholesale_price;

-- Log product deletion to admin audit log
CREATE OR REPLACE FUNCTION log_product_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_deleted = true AND OLD.is_deleted = false THEN
    INSERT INTO admin_audit_log (
      actor_user_id,
      action,
      target_type,
      target_id,
      before,
      after
    ) VALUES (
      NEW.deleted_by,
      'product_deleted',
      'product',
      NEW.id,
      jsonb_build_object('name', OLD.name, 'sku', OLD.sku, 'is_active', OLD.is_active),
      jsonb_build_object('is_deleted', true, 'deleted_at', NEW.deleted_at)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_product_deletion ON products;
CREATE TRIGGER trigger_log_product_deletion
  AFTER UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION log_product_deletion();
