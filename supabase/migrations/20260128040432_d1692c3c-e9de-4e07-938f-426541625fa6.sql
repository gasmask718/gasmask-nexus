-- Add archived column to sales_prospects for soft delete
ALTER TABLE public.sales_prospects
ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_sales_prospects_archived ON public.sales_prospects(archived);

-- Add comment for documentation
COMMENT ON COLUMN public.sales_prospects.archived IS 'Soft delete flag - archived leads are hidden from UI but retained for audit';