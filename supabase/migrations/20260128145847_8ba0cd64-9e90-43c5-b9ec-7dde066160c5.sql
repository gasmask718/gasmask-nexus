
-- ════════════════════════════════════════════════════════════════════════════
-- MASTER GENIUS ARCHITECT: lead_type ENFORCEMENT
-- 1. Remove the DEFAULT 'store' — lead_type MUST be explicitly set
-- 2. Add CHECK constraint for valid values
-- 3. Ensure no NULL values allowed
-- ════════════════════════════════════════════════════════════════════════════

-- Step 1: Remove the DEFAULT from lead_type column
ALTER TABLE public.sales_prospects 
ALTER COLUMN lead_type DROP DEFAULT;

-- Step 2: Add CHECK constraint to enforce valid lead_type values
-- This prevents any invalid lead_type from being inserted
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'sales_prospects_lead_type_valid_check'
  ) THEN
    ALTER TABLE public.sales_prospects
    ADD CONSTRAINT sales_prospects_lead_type_valid_check 
    CHECK (lead_type IN ('store', 'wholesaler', 'ambassador', 'influencer'));
  END IF;
END $$;

-- Step 3: Ensure lead_type is NOT NULL (should already be, but enforce)
ALTER TABLE public.sales_prospects
ALTER COLUMN lead_type SET NOT NULL;

-- Step 4: Create index for lead_type queries (if not exists)
CREATE INDEX IF NOT EXISTS idx_sales_prospects_lead_type 
ON public.sales_prospects(lead_type);

-- Step 5: Update any NULL lead_type values to 'store' (legacy cleanup)
-- This is a one-time fix for any existing NULL values
UPDATE public.sales_prospects 
SET lead_type = 'store' 
WHERE lead_type IS NULL;
