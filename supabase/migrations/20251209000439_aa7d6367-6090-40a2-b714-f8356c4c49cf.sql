-- Create inventory_forecasts table for demand forecasting and risk analysis
CREATE TABLE IF NOT EXISTS public.inventory_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  business_id uuid REFERENCES public.businesses(id),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE CASCADE,
  
  horizon_days integer NOT NULL DEFAULT 30,
  
  avg_daily_usage numeric(12,4),
  forecast_demand numeric(12,2),
  
  projected_runout_date date,
  days_until_runout integer,
  
  risk_level text,
  risk_reason text,
  
  suggestion text,
  
  metadata jsonb,
  
  calculated_at timestamptz DEFAULT now()
);

-- Create indexes for inventory_forecasts
CREATE INDEX IF NOT EXISTS idx_inventory_forecasts_product_warehouse 
  ON public.inventory_forecasts(product_id, warehouse_id);

CREATE INDEX IF NOT EXISTS idx_inventory_forecasts_business 
  ON public.inventory_forecasts(business_id);

CREATE INDEX IF NOT EXISTS idx_inventory_forecasts_risk_level 
  ON public.inventory_forecasts(risk_level);

-- Create inventory_risk_flags table for dead stock, overstock, anomalies
CREATE TABLE IF NOT EXISTS public.inventory_risk_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  business_id uuid REFERENCES public.businesses(id),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE CASCADE,
  
  flag_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  
  message text NOT NULL,
  days_without_movement integer,
  last_movement_at timestamptz,
  
  created_at timestamptz DEFAULT now()
);

-- Create indexes for inventory_risk_flags
CREATE INDEX IF NOT EXISTS idx_inventory_risk_flags_product_warehouse 
  ON public.inventory_risk_flags(product_id, warehouse_id);

CREATE INDEX IF NOT EXISTS idx_inventory_risk_flags_business 
  ON public.inventory_risk_flags(business_id);

CREATE INDEX IF NOT EXISTS idx_inventory_risk_flags_type 
  ON public.inventory_risk_flags(flag_type);

-- Enable RLS
ALTER TABLE public.inventory_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_risk_flags ENABLE ROW LEVEL SECURITY;

-- RLS policies for inventory_forecasts
CREATE POLICY "Users can view all inventory forecasts" 
  ON public.inventory_forecasts FOR SELECT USING (true);

CREATE POLICY "Users can insert inventory forecasts" 
  ON public.inventory_forecasts FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update inventory forecasts" 
  ON public.inventory_forecasts FOR UPDATE USING (true);

CREATE POLICY "Users can delete inventory forecasts" 
  ON public.inventory_forecasts FOR DELETE USING (true);

-- RLS policies for inventory_risk_flags
CREATE POLICY "Users can view all inventory risk flags" 
  ON public.inventory_risk_flags FOR SELECT USING (true);

CREATE POLICY "Users can insert inventory risk flags" 
  ON public.inventory_risk_flags FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update inventory risk flags" 
  ON public.inventory_risk_flags FOR UPDATE USING (true);

CREATE POLICY "Users can delete inventory risk flags" 
  ON public.inventory_risk_flags FOR DELETE USING (true);