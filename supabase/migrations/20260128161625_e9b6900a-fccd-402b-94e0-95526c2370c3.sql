-- MASTER GENIUS ARCHITECT: Final DB Enforcement for lead_type
-- Removes any remaining defaults and enforces strict validation

-- 1. Ensure archived defaults to false (safe default)
ALTER TABLE public.sales_prospects 
ALTER COLUMN archived SET DEFAULT false;

-- 2. Drop any existing default on lead_type (CRITICAL: no silent defaults)
ALTER TABLE public.sales_prospects 
ALTER COLUMN lead_type DROP DEFAULT;

-- 3. Make lead_type NOT NULL (inserts without it will fail)
ALTER TABLE public.sales_prospects 
ALTER COLUMN lead_type SET NOT NULL;

-- 4. Add CHECK constraint for valid lead_type values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'sales_prospects_lead_type_check'
  ) THEN
    ALTER TABLE public.sales_prospects 
    ADD CONSTRAINT sales_prospects_lead_type_check 
    CHECK (lead_type IN ('store', 'wholesaler', 'ambassador', 'influencer'));
  END IF;
END $$;

-- 5. Create index for optimized lead_type + archived filtering
CREATE INDEX IF NOT EXISTS idx_sales_prospects_lead_type_archived 
ON public.sales_prospects(lead_type, archived) 
WHERE archived = false;