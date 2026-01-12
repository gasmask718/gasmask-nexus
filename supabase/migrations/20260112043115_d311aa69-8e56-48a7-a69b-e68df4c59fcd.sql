-- Add member_since field to stores table for manual override
-- If null, UI will calculate from oldest note
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS member_since date DEFAULT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN public.stores.member_since IS 'Manual override for member since date. If null, calculated from oldest store note created_at.';