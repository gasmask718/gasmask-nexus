-- Add explicit lead_type column to sales_prospects
-- MASTER GENIUS ARCHITECT: lead_type must be set at creation, never inferred

-- Add lead_type column with CHECK constraint for valid values only
ALTER TABLE public.sales_prospects 
ADD COLUMN IF NOT EXISTS lead_type text NOT NULL DEFAULT 'store';

-- Add CHECK constraint to enforce valid lead types
ALTER TABLE public.sales_prospects
ADD CONSTRAINT sales_prospects_lead_type_check 
CHECK (lead_type IN ('store', 'wholesaler', 'ambassador', 'influencer'));

-- Update existing records to infer lead_type from source field (one-time migration)
UPDATE public.sales_prospects
SET lead_type = 
  CASE 
    WHEN source ILIKE '%wholesaler%' OR source ILIKE '%wholesale%' THEN 'wholesaler'
    WHEN source ILIKE '%influencer%' THEN 'influencer'
    WHEN source = 'ambassador_recruit' THEN 'ambassador'
    ELSE 'store'
  END
WHERE lead_type = 'store' OR lead_type IS NULL;

-- Create index for efficient lead_type + archived queries
CREATE INDEX IF NOT EXISTS idx_sales_prospects_lead_type_archived 
ON public.sales_prospects(lead_type, archived) 
WHERE archived = false;

-- Add comment for documentation
COMMENT ON COLUMN public.sales_prospects.lead_type IS 'Explicit lead classification: store, wholesaler, ambassador, influencer. Must be set at creation, never inferred.';