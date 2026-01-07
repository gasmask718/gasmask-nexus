-- Create table for CRM import logs
CREATE TABLE IF NOT EXISTS public.crm_import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  import_type TEXT NOT NULL,  -- 'contacts', 'notes', 'orders'
  file_name TEXT,
  total_rows INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  warnings JSONB DEFAULT '[]'::jsonb,
  field_mapping JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_import_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view import logs for their businesses" 
ON public.crm_import_logs 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create import logs" 
ON public.crm_import_logs 
FOR INSERT 
WITH CHECK (true);

-- Create table for custom KPI overrides
CREATE TABLE IF NOT EXISTS public.brand_kpi_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  kpi_key TEXT NOT NULL,
  custom_value NUMERIC,
  notes TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_id, kpi_key)
);

-- Enable RLS
ALTER TABLE public.brand_kpi_overrides ENABLE ROW LEVEL SECURITY;

-- RLS policies  
CREATE POLICY "Users can view KPI overrides" 
ON public.brand_kpi_overrides 
FOR SELECT 
USING (true);

CREATE POLICY "Users can manage KPI overrides" 
ON public.brand_kpi_overrides 
FOR ALL 
USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_crm_import_logs_business ON crm_import_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_brand_kpi_overrides_business ON brand_kpi_overrides(business_id);