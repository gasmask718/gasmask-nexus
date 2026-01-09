-- Add is_simulation column to wholesalers table
ALTER TABLE public.wholesalers ADD COLUMN IF NOT EXISTS is_simulation boolean DEFAULT false;