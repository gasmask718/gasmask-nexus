-- ═══════════════════════════════════════════════════════════════════════════════
-- FLOOR 3 PHASE 1: Core Inventory Infrastructure
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1) Store Inventory table (track products at store level by full address)
CREATE TABLE IF NOT EXISTS public.store_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.store_master(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity_on_hand INTEGER DEFAULT 0 CHECK (quantity_on_hand >= 0),
  quantity_reserved INTEGER DEFAULT 0 CHECK (quantity_reserved >= 0),
  reorder_point INTEGER DEFAULT 0,
  last_restock_date TIMESTAMPTZ,
  last_sale_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, product_id)
);

-- Indexes for store inventory
CREATE INDEX IF NOT EXISTS idx_store_inventory_store ON public.store_inventory(store_id);
CREATE INDEX IF NOT EXISTS idx_store_inventory_product ON public.store_inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_store_inventory_low_stock ON public.store_inventory(quantity_on_hand) 
  WHERE quantity_on_hand <= reorder_point;

-- 2) Inventory Audit Log table (track all changes with old/new values)
CREATE TABLE IF NOT EXISTS public.inventory_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id UUID REFERENCES public.inventory_stock(id) ON DELETE SET NULL,
  store_inventory_id UUID REFERENCES public.store_inventory(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  store_id UUID REFERENCES public.store_master(id) ON DELETE SET NULL,
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  quantity_delta INTEGER,
  change_reason TEXT,
  changed_by UUID,
  changed_by_system BOOLEAN DEFAULT false,
  reference_type TEXT, -- 'purchase_order', 'manual', 'sale', 'adjustment', 'transfer'
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for audit log
CREATE INDEX IF NOT EXISTS idx_audit_log_product ON public.inventory_audit_log(product_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_warehouse ON public.inventory_audit_log(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_store ON public.inventory_audit_log(store_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_date ON public.inventory_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_reference ON public.inventory_audit_log(reference_type, reference_id);

-- 3) Enable RLS on new tables
ALTER TABLE public.store_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_audit_log ENABLE ROW LEVEL SECURITY;

-- 4) RLS Policies for store_inventory
CREATE POLICY "Allow authenticated read store_inventory"
  ON public.store_inventory FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert store_inventory"
  ON public.store_inventory FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update store_inventory"
  ON public.store_inventory FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated delete store_inventory"
  ON public.store_inventory FOR DELETE
  TO authenticated
  USING (true);

-- 5) RLS Policies for inventory_audit_log (read-only for most, insert for system)
CREATE POLICY "Allow authenticated read audit_log"
  ON public.inventory_audit_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert audit_log"
  ON public.inventory_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 6) Update trigger for store_inventory
CREATE OR REPLACE FUNCTION public.update_store_inventory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_store_inventory_updated
  BEFORE UPDATE ON public.store_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.update_store_inventory_timestamp();

-- 7) Add computed full_address to store_master view helper
CREATE OR REPLACE FUNCTION public.get_store_full_address(p_store_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_address TEXT;
BEGIN
  SELECT CONCAT(address, ', ', city, ', ', state, ' ', zip)
  INTO v_address
  FROM public.store_master
  WHERE id = p_store_id;
  
  RETURN v_address;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;