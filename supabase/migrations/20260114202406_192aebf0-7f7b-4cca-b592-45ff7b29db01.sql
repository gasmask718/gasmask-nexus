-- Add state and tags columns to ambassadors table
ALTER TABLE public.ambassadors 
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS tags text;