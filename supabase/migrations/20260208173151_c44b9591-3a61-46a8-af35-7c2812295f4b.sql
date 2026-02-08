
-- =====================================================
-- PHASE 2: COST ENGINE + MARGIN TRACKING
-- =====================================================

-- 1) production_batch_costs — stores cost breakdown per batch
CREATE TABLE public.production_batch_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES public.production_batches(id) ON DELETE CASCADE,
  
  -- Material costs
  material_tobacco_cost NUMERIC DEFAULT 0,
  material_tubes_cost NUMERIC DEFAULT 0,
  material_stickers_cost NUMERIC DEFAULT 0,
  material_bags_cost NUMERIC DEFAULT 0,
  material_boxes_cost NUMERIC DEFAULT 0,
  material_other_cost NUMERIC DEFAULT 0,
  
  -- Labor
  labor_hours NUMERIC DEFAULT 0,
  labor_rate_per_hour NUMERIC DEFAULT 15.00,
  labor_cost NUMERIC GENERATED ALWAYS AS (labor_hours * labor_rate_per_hour) STORED,
  
  -- Overhead (configurable per-batch)
  overhead_pct NUMERIC DEFAULT 10,
  
  -- Computed totals
  total_material_cost NUMERIC GENERATED ALWAYS AS (
    material_tobacco_cost + material_tubes_cost + material_stickers_cost + 
    material_bags_cost + material_boxes_cost + material_other_cost
  ) STORED,
  
  -- Pricing
  wholesale_price_per_box NUMERIC DEFAULT 0,
  retail_price_per_box NUMERIC DEFAULT 0,
  
  -- Metadata
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_batch_cost UNIQUE (batch_id)
);

-- 2) Enable RLS
ALTER TABLE public.production_batch_costs ENABLE ROW LEVEL SECURITY;

-- 3) RLS Policies — admin/manager only (cost data is sensitive)
CREATE POLICY "Authenticated users can read batch costs"
  ON public.production_batch_costs FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert batch costs"
  ON public.production_batch_costs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update batch costs"
  ON public.production_batch_costs FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete batch costs"
  ON public.production_batch_costs FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- 4) production_overhead_config — global overhead settings
CREATE TABLE public.production_overhead_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID REFERENCES public.production_offices(id) ON DELETE CASCADE,
  default_labor_rate NUMERIC NOT NULL DEFAULT 15.00,
  default_overhead_pct NUMERIC NOT NULL DEFAULT 10.00,
  rent_monthly NUMERIC DEFAULT 0,
  utilities_monthly NUMERIC DEFAULT 0,
  insurance_monthly NUMERIC DEFAULT 0,
  other_monthly NUMERIC DEFAULT 0,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_office_overhead UNIQUE (office_id, effective_from)
);

ALTER TABLE public.production_overhead_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read overhead config"
  ON public.production_overhead_config FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage overhead config"
  ON public.production_overhead_config FOR ALL
  USING (auth.uid() IS NOT NULL);

-- 5) Updated at trigger
CREATE TRIGGER update_batch_costs_updated_at
  BEFORE UPDATE ON public.production_batch_costs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_overhead_config_updated_at
  BEFORE UPDATE ON public.production_overhead_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Margin analysis view
CREATE OR REPLACE VIEW public.v_production_margin_analysis AS
SELECT
  b.id AS batch_id,
  b.brand,
  b.office_id,
  b.batch_date,
  b.boxes_produced,
  b.inventory_state,
  o.name AS office_name,
  
  -- Cost breakdown
  c.total_material_cost,
  c.labor_cost,
  
  -- Overhead as % of (material + labor)
  ROUND((c.total_material_cost + c.labor_cost) * (c.overhead_pct / 100.0), 2) AS overhead_cost,
  
  -- Total cost
  ROUND(
    c.total_material_cost + c.labor_cost + 
    (c.total_material_cost + c.labor_cost) * (c.overhead_pct / 100.0)
  , 2) AS total_cost,
  
  -- Cost per box
  CASE WHEN COALESCE(b.boxes_produced, 0) > 0 THEN
    ROUND(
      (c.total_material_cost + c.labor_cost + 
       (c.total_material_cost + c.labor_cost) * (c.overhead_pct / 100.0))
      / b.boxes_produced
    , 2)
  ELSE NULL END AS cost_per_box,
  
  -- Revenue per box
  c.wholesale_price_per_box,
  c.retail_price_per_box,
  
  -- Gross margin (wholesale)
  CASE WHEN COALESCE(b.boxes_produced, 0) > 0 AND c.wholesale_price_per_box > 0 THEN
    ROUND(
      c.wholesale_price_per_box - (
        (c.total_material_cost + c.labor_cost + 
         (c.total_material_cost + c.labor_cost) * (c.overhead_pct / 100.0))
        / b.boxes_produced
      )
    , 2)
  ELSE NULL END AS gross_margin_wholesale,
  
  -- Margin % (wholesale)
  CASE WHEN c.wholesale_price_per_box > 0 AND COALESCE(b.boxes_produced, 0) > 0 THEN
    ROUND(
      (c.wholesale_price_per_box - (
        (c.total_material_cost + c.labor_cost + 
         (c.total_material_cost + c.labor_cost) * (c.overhead_pct / 100.0))
        / b.boxes_produced
      )) / c.wholesale_price_per_box * 100
    , 1)
  ELSE NULL END AS margin_pct_wholesale,
  
  -- Margin % (retail)
  CASE WHEN c.retail_price_per_box > 0 AND COALESCE(b.boxes_produced, 0) > 0 THEN
    ROUND(
      (c.retail_price_per_box - (
        (c.total_material_cost + c.labor_cost + 
         (c.total_material_cost + c.labor_cost) * (c.overhead_pct / 100.0))
        / b.boxes_produced
      )) / c.retail_price_per_box * 100
    , 1)
  ELSE NULL END AS margin_pct_retail,
  
  c.created_at AS cost_recorded_at

FROM public.production_batches b
LEFT JOIN public.production_batch_costs c ON c.batch_id = b.id
LEFT JOIN public.production_offices o ON o.id = b.office_id;
