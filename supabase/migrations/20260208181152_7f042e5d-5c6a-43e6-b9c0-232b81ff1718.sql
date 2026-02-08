
-- Phase 4: AI Supply Prediction
-- Tables for supply predictions and supplier lead times

-- Supplier lead times configuration
CREATE TABLE public.production_supplier_lead_times (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID REFERENCES public.production_offices(id) ON DELETE CASCADE,
  material_type TEXT NOT NULL,
  supplier_name TEXT,
  lead_time_days INTEGER NOT NULL DEFAULT 3,
  min_order_quantity NUMERIC,
  cost_per_unit NUMERIC,
  reliability_score NUMERIC DEFAULT 80,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI supply predictions
CREATE TABLE public.production_supply_predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID NOT NULL REFERENCES public.production_offices(id) ON DELETE CASCADE,
  material_type TEXT NOT NULL,
  current_stock NUMERIC NOT NULL DEFAULT 0,
  daily_consumption_rate NUMERIC NOT NULL DEFAULT 0,
  predicted_stockout_date DATE,
  recommended_reorder_date DATE,
  recommended_order_quantity NUMERIC,
  confidence_score NUMERIC DEFAULT 0,
  urgency TEXT DEFAULT 'normal' CHECK (urgency IN ('critical', 'warning', 'normal', 'surplus')),
  ai_reasoning TEXT,
  data_points_used INTEGER DEFAULT 0,
  predicted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.production_supplier_lead_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_supply_predictions ENABLE ROW LEVEL SECURITY;

-- RLS policies for lead times
CREATE POLICY "Authenticated users can view lead times"
  ON public.production_supplier_lead_times FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert lead times"
  ON public.production_supplier_lead_times FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update lead times"
  ON public.production_supplier_lead_times FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete lead times"
  ON public.production_supplier_lead_times FOR DELETE
  TO authenticated USING (true);

-- RLS policies for predictions
CREATE POLICY "Authenticated users can view predictions"
  ON public.production_supply_predictions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert predictions"
  ON public.production_supply_predictions FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update predictions"
  ON public.production_supply_predictions FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete predictions"
  ON public.production_supply_predictions FOR DELETE
  TO authenticated USING (true);

-- Update trigger for lead times
CREATE TRIGGER update_production_supplier_lead_times_updated_at
  BEFORE UPDATE ON public.production_supplier_lead_times
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_supply_predictions_office ON public.production_supply_predictions(office_id);
CREATE INDEX idx_supply_predictions_urgency ON public.production_supply_predictions(urgency);
CREATE INDEX idx_supplier_lead_times_office ON public.production_supplier_lead_times(office_id);
CREATE INDEX idx_supplier_lead_times_material ON public.production_supplier_lead_times(material_type);
