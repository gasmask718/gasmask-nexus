
-- ═══════════════════════════════════════════════════════════════════════════════
-- FLOOR 4.5 — Execution Safety & Proof Layer
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Harden complete_territory_task with guardrails
CREATE OR REPLACE FUNCTION public.complete_territory_task(
  p_task_id UUID,
  p_outcome JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task RECORD;
  v_interest TEXT;
  v_notes TEXT;
BEGIN
  SELECT * INTO v_task FROM territory_tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found: %', p_task_id;
  END IF;

  IF v_task.status = 'completed' THEN
    RAISE EXCEPTION 'Task % is already completed', p_task_id;
  END IF;

  v_interest := p_outcome->>'interest_level';
  v_notes := p_outcome->>'notes';

  -- ═══ TASK-TYPE GUARDRAILS ═══
  IF v_task.task_type = 'scout' THEN
    IF (p_outcome->>'scout_classification') IS NULL AND v_interest IS NULL THEN
      RAISE EXCEPTION 'Scout tasks require a classification or interest_level';
    END IF;
  ELSIF v_task.task_type = 'call' THEN
    IF v_interest IS NULL THEN
      RAISE EXCEPTION 'Call tasks require interest_level';
    END IF;
    IF v_notes IS NULL OR trim(v_notes) = '' THEN
      RAISE EXCEPTION 'Call tasks require notes describing the conversation';
    END IF;
  ELSIF v_task.task_type = 'visit' THEN
    IF v_interest IS NULL THEN
      RAISE EXCEPTION 'Visit tasks require an outcome interest_level';
    END IF;
    IF v_notes IS NULL OR trim(v_notes) = '' THEN
      RAISE EXCEPTION 'Visit tasks require notes describing the visit';
    END IF;
  ELSIF v_task.task_type = 'verify' THEN
    IF v_interest IS NULL THEN
      RAISE EXCEPTION 'Verify tasks require an interest_level outcome';
    END IF;
  ELSIF v_task.task_type = 'follow_up' THEN
    IF v_notes IS NULL OR trim(v_notes) = '' THEN
      RAISE EXCEPTION 'Follow-up tasks require notes';
    END IF;
  END IF;

  -- ═══ AI RESTRICTIONS ═══
  IF v_task.assigned_to_type = 'ai' THEN
    IF v_interest = 'verified' OR (p_outcome->>'scout_classification') = 'verified_store' THEN
      RAISE EXCEPTION 'AI workers cannot classify addresses as verified_store — human verification required';
    END IF;
    IF (p_outcome->>'request_promotion')::boolean IS TRUE THEN
      RAISE EXCEPTION 'AI workers cannot request store promotions — human-only action';
    END IF;
  END IF;

  -- ═══ EXECUTE ═══
  UPDATE territory_tasks
  SET status = 'completed', completed_at = now()
  WHERE id = p_task_id;

  -- Update address state
  IF v_task.territory_address_id IS NOT NULL THEN
    IF v_interest = 'not_interested' OR (p_outcome->>'scout_classification') IN ('not_a_store', 'no_tobacco') THEN
      UPDATE territory_addresses
      SET discovery_status = 'dead_end'
      WHERE id = v_task.territory_address_id
        AND discovery_status != 'verified_store';
    ELSIF v_interest IN ('interested', 'very_interested') OR (p_outcome->>'scout_classification') = 'confirmed_candidate' THEN
      UPDATE territory_addresses
      SET discovery_status = 'scouted'
      WHERE id = v_task.territory_address_id
        AND discovery_status = 'unknown';
    END IF;
  END IF;

  -- Update candidate interest
  IF v_task.candidate_id IS NOT NULL AND v_interest IS NOT NULL THEN
    UPDATE territory_store_candidates
    SET interest_level = v_interest
    WHERE id = v_task.candidate_id;
  END IF;

  -- Audit trail
  INSERT INTO territory_activity_log (
    territory_address_id, action_type, actor_type, actor_id, notes
  ) VALUES (
    v_task.territory_address_id,
    'task_completed',
    v_task.assigned_to_type,
    COALESCE(auth.uid(), v_task.assigned_to_id),
    jsonb_build_object(
      'task_id', p_task_id,
      'task_type', v_task.task_type,
      'assigned_to_type', v_task.assigned_to_type,
      'outcome', p_outcome
    )::text
  );
END;
$$;

-- 2. Harden request_store_promotion
CREATE OR REPLACE FUNCTION public.request_store_promotion(
  p_territory_address_id UUID,
  p_candidate_id UUID DEFAULT NULL,
  p_proposed_store_name TEXT DEFAULT NULL,
  p_proposed_contact_name TEXT DEFAULT NULL,
  p_proposed_phone TEXT DEFAULT NULL,
  p_verified_sells_tobacco BOOLEAN DEFAULT FALSE,
  p_verified_sells_grabba BOOLEAN DEFAULT FALSE,
  p_verification_method TEXT DEFAULT 'visit'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promo_id UUID;
BEGIN
  -- Mandatory fields
  IF p_proposed_store_name IS NULL OR trim(p_proposed_store_name) = '' THEN
    RAISE EXCEPTION 'Promotion requires a proposed store name';
  END IF;
  IF p_proposed_contact_name IS NULL OR trim(p_proposed_contact_name) = '' THEN
    RAISE EXCEPTION 'Promotion requires a proposed contact name';
  END IF;
  IF p_verification_method NOT IN ('visit', 'call', 'wholesaler_confirmation') THEN
    RAISE EXCEPTION 'Invalid verification method: %', p_verification_method;
  END IF;

  -- Address must exist
  IF NOT EXISTS (SELECT 1 FROM territory_addresses WHERE id = p_territory_address_id) THEN
    RAISE EXCEPTION 'Territory address not found: %', p_territory_address_id;
  END IF;

  -- No duplicate pending promotions
  IF EXISTS (SELECT 1 FROM territory_store_promotions WHERE territory_address_id = p_territory_address_id AND status = 'pending') THEN
    RAISE EXCEPTION 'A pending promotion already exists for this address';
  END IF;

  -- No re-promotion of approved addresses
  IF EXISTS (SELECT 1 FROM territory_store_promotions WHERE territory_address_id = p_territory_address_id AND status = 'approved') THEN
    RAISE EXCEPTION 'This address has already been promoted to a CRM store';
  END IF;

  INSERT INTO territory_store_promotions (
    territory_address_id, candidate_id, proposed_store_name, proposed_contact_name,
    proposed_phone, verified_sells_tobacco, verified_sells_grabba,
    verification_method, verified_by, verified_at, status
  ) VALUES (
    p_territory_address_id, p_candidate_id, trim(p_proposed_store_name),
    trim(p_proposed_contact_name), NULLIF(trim(COALESCE(p_proposed_phone, '')), ''),
    p_verified_sells_tobacco, p_verified_sells_grabba,
    p_verification_method, auth.uid(), now(), 'pending'
  )
  RETURNING id INTO v_promo_id;

  -- Audit
  INSERT INTO territory_activity_log (
    territory_address_id, action_type, actor_type, actor_id, notes
  ) VALUES (
    p_territory_address_id, 'promotion_requested', 'human', auth.uid(),
    jsonb_build_object(
      'promotion_id', v_promo_id,
      'store_name', p_proposed_store_name,
      'contact_name', p_proposed_contact_name,
      'verification_method', p_verification_method
    )::text
  );

  RETURN v_promo_id;
END;
$$;

-- 3. Execution Proof View (read-only forensic trail)
CREATE OR REPLACE VIEW public.v_territory_execution_proof AS
SELECT
  t.id AS task_id,
  t.task_type,
  t.assigned_to_type,
  t.assigned_to_id,
  t.priority,
  t.required_outcome,
  t.status AS task_status,
  t.created_at AS task_created_at,
  t.completed_at AS task_completed_at,
  ta.full_address,
  ta.city,
  ta.discovery_status AS current_address_status,
  al.action_type AS logged_action,
  al.actor_type AS completed_by_type,
  al.actor_id AS completed_by_id,
  al.notes AS outcome_raw,
  al.created_at AS logged_at
FROM territory_tasks t
LEFT JOIN territory_addresses ta ON ta.id = t.territory_address_id
LEFT JOIN territory_activity_log al ON (
  al.notes LIKE '%' || t.id::text || '%'
  AND al.action_type = 'task_completed'
)
WHERE t.status = 'completed';

GRANT SELECT ON public.v_territory_execution_proof TO authenticated;
