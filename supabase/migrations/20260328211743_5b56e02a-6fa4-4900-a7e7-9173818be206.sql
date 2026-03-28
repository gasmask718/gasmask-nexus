
-- Add normalized_name to sbo_cappers for identity matching
ALTER TABLE public.sbo_cappers
  ADD COLUMN IF NOT EXISTS normalized_name text;

-- Create capper aliases table for learning name variants
CREATE TABLE IF NOT EXISTS public.sbo_capper_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capper_id uuid REFERENCES public.sbo_cappers(id) ON DELETE CASCADE NOT NULL,
  alias text NOT NULL,
  normalized_alias text NOT NULL,
  source text DEFAULT 'manual',
  created_at timestamptz DEFAULT now(),
  UNIQUE(normalized_alias)
);

ALTER TABLE public.sbo_capper_aliases ENABLE ROW LEVEL SECURITY;

-- Add capper_detection_confidence to sbo_capper_picks
ALTER TABLE public.sbo_capper_picks
  ADD COLUMN IF NOT EXISTS capper_detection_confidence integer DEFAULT 100,
  ADD COLUMN IF NOT EXISTS source_group_id text;

-- Backfill normalized_name for existing cappers (exclude empty results)
UPDATE public.sbo_cappers 
SET normalized_name = NULLIF(
  lower(regexp_replace(
    regexp_replace(name, '\s*(vip|picks|plays|locks|bets)\s*', '', 'gi'),
    '[^a-z0-9]', '', 'g'
  )), ''
) WHERE normalized_name IS NULL AND name IS NOT NULL;

-- Create unique index excluding nulls
CREATE UNIQUE INDEX IF NOT EXISTS idx_sbo_cappers_normalized_name 
  ON public.sbo_cappers (normalized_name) 
  WHERE normalized_name IS NOT NULL;
