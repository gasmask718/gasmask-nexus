
-- =============================================
-- FLOOR 9.2: AI Self-Check RPC (can_ai_perform_action)
-- FLOOR 9.3: Ensure ai_decision_log has enforcement_source column
-- =============================================

-- Add enforcement_source to ai_decision_log if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ai_decision_log'
      AND column_name = 'enforcement_source'
  ) THEN
    ALTER TABLE public.ai_decision_log ADD COLUMN enforcement_source TEXT DEFAULT 'v_ai_effective_permissions';
  END IF;
END $$;

-- Add actor column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ai_decision_log'
      AND column_name = 'actor'
  ) THEN
    ALTER TABLE public.ai_decision_log ADD COLUMN actor TEXT DEFAULT 'ai';
  END IF;
END $$;

-- =============================================
-- FLOOR 9.2: RPC — can_ai_perform_action
-- Deterministic permission check against v_ai_effective_permissions
-- Default: DENY. No inference. No fallback logic.
-- =============================================

CREATE OR REPLACE FUNCTION public.can_ai_perform_action(
  p_action_key TEXT,
  p_neighborhood_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_perm RECORD;
BEGIN
  -- Query the effective permissions view
  SELECT
    allowed,
    reason,
    source
  INTO v_perm
  FROM v_ai_effective_permissions
  WHERE action_key = p_action_key
    AND neighborhood_id = p_neighborhood_id
    AND effective_from <= now()
    AND (effective_until IS NULL OR effective_until > now())
  LIMIT 1;

  -- If no matching row → DEFAULT DENY
  IF NOT FOUND THEN
    v_result := jsonb_build_object(
      'allowed', false,
      'reason', 'default_deny',
      'source', 'default_deny'
    );
  ELSE
    v_result := jsonb_build_object(
      'allowed', COALESCE(v_perm.allowed, false),
      'reason', COALESCE(v_perm.reason, 'no_reason_provided'),
      'source', COALESCE(v_perm.source, 'commitment')
    );
  END IF;

  -- FLOOR 9.3: Log every attempt (allowed AND denied)
  INSERT INTO public.ai_decision_log (
    ai_agent,
    action_key,
    neighborhood_id,
    permission_allowed,
    permission_source,
    blocked_reason,
    decision_payload,
    actor,
    enforcement_source
  ) VALUES (
    'system',
    p_action_key,
    p_neighborhood_id,
    (v_result->>'allowed')::boolean,
    v_result->>'source',
    CASE WHEN (v_result->>'allowed')::boolean = false THEN v_result->>'reason' ELSE NULL END,
    v_result,
    'ai',
    'v_ai_effective_permissions'
  );

  RETURN v_result;
END;
$$;
