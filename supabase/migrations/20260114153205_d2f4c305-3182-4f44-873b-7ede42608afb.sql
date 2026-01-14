-- Add created_by column to ambassadors, drivers, and bikers tables
-- This enables ownership tracking for RLS policies

-- Add created_by to ambassadors table
ALTER TABLE public.ambassadors 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Add created_by to drivers table  
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Add created_by to bikers table
ALTER TABLE public.bikers 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ambassadors_created_by ON public.ambassadors(created_by);
CREATE INDEX IF NOT EXISTS idx_drivers_created_by ON public.drivers(created_by);
CREATE INDEX IF NOT EXISTS idx_bikers_created_by ON public.bikers(created_by);