-- Add permission and lifecycle fields to kpi_definitions
ALTER TABLE public.kpi_definitions 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS visible_roles TEXT[] DEFAULT ARRAY['admin', 'manager', 'employee'],
ADD COLUMN IF NOT EXISTS editable_roles TEXT[] DEFAULT ARRAY['admin'],
ADD COLUMN IF NOT EXISTS preview_sql TEXT;

-- Add permission fields to kpi_categories
ALTER TABLE public.kpi_categories
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS visible_roles TEXT[] DEFAULT ARRAY['admin', 'manager', 'employee'];

-- Create index for faster lookups on active/archived KPIs
CREATE INDEX IF NOT EXISTS idx_kpi_definitions_active ON public.kpi_definitions(is_active, is_archived);
CREATE INDEX IF NOT EXISTS idx_kpi_categories_archived ON public.kpi_categories(is_archived);