-- Add category column for grouping tasks (e.g., "2026 Goals", "General")
ALTER TABLE public.brand_tasks
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General';

-- Add index for faster category filtering
CREATE INDEX IF NOT EXISTS idx_brand_tasks_category 
ON public.brand_tasks(business_id, category);

-- Add index for status filtering (performance optimization)
CREATE INDEX IF NOT EXISTS idx_brand_tasks_status 
ON public.brand_tasks(business_id, status);