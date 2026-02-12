
-- Step 1: Add new columns (these may already exist from partial previous run)
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS entity_type text DEFAULT 'store',
ADD COLUMN IF NOT EXISTS entity_id uuid,
ADD COLUMN IF NOT EXISTS pricing_mode text DEFAULT 'retail';

-- Step 2: Temporarily disable the finalization guard trigger for backfill
ALTER TABLE public.invoices DISABLE TRIGGER trg_guard_finalized_invoice;

-- Step 3: Backfill entity_id from store_id for existing store invoices
UPDATE public.invoices 
SET entity_type = 'store', 
    entity_id = store_id,
    pricing_mode = 'retail'
WHERE store_id IS NOT NULL AND entity_id IS NULL;

-- Step 4: Backfill entity_id from company_id for existing company invoices  
UPDATE public.invoices 
SET entity_type = 'company', 
    entity_id = company_id,
    pricing_mode = 'retail'
WHERE company_id IS NOT NULL AND store_id IS NULL AND entity_id IS NULL;

-- Step 5: Re-enable the trigger
ALTER TABLE public.invoices ENABLE TRIGGER trg_guard_finalized_invoice;

-- Step 6: Add index for polymorphic lookups
CREATE INDEX IF NOT EXISTS idx_invoices_entity_lookup ON public.invoices(entity_type, entity_id);

-- Step 7: Add pricing_mode to invoice_line_items
ALTER TABLE public.invoice_line_items
ADD COLUMN IF NOT EXISTS pricing_mode text DEFAULT 'retail';

-- Step 8: RLS policies for wholesaler access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'Wholesalers can view their own invoices'
  ) THEN
    CREATE POLICY "Wholesalers can view their own invoices"
    ON public.invoices
    FOR SELECT
    TO authenticated
    USING (
      entity_type = 'wholesaler' AND entity_id IN (
        SELECT id FROM public.wholesaler_profiles WHERE user_id = auth.uid()
      )
    );
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'Users can insert wholesaler invoices'
  ) THEN
    CREATE POLICY "Users can insert wholesaler invoices"
    ON public.invoices
    FOR INSERT
    TO authenticated
    WITH CHECK (
      entity_type = 'wholesaler' AND entity_id IS NOT NULL
    );
  END IF;
END $$;
