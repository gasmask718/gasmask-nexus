-- Step 1: Add is_simulation column to stores table
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS is_simulation BOOLEAN DEFAULT false;