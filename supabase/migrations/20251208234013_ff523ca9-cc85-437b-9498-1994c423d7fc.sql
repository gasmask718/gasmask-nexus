-- Create reorder_policies table for per-product reorder configuration
CREATE TABLE IF NOT EXISTS public.reorder_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  
  min_reorder_qty integer,
  max_reorder_qty integer,
  reorder_multiple integer,
  days_of_cover integer,
  use_auto_calculation boolean DEFAULT false,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_reorder_policies_product ON public.reorder_policies(product_id);
CREATE INDEX IF NOT EXISTS idx_reorder_policies_warehouse ON public.reorder_policies(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_reorder_policies_business ON public.reorder_policies(business_id);

-- Enable RLS
ALTER TABLE public.reorder_policies ENABLE ROW LEVEL SECURITY;

-- RLS policies for reorder_policies
CREATE POLICY "Allow all access to reorder_policies" ON public.reorder_policies
  FOR ALL USING (true) WITH CHECK (true);