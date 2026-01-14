-- Add is_simulation column to ambassadors, drivers, and bikers tables
-- This enables simulation mode data isolation

-- Add is_simulation to ambassadors table
ALTER TABLE public.ambassadors 
ADD COLUMN IF NOT EXISTS is_simulation boolean DEFAULT false;

-- Add is_simulation to drivers table  
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS is_simulation boolean DEFAULT false;

-- Add is_simulation to bikers table
ALTER TABLE public.bikers 
ADD COLUMN IF NOT EXISTS is_simulation boolean DEFAULT false;

-- Create indexes for performance when filtering by simulation mode
CREATE INDEX IF NOT EXISTS idx_ambassadors_is_simulation ON public.ambassadors(is_simulation);
CREATE INDEX IF NOT EXISTS idx_drivers_is_simulation ON public.drivers(is_simulation);
CREATE INDEX IF NOT EXISTS idx_bikers_is_simulation ON public.bikers(is_simulation);