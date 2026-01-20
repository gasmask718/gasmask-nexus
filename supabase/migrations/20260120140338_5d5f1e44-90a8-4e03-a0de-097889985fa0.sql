-- ============================================================
-- PHASE 5: SHADOW MODE INFRASTRUCTURE
-- Predictive Autonomy & Adaptive Governance (Observer Layer)
-- ============================================================

-- 1. Phase 5 System Settings (global mode control)
INSERT INTO public.system_settings (setting_key, setting_value)
VALUES ('phase5_mode', '{"mode": "shadow", "enabled": true, "kill_switch": false}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

-- 2. Phase 5 Recommendations Table (shadow observations)
CREATE TABLE IF NOT EXISTS public.phase5_recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  intent_id UUID REFERENCES public.intent_envelopes(intent_id),
  recommendation_type TEXT NOT NULL, -- 'approve' | 'reject' | 'escalate' | 'amend'
  recommended_action JSONB NOT NULL DEFAULT '{}',
  confidence_score NUMERIC(4,3) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  reasoning TEXT NOT NULL,
  supporting_evidence JSONB DEFAULT '{}',
  actual_outcome TEXT, -- filled in after human decision
  human_agreed BOOLEAN, -- true = human followed recommendation
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- 3. Phase 5 Agreement Log (tracks recommendation accuracy)
CREATE TABLE IF NOT EXISTS public.phase5_agreement_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recommendation_id UUID REFERENCES public.phase5_recommendations(id),
  intent_id UUID REFERENCES public.intent_envelopes(intent_id),
  phase5_recommendation TEXT NOT NULL,
  human_decision TEXT NOT NULL,
  agreed BOOLEAN NOT NULL,
  disagreement_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Phase 5 Pattern Observations (what the system learns in shadow mode)
CREATE TABLE IF NOT EXISTS public.phase5_pattern_observations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pattern_type TEXT NOT NULL, -- 'conflict_pattern' | 'approval_pattern' | 'escalation_pattern' | 'drift_pattern'
  pattern_signature JSONB NOT NULL,
  observation_count INTEGER NOT NULL DEFAULT 1,
  first_observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confidence NUMERIC(4,3) DEFAULT 0.5,
  notes TEXT
);

-- 5. Phase 5 Audit Log (every shadow action is logged)
CREATE TABLE IF NOT EXISTS public.phase5_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_type TEXT NOT NULL, -- 'recommendation_generated' | 'pattern_detected' | 'mode_change' | 'kill_switch_activated'
  actor_id UUID,
  actor_type TEXT, -- 'system' | 'admin'
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Enable RLS on all Phase 5 tables
ALTER TABLE public.phase5_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase5_agreement_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase5_pattern_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase5_audit_log ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies - Admin/Owner only for Phase 5 tables
CREATE POLICY "Admins can read phase5 recommendations"
ON public.phase5_recommendations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  )
);

CREATE POLICY "System can insert phase5 recommendations"
ON public.phase5_recommendations FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can update phase5 recommendations"
ON public.phase5_recommendations FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  )
);

CREATE POLICY "Admins can read phase5 agreement log"
ON public.phase5_agreement_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  )
);

CREATE POLICY "System can insert phase5 agreement log"
ON public.phase5_agreement_log FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can read phase5 patterns"
ON public.phase5_pattern_observations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  )
);

CREATE POLICY "System can manage phase5 patterns"
ON public.phase5_pattern_observations FOR ALL
USING (true);

CREATE POLICY "Admins can read phase5 audit"
ON public.phase5_audit_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  )
);

CREATE POLICY "System can insert phase5 audit"
ON public.phase5_audit_log FOR INSERT
WITH CHECK (true);

-- 8. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_phase5_recommendations_intent 
ON public.phase5_recommendations(intent_id);

CREATE INDEX IF NOT EXISTS idx_phase5_recommendations_created 
ON public.phase5_recommendations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_phase5_agreement_agreed 
ON public.phase5_agreement_log(agreed);

CREATE INDEX IF NOT EXISTS idx_phase5_patterns_type 
ON public.phase5_pattern_observations(pattern_type);

-- 9. Function to get Phase 5 mode
CREATE OR REPLACE FUNCTION public.get_phase5_mode()
RETURNS JSONB AS $$
DECLARE
  mode_value JSONB;
BEGIN
  SELECT setting_value INTO mode_value
  FROM public.system_settings
  WHERE setting_key = 'phase5_mode';
  
  IF mode_value IS NULL THEN
    RETURN '{"mode": "off", "enabled": false, "kill_switch": false}'::jsonb;
  END IF;
  
  RETURN mode_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 10. Function to set Phase 5 mode (admin only)
CREATE OR REPLACE FUNCTION public.set_phase5_mode(
  p_mode TEXT, -- 'off' | 'shadow' | 'active'
  p_enabled BOOLEAN DEFAULT true,
  p_kill_switch BOOLEAN DEFAULT false
)
RETURNS BOOLEAN AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  -- Check admin status
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  ) INTO is_admin;
  
  IF NOT is_admin THEN
    RAISE EXCEPTION 'Only admins can change Phase 5 mode';
  END IF;
  
  -- Update setting
  INSERT INTO public.system_settings (setting_key, setting_value)
  VALUES (
    'phase5_mode',
    jsonb_build_object('mode', p_mode, 'enabled', p_enabled, 'kill_switch', p_kill_switch)
  )
  ON CONFLICT (setting_key) DO UPDATE
  SET setting_value = jsonb_build_object('mode', p_mode, 'enabled', p_enabled, 'kill_switch', p_kill_switch);
  
  -- Log the change
  INSERT INTO public.phase5_audit_log (action_type, actor_id, actor_type, details)
  VALUES (
    'mode_change',
    auth.uid(),
    'admin',
    jsonb_build_object('new_mode', p_mode, 'enabled', p_enabled, 'kill_switch', p_kill_switch)
  );
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;