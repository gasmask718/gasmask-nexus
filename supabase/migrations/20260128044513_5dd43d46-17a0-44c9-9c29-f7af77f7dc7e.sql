-- Add archival tracking columns to sales_prospects
ALTER TABLE public.sales_prospects 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES public.ambassadors(id);

-- Add unassignment tracking columns to ambassador_assignments
ALTER TABLE public.ambassador_assignments 
ADD COLUMN IF NOT EXISTS unassigned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS unassigned_by UUID REFERENCES public.ambassadors(id);

-- Create index for archived leads query performance
CREATE INDEX IF NOT EXISTS idx_sales_prospects_archived ON public.sales_prospects(archived, archived_at);

-- Create index for active assignments query performance
CREATE INDEX IF NOT EXISTS idx_ambassador_assignments_active ON public.ambassador_assignments(ambassador_id, active);

-- Add comment for documentation
COMMENT ON COLUMN public.sales_prospects.archived_at IS 'Timestamp when the lead was archived (soft-deleted)';
COMMENT ON COLUMN public.sales_prospects.archived_by IS 'Ambassador who archived this lead';
COMMENT ON COLUMN public.ambassador_assignments.unassigned_at IS 'Timestamp when the assignment was deactivated';
COMMENT ON COLUMN public.ambassador_assignments.unassigned_by IS 'Ambassador who removed this assignment';