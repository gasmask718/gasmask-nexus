-- Add is_simulation column to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS is_simulation BOOLEAN DEFAULT false;

-- Add index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_companies_is_simulation ON public.companies(is_simulation);

-- Add comment for documentation
COMMENT ON COLUMN public.companies.is_simulation IS 'When true, this company was created in simulation mode';