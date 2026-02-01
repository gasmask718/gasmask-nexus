-- Add sourced_by_ambassador_id to store_master for attribution credit tracking
-- This is IMMUTABLE attribution - never changes after initial sourcing
ALTER TABLE public.store_master 
ADD COLUMN IF NOT EXISTS sourced_by_ambassador_id UUID REFERENCES public.ambassadors(id);

-- Add assigned_ambassador_id for current operational responsibility
-- This can change over time via reassignment
ALTER TABLE public.store_master 
ADD COLUMN IF NOT EXISTS assigned_ambassador_id UUID REFERENCES public.ambassadors(id);

-- Add sourced_at timestamp to track when store was brought in
ALTER TABLE public.store_master 
ADD COLUMN IF NOT EXISTS sourced_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add last_visit_at for store health tracking
ALTER TABLE public.store_master 
ADD COLUMN IF NOT EXISTS last_visit_at TIMESTAMP WITH TIME ZONE;

-- Add last_order_at for store activity tracking  
ALTER TABLE public.store_master 
ADD COLUMN IF NOT EXISTS last_order_at TIMESTAMP WITH TIME ZONE;

-- Add store health status for operational visibility
ALTER TABLE public.store_master 
ADD COLUMN IF NOT EXISTS health_status TEXT DEFAULT 'healthy' 
CHECK (health_status IN ('healthy', 'at_risk', 'dormant', 'lost'));

-- Add assignment_role to ambassador_assignments for clarity
-- 'sourced' = attribution credit, 'assigned' = operational responsibility
ALTER TABLE public.ambassador_assignments 
ADD COLUMN IF NOT EXISTS assignment_role TEXT DEFAULT 'assigned'
CHECK (assignment_role IN ('sourced', 'assigned'));

-- Create index for fast ambassador lookups
CREATE INDEX IF NOT EXISTS idx_store_master_sourced_ambassador 
ON public.store_master(sourced_by_ambassador_id);

CREATE INDEX IF NOT EXISTS idx_store_master_assigned_ambassador 
ON public.store_master(assigned_ambassador_id);

-- Migrate existing ambassador_assignments to new schema
-- Mark existing assignments as 'assigned' (operational)
UPDATE public.ambassador_assignments 
SET assignment_role = 'assigned' 
WHERE assignment_role IS NULL AND store_id IS NOT NULL;

COMMENT ON COLUMN public.store_master.sourced_by_ambassador_id IS 'Immutable attribution - who brought this store into the ecosystem. Never changes.';
COMMENT ON COLUMN public.store_master.assigned_ambassador_id IS 'Current operational owner - who manages this store. Can be reassigned.';
COMMENT ON COLUMN public.ambassador_assignments.assignment_role IS 'sourced = attribution credit, assigned = operational responsibility';