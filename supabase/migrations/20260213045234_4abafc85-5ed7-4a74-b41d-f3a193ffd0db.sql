-- Phase 5A: AI Dispatch Learning (Analytics-Only)
-- Read-only telemetry table for tracking human responses to AI suggestions

CREATE TABLE IF NOT EXISTS public.ai_dispatch_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  store_id UUID NOT NULL,
  store_name TEXT NOT NULL,
  territory TEXT,
  
  recommendation_hash TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  confidence INTEGER NOT NULL,
  risk_level TEXT NOT NULL,
  
  sla_severity TEXT,
  urgency_score INTEGER,
  
  user_id UUID,
  user_role TEXT,
  
  event_type TEXT NOT NULL,
  decision_latency_seconds INTEGER,
  
  contributing_factors JSONB
);

-- Index for querying by event type and timestamp (analytics queries)
CREATE INDEX idx_ai_dispatch_feedback_event ON public.ai_dispatch_feedback(event_type, created_at DESC);

-- Index for querying by store (store-level learning)
CREATE INDEX idx_ai_dispatch_feedback_store ON public.ai_dispatch_feedback(store_id, created_at DESC);

-- Index for querying by recommendation hash (suggestion-level analysis)
CREATE INDEX idx_ai_dispatch_feedback_hash ON public.ai_dispatch_feedback(recommendation_hash, event_type);

-- No RLS: This is best-effort telemetry. Failures to write must not block UI.
-- No foreign keys: Ensures independent lifecycle.