-- Create table to persist multi-brand intelligence signals over time
CREATE TABLE public.multi_brand_intelligence_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID NOT NULL,
  recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- CBRE metrics
  cbre_score NUMERIC(4,3),
  efficiency_gain_percent INTEGER,
  efficiency_status TEXT, -- 'excellent', 'acceptable', 'inefficient'
  actual_stops INTEGER,
  theoretical_stops INTEGER,
  
  -- Conflict metrics
  total_conflicts INTEGER DEFAULT 0,
  conflict_details JSONB DEFAULT '[]'::jsonb,
  
  -- Finance exposure
  unpaid_invoice_count INTEGER DEFAULT 0,
  unpaid_exposure_amount NUMERIC(12,2) DEFAULT 0,
  partial_delivery_count INTEGER DEFAULT 0,
  
  -- Operator acknowledgment
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledged_by UUID,
  acknowledgment_note TEXT,
  
  -- Outcome tracking (filled post-dispatch)
  dispatch_proceeded BOOLEAN,
  actual_outcome TEXT, -- 'success', 'partial', 'failed', 'delayed'
  outcome_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(route_id, recorded_date)
);

-- Enable RLS
ALTER TABLE public.multi_brand_intelligence_history ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Authenticated users can view intelligence history"
  ON public.multi_brand_intelligence_history
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert intelligence history"
  ON public.multi_brand_intelligence_history
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update intelligence history"
  ON public.multi_brand_intelligence_history
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Index for common queries
CREATE INDEX idx_intelligence_history_date ON public.multi_brand_intelligence_history(recorded_date);
CREATE INDEX idx_intelligence_history_route ON public.multi_brand_intelligence_history(route_id);

-- Trigger for updated_at
CREATE TRIGGER update_intelligence_history_updated_at
  BEFORE UPDATE ON public.multi_brand_intelligence_history
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();