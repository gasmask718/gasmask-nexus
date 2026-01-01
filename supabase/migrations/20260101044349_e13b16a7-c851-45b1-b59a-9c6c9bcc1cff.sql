-- Staff Category KPI Cards table
-- Auto-created 1:1 with each staff category

CREATE TABLE public.ut_staff_category_kpis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_category_id UUID NOT NULL UNIQUE REFERENCES public.ut_staff_categories(id) ON DELETE CASCADE,
  business_slug TEXT NOT NULL,
  
  -- KPI Fields (all start at zero)
  total_staff INTEGER NOT NULL DEFAULT 0,
  active_shifts INTEGER NOT NULL DEFAULT 0,
  completed_events INTEGER NOT NULL DEFAULT 0,
  revenue_generated NUMERIC(12,2) NOT NULL DEFAULT 0,
  performance_score NUMERIC(3,2) DEFAULT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ut_staff_category_kpis ENABLE ROW LEVEL SECURITY;

-- RLS Policies - authenticated users can read/write
CREATE POLICY "Authenticated users can read KPIs" 
ON public.ut_staff_category_kpis 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert KPIs" 
ON public.ut_staff_category_kpis 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update KPIs" 
ON public.ut_staff_category_kpis 
FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can delete KPIs" 
ON public.ut_staff_category_kpis 
FOR DELETE 
TO authenticated 
USING (true);

-- Function to auto-create KPI card when staff category is created
CREATE OR REPLACE FUNCTION public.auto_create_staff_category_kpi()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.ut_staff_category_kpis (
    staff_category_id,
    business_slug,
    total_staff,
    active_shifts,
    completed_events,
    revenue_generated,
    performance_score,
    status
  ) VALUES (
    NEW.id,
    NEW.business_slug,
    0,
    0,
    0,
    0,
    NULL,
    'active'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger: when a staff category is created, auto-create KPI card
CREATE TRIGGER trigger_auto_create_staff_category_kpi
AFTER INSERT ON public.ut_staff_categories
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_staff_category_kpi();

-- Updated_at trigger
CREATE TRIGGER trigger_update_staff_category_kpi_timestamp
BEFORE UPDATE ON public.ut_staff_category_kpis
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill: create KPI cards for any existing categories that don't have one
INSERT INTO public.ut_staff_category_kpis (staff_category_id, business_slug, total_staff, active_shifts, completed_events, revenue_generated, status)
SELECT 
  c.id,
  c.business_slug,
  0,
  0,
  0,
  0,
  'active'
FROM public.ut_staff_categories c
LEFT JOIN public.ut_staff_category_kpis k ON k.staff_category_id = c.id
WHERE k.id IS NULL;