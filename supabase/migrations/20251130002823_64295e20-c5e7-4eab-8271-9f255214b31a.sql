-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 43: WHOLESALER PROCUREMENT CENTER
-- ═══════════════════════════════════════════════════════════════════════════════

-- Suppliers table
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  wechat TEXT,
  notes TEXT,
  reliability_score NUMERIC DEFAULT 0,
  lead_time_days INTEGER DEFAULT 14,
  shipping_methods JSONB DEFAULT '[]'::jsonb,
  payment_terms TEXT,
  status TEXT DEFAULT 'active',
  total_spend NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supplier Products table
CREATE TABLE IF NOT EXISTS public.supplier_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  moq INTEGER DEFAULT 1,
  unit_cost NUMERIC DEFAULT 0,
  bulk_cost NUMERIC,
  shipping_weight NUMERIC,
  shipping_dimensions JSONB,
  processing_time_days INTEGER DEFAULT 3,
  product_photos TEXT[] DEFAULT '{}',
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Purchase Orders table
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID REFERENCES public.suppliers(id),
  products JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_cost NUMERIC DEFAULT 0,
  shipping_cost NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'draft',
  estimated_arrival TIMESTAMPTZ,
  tracking_number TEXT,
  warehouse_location TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supply Chain Inflow (receiving)
CREATE TABLE IF NOT EXISTS public.supply_chain_inflow (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  units_in INTEGER DEFAULT 0,
  cost_per_unit NUMERIC DEFAULT 0,
  receiving_notes TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Restock Forecast
CREATE TABLE IF NOT EXISTS public.restock_forecast (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_name TEXT NOT NULL,
  product_id UUID,
  current_units INTEGER DEFAULT 0,
  daily_sales_rate NUMERIC DEFAULT 0,
  projected_out_date TIMESTAMPTZ,
  recommended_reorder_units INTEGER DEFAULT 0,
  priority TEXT DEFAULT 'normal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_chain_inflow ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restock_forecast ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Admin only)
CREATE POLICY "Admin access suppliers" ON public.suppliers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Admin access supplier_products" ON public.supplier_products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Admin access purchase_orders" ON public.purchase_orders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Admin access supply_chain_inflow" ON public.supply_chain_inflow
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Admin access restock_forecast" ON public.restock_forecast
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier ON public.supplier_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_supply_chain_inflow_po ON public.supply_chain_inflow(po_id);
CREATE INDEX IF NOT EXISTS idx_restock_forecast_priority ON public.restock_forecast(priority);