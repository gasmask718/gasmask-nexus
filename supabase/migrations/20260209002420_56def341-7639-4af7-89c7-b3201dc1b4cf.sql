-- Phase 2.1: Add signal-tracking columns for governed floor emissions
ALTER TABLE public.owner_missions 
  ADD COLUMN IF NOT EXISTS source_reference text,
  ADD COLUMN IF NOT EXISTS severity_score integer DEFAULT 0;

-- Index for duplicate prevention: fast lookup by source_reference
CREATE INDEX IF NOT EXISTS idx_owner_missions_source_reference 
  ON public.owner_missions(source_reference) 
  WHERE source_reference IS NOT NULL;

-- Composite index for active mission dedup checks
CREATE INDEX IF NOT EXISTS idx_owner_missions_active_source_ref 
  ON public.owner_missions(source_reference, status) 
  WHERE status IN ('pending', 'in_progress') AND source_reference IS NOT NULL;

COMMENT ON COLUMN public.owner_missions.source_reference IS 'Floor signal origin key, e.g. invoice:uuid. Used for duplicate prevention.';
COMMENT ON COLUMN public.owner_missions.severity_score IS 'Signal urgency 1-10. Higher = more urgent. Used by AI observation layer.';