
-- Add source metadata to sbo_capper_picks for aggregator support
ALTER TABLE public.sbo_capper_picks 
  ADD COLUMN IF NOT EXISTS source_group text,
  ADD COLUMN IF NOT EXISTS posted_by text,
  ADD COLUMN IF NOT EXISTS extracted_capper_name text;

-- Add group_type to sbo_cappers to distinguish direct vs aggregator sources
ALTER TABLE public.sbo_cappers
  ADD COLUMN IF NOT EXISTS group_type text DEFAULT 'direct';
