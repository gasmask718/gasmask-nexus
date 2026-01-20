-- =============================================================
-- PHASE 4: CONTROLLED AUTONOMY, INTENT RESOLUTION & OPERATIONAL INTELLIGENCE
-- =============================================================

-- -------------------------------------------------------------
-- 1. AUTONOMY ENVELOPES (Core → Edge contracts)
-- -------------------------------------------------------------
CREATE TABLE public.autonomy_envelopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  envelope_name TEXT NOT NULL,
  description TEXT,
  
  -- Scope
  portal_type TEXT NOT NULL CHECK (portal_type IN ('driver', 'biker')),
  role_id UUID REFERENCES public.profiles(id),
  device_id UUID REFERENCES public.portal_devices(id),
  assignment_id UUID,
  store_ids UUID[] DEFAULT '{}',
  route_ids UUID[] DEFAULT '{}',
  
  -- Permissions
  allowed_intent_types TEXT[] NOT NULL DEFAULT '{}',
  decision_thresholds JSONB DEFAULT '{}',
  max_impact JSONB DEFAULT '{}',
  required_evidence TEXT[] DEFAULT '{}',
  escalation_rules JSONB DEFAULT '{}',
  
  -- Time bounds
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  time_window_start TIME,
  time_window_end TIME,
  
  -- Signature & status
  core_signature TEXT,
  is_active BOOLEAN DEFAULT true,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  revocation_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_autonomy_envelopes_device ON public.autonomy_envelopes(device_id) WHERE is_active = true;
CREATE INDEX idx_autonomy_envelopes_portal ON public.autonomy_envelopes(portal_type) WHERE is_active = true;

-- -------------------------------------------------------------
-- 2. INTENT ENVELOPES (Edge → Core requests)
-- -------------------------------------------------------------
CREATE TABLE public.intent_envelopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  
  origin_action_ids UUID[] NOT NULL DEFAULT '{}',
  portal_type TEXT NOT NULL CHECK (portal_type IN ('driver', 'biker')),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  device_id UUID NOT NULL REFERENCES public.portal_devices(id),
  assignment_id UUID,
  shift_id UUID,
  
  intent_type TEXT NOT NULL,
  confidence_level NUMERIC(3,2) CHECK (confidence_level BETWEEN 0 AND 1),
  constraints_seen TEXT[] DEFAULT '{}',
  proposed_effect JSONB NOT NULL,
  supporting_evidence JSONB DEFAULT '{}',
  
  client_timestamp TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ DEFAULT now(),
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'accepted', 'modified', 'deferred', 'rejected', 'escalated'
  )),
  
  autonomy_envelope_id UUID REFERENCES public.autonomy_envelopes(id),
  autonomy_validated BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_intent_envelopes_status ON public.intent_envelopes(status);
CREATE INDEX idx_intent_envelopes_device ON public.intent_envelopes(device_id);
CREATE INDEX idx_intent_envelopes_user ON public.intent_envelopes(user_id);
CREATE INDEX idx_intent_envelopes_pending ON public.intent_envelopes(status) WHERE status = 'pending';

-- -------------------------------------------------------------
-- 3. INTENT RESOLUTIONS (Decision records)
-- -------------------------------------------------------------
CREATE TABLE public.intent_resolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID NOT NULL REFERENCES public.intent_envelopes(intent_id),
  
  outcome TEXT NOT NULL CHECK (outcome IN (
    'accepted', 'modified', 'deferred', 'rejected', 'escalated'
  )),
  
  reason_codes TEXT[] NOT NULL DEFAULT '{}',
  explanation TEXT,
  resolution_rules_applied TEXT[] DEFAULT '{}',
  
  competing_intent_ids UUID[] DEFAULT '{}',
  conflict_resolution_method TEXT,
  why_this_intent_won TEXT,
  
  original_effect JSONB,
  modified_effect JSONB,
  
  confidence_score NUMERIC(3,2),
  evidence_score NUMERIC(3,2),
  trust_score NUMERIC(3,2),
  
  was_auto_resolved BOOLEAN DEFAULT true,
  override_by UUID REFERENCES auth.users(id),
  override_reason TEXT,
  override_at TIMESTAMPTZ,
  
  resolved_at TIMESTAMPTZ DEFAULT now(),
  resolver_version TEXT DEFAULT 'v1.0'
);

CREATE INDEX idx_intent_resolutions_intent ON public.intent_resolutions(intent_id);
CREATE INDEX idx_intent_resolutions_outcome ON public.intent_resolutions(outcome);

-- -------------------------------------------------------------
-- 4. CONFLICT LOGS
-- -------------------------------------------------------------
CREATE TYPE public.conflict_class AS ENUM (
  'temporal',
  'resource',
  'authority',
  'evidence',
  'integrity'
);

CREATE TABLE public.conflict_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  conflict_class public.conflict_class NOT NULL,
  conflict_type TEXT NOT NULL,
  description TEXT NOT NULL,
  
  intent_ids UUID[] NOT NULL,
  primary_intent_id UUID REFERENCES public.intent_envelopes(intent_id),
  
  conflicting_values JSONB NOT NULL,
  temporal_details JSONB,
  
  resolution_method TEXT,
  winning_intent_id UUID,
  resolution_explanation TEXT,
  
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  requires_human_review BOOLEAN DEFAULT false,
  
  detected_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_conflict_logs_class ON public.conflict_logs(conflict_class);
CREATE INDEX idx_conflict_logs_unresolved ON public.conflict_logs(resolved_at) WHERE resolved_at IS NULL;

-- -------------------------------------------------------------
-- 5. AUTONOMY VIOLATIONS
-- -------------------------------------------------------------
CREATE TABLE public.autonomy_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID REFERENCES public.intent_envelopes(intent_id),
  device_id UUID REFERENCES public.portal_devices(id),
  user_id UUID REFERENCES auth.users(id),
  
  violation_type TEXT NOT NULL,
  envelope_id UUID REFERENCES public.autonomy_envelopes(id),
  attempted_action TEXT NOT NULL,
  exceeded_limit JSONB,
  
  assignment_id UUID,
  portal_type TEXT,
  
  auto_response TEXT,
  autonomy_reduced BOOLEAN DEFAULT false,
  device_quarantined BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_autonomy_violations_device ON public.autonomy_violations(device_id);

-- -------------------------------------------------------------
-- 6. OPERATIONAL SIGNALS
-- -------------------------------------------------------------
CREATE TABLE public.operational_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  signal_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  
  signal_value NUMERIC NOT NULL,
  previous_value NUMERIC,
  trend TEXT CHECK (trend IN ('improving', 'stable', 'declining')),
  
  computation_method TEXT NOT NULL,
  data_points_used INTEGER,
  confidence NUMERIC(3,2),
  
  computed_at TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ,
  
  contributing_factors JSONB DEFAULT '{}'
);

CREATE INDEX idx_operational_signals_entity ON public.operational_signals(entity_type, entity_id);
CREATE INDEX idx_operational_signals_type ON public.operational_signals(signal_type);

-- -------------------------------------------------------------
-- 7. INTENT REVIEW QUEUE
-- -------------------------------------------------------------
CREATE TABLE public.intent_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID NOT NULL REFERENCES public.intent_envelopes(intent_id),
  
  priority INTEGER DEFAULT 50,
  reason_for_review TEXT NOT NULL,
  suggested_action TEXT,
  
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'decided')),
  assigned_to UUID REFERENCES auth.users(id),
  
  decision TEXT CHECK (decision IN ('approve', 'reject', 'amend')),
  decision_notes TEXT,
  amended_effect JSONB,
  
  queued_at TIMESTAMPTZ DEFAULT now(),
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_intent_review_queue_pending ON public.intent_review_queue(status, priority) WHERE status = 'pending';

-- -------------------------------------------------------------
-- 8. RESOLUTION ENGINE FUNCTIONS
-- -------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.validate_intent_autonomy(
  p_intent_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_intent RECORD;
  v_envelope RECORD;
BEGIN
  SELECT * INTO v_intent FROM intent_envelopes WHERE intent_id = p_intent_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'intent_not_found');
  END IF;
  
  SELECT * INTO v_envelope 
  FROM autonomy_envelopes 
  WHERE is_active = true
    AND portal_type = v_intent.portal_type
    AND (device_id IS NULL OR device_id = v_intent.device_id)
    AND (valid_until IS NULL OR valid_until > now())
    AND v_intent.intent_type = ANY(allowed_intent_types)
  ORDER BY 
    CASE WHEN device_id IS NOT NULL THEN 0 ELSE 1 END,
    created_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false, 
      'reason', 'no_autonomy_envelope',
      'intent_type', v_intent.intent_type
    );
  END IF;
  
  IF v_envelope.required_evidence IS NOT NULL AND array_length(v_envelope.required_evidence, 1) > 0 THEN
    FOR i IN 1..array_length(v_envelope.required_evidence, 1) LOOP
      IF NOT (v_intent.supporting_evidence ? v_envelope.required_evidence[i]) THEN
        RETURN jsonb_build_object(
          'valid', false,
          'reason', 'missing_evidence',
          'required', v_envelope.required_evidence[i]
        );
      END IF;
    END LOOP;
  END IF;
  
  UPDATE intent_envelopes 
  SET autonomy_envelope_id = v_envelope.id,
      autonomy_validated = true
  WHERE intent_id = p_intent_id;
  
  RETURN jsonb_build_object(
    'valid', true,
    'envelope_id', v_envelope.id,
    'envelope_name', v_envelope.envelope_name,
    'max_impact', v_envelope.max_impact
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.detect_intent_conflicts(
  p_intent_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_intent RECORD;
  v_conflicts JSONB := '[]'::jsonb;
  v_conflict RECORD;
BEGIN
  SELECT * INTO v_intent FROM intent_envelopes WHERE intent_id = p_intent_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'intent_not_found');
  END IF;
  
  FOR v_conflict IN
    SELECT ie.intent_id, ie.intent_type, ie.client_timestamp, ie.proposed_effect
    FROM intent_envelopes ie
    WHERE ie.intent_id != p_intent_id
      AND ie.assignment_id = v_intent.assignment_id
      AND ie.status IN ('pending', 'processing')
      AND ABS(EXTRACT(EPOCH FROM (ie.client_timestamp - v_intent.client_timestamp))) < 300
  LOOP
    v_conflicts := v_conflicts || jsonb_build_object(
      'class', 'temporal',
      'conflicting_intent_id', v_conflict.intent_id,
      'description', format('Overlapping intent within 5 minutes: %s', v_conflict.intent_type)
    );
  END LOOP;
  
  FOR v_conflict IN
    SELECT ie.intent_id, ie.intent_type, ie.proposed_effect
    FROM intent_envelopes ie
    WHERE ie.intent_id != p_intent_id
      AND ie.status IN ('pending', 'processing')
      AND ie.proposed_effect->>'target_id' = v_intent.proposed_effect->>'target_id'
      AND ie.proposed_effect->>'target_id' IS NOT NULL
  LOOP
    v_conflicts := v_conflicts || jsonb_build_object(
      'class', 'resource',
      'conflicting_intent_id', v_conflict.intent_id,
      'description', format('Same target resource: %s', v_conflict.proposed_effect->>'target_id')
    );
  END LOOP;
  
  IF jsonb_array_length(v_conflicts) > 0 THEN
    INSERT INTO conflict_logs (
      conflict_class,
      conflict_type,
      description,
      intent_ids,
      primary_intent_id,
      conflicting_values
    )
    SELECT 
      (c->>'class')::conflict_class,
      'auto_detected',
      c->>'description',
      ARRAY[p_intent_id, (c->>'conflicting_intent_id')::uuid],
      p_intent_id,
      c
    FROM jsonb_array_elements(v_conflicts) c;
  END IF;
  
  RETURN jsonb_build_object(
    'has_conflicts', jsonb_array_length(v_conflicts) > 0,
    'conflict_count', jsonb_array_length(v_conflicts),
    'conflicts', v_conflicts
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_intent(
  p_intent_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_intent RECORD;
  v_autonomy_result JSONB;
  v_conflict_result JSONB;
  v_outcome TEXT;
  v_reason_codes TEXT[] := '{}';
  v_explanation TEXT;
  v_resolution_id UUID;
BEGIN
  SELECT * INTO v_intent FROM intent_envelopes WHERE intent_id = p_intent_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'intent_not_found');
  END IF;
  
  IF v_intent.status NOT IN ('pending', 'processing') THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_resolved', 'status', v_intent.status);
  END IF;
  
  UPDATE intent_envelopes SET status = 'processing' WHERE intent_id = p_intent_id;
  
  v_autonomy_result := validate_intent_autonomy(p_intent_id);
  IF NOT (v_autonomy_result->>'valid')::boolean THEN
    v_outcome := 'rejected';
    v_reason_codes := v_reason_codes || ARRAY[v_autonomy_result->>'reason'];
    v_explanation := format('Autonomy validation failed: %s', v_autonomy_result->>'reason');
    
    INSERT INTO autonomy_violations (
      intent_id, device_id, user_id, violation_type,
      attempted_action, portal_type
    ) VALUES (
      p_intent_id, v_intent.device_id, v_intent.user_id,
      v_autonomy_result->>'reason', v_intent.intent_type, v_intent.portal_type
    );
  ELSE
    v_conflict_result := detect_intent_conflicts(p_intent_id);
    
    IF (v_conflict_result->>'has_conflicts')::boolean THEN
      v_outcome := 'escalated';
      v_reason_codes := v_reason_codes || ARRAY['conflict_detected'];
      v_explanation := format('Conflicts detected: %s', v_conflict_result->>'conflict_count');
      
      INSERT INTO intent_review_queue (intent_id, reason_for_review, priority)
      VALUES (p_intent_id, 'Conflicts detected requiring human review', 75);
    ELSE
      v_outcome := 'accepted';
      v_reason_codes := v_reason_codes || ARRAY['autonomy_valid', 'no_conflicts'];
      v_explanation := 'Intent validated and accepted within autonomy bounds';
    END IF;
  END IF;
  
  INSERT INTO intent_resolutions (
    intent_id, outcome, reason_codes, explanation,
    confidence_score, was_auto_resolved, resolver_version
  ) VALUES (
    p_intent_id, v_outcome, v_reason_codes, v_explanation,
    v_intent.confidence_level, true, 'v1.0'
  ) RETURNING id INTO v_resolution_id;
  
  UPDATE intent_envelopes SET status = v_outcome WHERE intent_id = p_intent_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'intent_id', p_intent_id,
    'outcome', v_outcome,
    'resolution_id', v_resolution_id,
    'reason_codes', v_reason_codes,
    'explanation', v_explanation
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.compute_device_reliability(
  p_device_id UUID
) RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total_intents INTEGER;
  v_accepted_intents INTEGER;
  v_violations INTEGER;
  v_reliability NUMERIC;
BEGIN
  SELECT COUNT(*) INTO v_total_intents
  FROM intent_envelopes
  WHERE device_id = p_device_id
    AND created_at > now() - interval '30 days';
  
  SELECT COUNT(*) INTO v_accepted_intents
  FROM intent_envelopes ie
  JOIN intent_resolutions ir ON ie.intent_id = ir.intent_id
  WHERE ie.device_id = p_device_id
    AND ie.created_at > now() - interval '30 days'
    AND ir.outcome = 'accepted';
  
  SELECT COUNT(*) INTO v_violations
  FROM autonomy_violations
  WHERE device_id = p_device_id
    AND created_at > now() - interval '30 days';
  
  IF v_total_intents = 0 THEN
    v_reliability := 0.5;
  ELSE
    v_reliability := (v_accepted_intents::numeric / v_total_intents) 
                     - (v_violations::numeric * 0.1);
    v_reliability := GREATEST(0, LEAST(1, v_reliability));
  END IF;
  
  INSERT INTO operational_signals (
    signal_type, entity_type, entity_id, signal_value,
    computation_method, data_points_used, confidence
  ) VALUES (
    'device_reliability', 'device', p_device_id, v_reliability,
    'accepted_ratio_minus_violations', v_total_intents, 
    CASE WHEN v_total_intents > 20 THEN 0.9 ELSE 0.5 END
  );
  
  RETURN v_reliability;
END;
$$;

CREATE OR REPLACE FUNCTION public.override_intent_resolution(
  p_intent_id UUID,
  p_decision TEXT,
  p_notes TEXT DEFAULT NULL,
  p_amended_effect JSONB DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_new_outcome TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  
  v_new_outcome := CASE p_decision
    WHEN 'approve' THEN 'accepted'
    WHEN 'reject' THEN 'rejected'
    WHEN 'amend' THEN 'modified'
    ELSE 'rejected'
  END;
  
  UPDATE intent_resolutions
  SET was_auto_resolved = false,
      override_by = v_user_id,
      override_reason = p_notes,
      override_at = now(),
      outcome = v_new_outcome,
      modified_effect = p_amended_effect
  WHERE intent_id = p_intent_id;
  
  UPDATE intent_envelopes SET status = v_new_outcome WHERE intent_id = p_intent_id;
  
  UPDATE intent_review_queue
  SET status = 'decided',
      decision = p_decision,
      decision_notes = p_notes,
      amended_effect = p_amended_effect,
      decided_at = now(),
      decided_by = v_user_id
  WHERE intent_id = p_intent_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'intent_id', p_intent_id,
    'new_outcome', v_new_outcome,
    'overridden_by', v_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_intent_queue_health()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'pending_intents', (SELECT COUNT(*) FROM intent_envelopes WHERE status = 'pending'),
    'escalated_intents', (SELECT COUNT(*) FROM intent_envelopes WHERE status = 'escalated'),
    'review_queue_size', (SELECT COUNT(*) FROM intent_review_queue WHERE status = 'pending'),
    'unresolved_conflicts', (SELECT COUNT(*) FROM conflict_logs WHERE resolved_at IS NULL),
    'violations_today', (SELECT COUNT(*) FROM autonomy_violations WHERE created_at > now() - interval '1 day'),
    'resolution_rates', (
      SELECT COALESCE(jsonb_object_agg(outcome, cnt), '{}'::jsonb)
      FROM (
        SELECT outcome, COUNT(*) as cnt
        FROM intent_resolutions
        WHERE resolved_at > now() - interval '7 days'
        GROUP BY outcome
      ) sub
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- -------------------------------------------------------------
-- 9. RLS POLICIES
-- -------------------------------------------------------------

ALTER TABLE public.autonomy_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intent_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intent_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conflict_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autonomy_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intent_review_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage autonomy envelopes"
  ON public.autonomy_envelopes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Portal users read own autonomy"
  ON public.autonomy_envelopes FOR SELECT
  USING (
    device_id IN (SELECT id FROM portal_devices WHERE user_id = auth.uid())
    OR role_id = auth.uid()
  );

CREATE POLICY "Users see own intents"
  ON public.intent_envelopes FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users create own intents"
  ON public.intent_envelopes FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins manage intents"
  ON public.intent_envelopes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users read own resolutions"
  ON public.intent_resolutions FOR SELECT
  USING (
    intent_id IN (SELECT intent_id FROM intent_envelopes WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins manage resolutions"
  ON public.intent_resolutions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins manage conflicts"
  ON public.conflict_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users see own violations"
  ON public.autonomy_violations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins manage violations"
  ON public.autonomy_violations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins manage signals"
  ON public.operational_signals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins manage review queue"
  ON public.intent_review_queue FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('owner', 'admin')
    )
  );

-- -------------------------------------------------------------
-- 10. TRIGGER
-- -------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_autonomy_envelope_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_autonomy_envelope_updated
BEFORE UPDATE ON public.autonomy_envelopes
FOR EACH ROW EXECUTE FUNCTION update_autonomy_envelope_timestamp();