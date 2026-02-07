
-- Phase V: Intelligence Accountability — Exposure Tracking
-- Records when intelligence was VIEWED by a user (not acted upon)
-- Read-only measurement layer; no triggers, no mutations

CREATE TABLE public.intelligence_exposures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  store_id UUID NOT NULL,
  exposure_type TEXT NOT NULL,          -- 'best_contact' | 'predictive_panel' | 'confidence_badge' | 'time_of_day_hint' | 'route_annotation'
  confidence_level TEXT,                -- 'high' | 'medium' | 'low' (if applicable)
  suggested_channel TEXT,               -- 'text' | 'call' | 'none'
  suggested_contact_id UUID,            -- which contact was suggested as best
  route_context BOOLEAN DEFAULT false,  -- was user on a route?
  metadata JSONB DEFAULT '{}',          -- extensible: time window, etc.
  exposed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for correlation queries (store + time range)
CREATE INDEX idx_intel_exposures_store_time ON public.intelligence_exposures (store_id, exposed_at DESC);
CREATE INDEX idx_intel_exposures_user ON public.intelligence_exposures (user_id, exposed_at DESC);
CREATE INDEX idx_intel_exposures_type ON public.intelligence_exposures (exposure_type);

-- Enable RLS
ALTER TABLE public.intelligence_exposures ENABLE ROW LEVEL SECURITY;

-- Users can insert their own exposures
CREATE POLICY "Users can log their own exposures"
  ON public.intelligence_exposures
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own exposures (for diagnostics)
CREATE POLICY "Users can read their own exposures"
  ON public.intelligence_exposures
  FOR SELECT
  USING (auth.uid() = user_id);

-- No update or delete — immutable log
COMMENT ON TABLE public.intelligence_exposures IS 'Phase V: Immutable log of intelligence panel views. Read-only accountability layer.';
