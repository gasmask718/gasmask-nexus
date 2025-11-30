-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 44: WAREHOUSE BRAIN & GLOBAL LOGISTICS SYSTEM (Complete)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Warehouses table
CREATE TABLE public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  type TEXT DEFAULT 'central',
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT DEFAULT 'USA',
  contact_phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Warehouse zones
CREATE TABLE public.warehouse_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Warehouse bins
CREATE TABLE public.warehouse_bins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES public.warehouse_zones(id) ON DELETE SET NULL,
  bin_code TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Inventory stock ledger
CREATE TABLE public.inventory_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE CASCADE,
  bin_id UUID REFERENCES public.warehouse_bins(id) ON DELETE SET NULL,
  owner_type TEXT DEFAULT 'company',
  owner_id UUID,
  quantity_on_hand INTEGER DEFAULT 0,
  quantity_reserved INTEGER DEFAULT 0,
  quantity_in_transit INTEGER DEFAULT 0,
  reorder_point INTEGER,
  reorder_target INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add columns to existing inventory_movements
ALTER TABLE public.inventory_movements 
ADD COLUMN IF NOT EXISTS from_warehouse_id UUID,
ADD COLUMN IF NOT EXISTS from_bin_id UUID,
ADD COLUMN IF NOT EXISTS to_warehouse_id UUID,
ADD COLUMN IF NOT EXISTS to_bin_id UUID,
ADD COLUMN IF NOT EXISTS movement_type TEXT,
ADD COLUMN IF NOT EXISTS reference_type TEXT,
ADD COLUMN IF NOT EXISTS reference_id TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID;

-- Purchase order items
CREATE TABLE public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID,
  quantity_ordered INTEGER NOT NULL DEFAULT 0,
  quantity_received INTEGER DEFAULT 0,
  unit_cost NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Extend order_routing with warehouse/logistics fields
ALTER TABLE public.order_routing 
ADD COLUMN IF NOT EXISTS warehouse_id UUID,
ADD COLUMN IF NOT EXISTS assigned_driver_id UUID,
ADD COLUMN IF NOT EXISTS assigned_biker_id UUID,
ADD COLUMN IF NOT EXISTS fulfillment_type TEXT DEFAULT 'ship_by_wholesaler',
ADD COLUMN IF NOT EXISTS delivery_date TIMESTAMPTZ;

-- Extend shipping_labels with warehouse fields
ALTER TABLE public.shipping_labels
ADD COLUMN IF NOT EXISTS carrier TEXT,
ADD COLUMN IF NOT EXISTS ship_from_type TEXT,
ADD COLUMN IF NOT EXISTS ship_from_id UUID,
ADD COLUMN IF NOT EXISTS ship_to_name TEXT,
ADD COLUMN IF NOT EXISTS ship_to_address TEXT,
ADD COLUMN IF NOT EXISTS ship_to_city TEXT,
ADD COLUMN IF NOT EXISTS ship_to_state TEXT,
ADD COLUMN IF NOT EXISTS ship_to_zip TEXT,
ADD COLUMN IF NOT EXISTS ship_to_country TEXT;

-- Indexes
CREATE INDEX idx_inventory_stock_product ON public.inventory_stock(product_id);
CREATE INDEX idx_inventory_stock_warehouse ON public.inventory_stock(warehouse_id);

-- Enable RLS
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_bins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies (admin only)
CREATE POLICY "Admin access warehouses" ON public.warehouses
  FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin access warehouse_zones" ON public.warehouse_zones
  FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin access warehouse_bins" ON public.warehouse_bins
  FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin access inventory_stock" ON public.inventory_stock
  FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin access purchase_order_items" ON public.purchase_order_items
  FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));