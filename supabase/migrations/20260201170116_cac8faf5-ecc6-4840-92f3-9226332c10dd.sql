-- Add time & motion tracking columns to production_batches
ALTER TABLE public.production_batches
ADD COLUMN IF NOT EXISTS tobacco_heatup_minutes numeric,
ADD COLUMN IF NOT EXISTS avg_tube_fill_seconds numeric,
ADD COLUMN IF NOT EXISTS avg_sticker_apply_seconds numeric;

-- Add defect_reason column to production_batch_outputs
ALTER TABLE public.production_batch_outputs
ADD COLUMN IF NOT EXISTS defect_reason text;

-- Add index for efficient date-based history queries
CREATE INDEX IF NOT EXISTS idx_production_batches_office_date 
ON public.production_batches(office_id, batch_date DESC);

COMMENT ON COLUMN production_batches.tobacco_heatup_minutes IS 'Time taken for tobacco heat-up process (minutes)';
COMMENT ON COLUMN production_batches.avg_tube_fill_seconds IS 'Average time to fill a tube (seconds)';
COMMENT ON COLUMN production_batches.avg_sticker_apply_seconds IS 'Average time to apply a sticker (seconds)';
COMMENT ON COLUMN production_batch_outputs.defect_reason IS 'Reason for defects in this output';