-- GasMask AI call lifecycle column — separate from sales_prospects.pipeline_stage
-- (human CRM lifecycle) and store_master.health_status (legacy). Canonical
-- dc_disposition_codes values + 'cancelled' for kill-switch aborts.

ALTER TABLE public.sales_prospects
  ADD COLUMN IF NOT EXISTS gasmask_call_status TEXT DEFAULT 'new';

ALTER TABLE public.store_master
  ADD COLUMN IF NOT EXISTS gasmask_call_status TEXT DEFAULT 'new';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_prospects_gasmask_call_status_check'
  ) THEN
    ALTER TABLE public.sales_prospects
      ADD CONSTRAINT sales_prospects_gasmask_call_status_check
      CHECK (gasmask_call_status IN (
        'new','queued','called','voicemail','no_answer','callback',
        'interested','booked','not_interested','wrong_number','dnc','cancelled'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'store_master_gasmask_call_status_check'
  ) THEN
    ALTER TABLE public.store_master
      ADD CONSTRAINT store_master_gasmask_call_status_check
      CHECK (gasmask_call_status IN (
        'new','queued','called','voicemail','no_answer','callback',
        'interested','booked','not_interested','wrong_number','dnc','cancelled'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_prospects_gasmask_call_status
  ON public.sales_prospects(gasmask_call_status) WHERE archived = false;

CREATE INDEX IF NOT EXISTS idx_store_master_gasmask_call_status
  ON public.store_master(gasmask_call_status) WHERE deleted_at IS NULL;