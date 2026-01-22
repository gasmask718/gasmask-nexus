-- =====================================================
-- AMBASSADOR PORTAL OS - PHASE 1A: ADD COLUMNS TO AMBASSADOR_ASSIGNMENTS
-- =====================================================

-- 1) Create assignment_type enum if not exists
DO $$ BEGIN
  CREATE TYPE public.ambassador_assignment_type AS ENUM ('assigned', 'sourced');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2) Add new columns to ambassador_assignments
ALTER TABLE public.ambassador_assignments 
ADD COLUMN IF NOT EXISTS assignment_type text DEFAULT 'assigned',
ADD COLUMN IF NOT EXISTS active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS start_date date DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS end_date date,
ADD COLUMN IF NOT EXISTS is_primary boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS created_by uuid,
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS store_id uuid;

-- 3) Add foreign key constraint for store_id
DO $$ BEGIN
  ALTER TABLE public.ambassador_assignments 
  ADD CONSTRAINT fk_ambassador_assignments_store 
  FOREIGN KEY (store_id) REFERENCES public.store_master(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 4) Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_ambassador_assignments_ambassador_active 
ON public.ambassador_assignments(ambassador_id, active) 
WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_ambassador_assignments_store 
ON public.ambassador_assignments(store_id) 
WHERE store_id IS NOT NULL;