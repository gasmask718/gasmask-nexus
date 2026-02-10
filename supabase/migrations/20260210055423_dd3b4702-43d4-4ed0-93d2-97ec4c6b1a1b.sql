
-- Floor 9.1: Permission Resolution Engine
-- Deterministically converts Floor 8 commitments into Floor 9 permissions

-- ============================================================
-- 1. Commitment-to-Permission mapping function
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolve_permissions_for_commitment(
  p_commitment_id UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_commitment RECORD;
  v_action RECORD;
  v_allowed BOOLEAN;
  v_reason TEXT;
BEGIN
  -- Fetch the commitment
  SELECT * INTO v_commitment
  FROM territory_commitments
  WHERE id = p_commitment_id AND is_active = TRUE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Expire all existing permissions for this neighborhood tied to any prior commitment
  UPDATE territory_ai_permissions
  SET effective_until = now()
  WHERE neighborhood_id = v_commitment.neighborhood_id
    AND (effective_until IS NULL OR effective_until > now());

  -- For each registered action, determine permission
  FOR v_action IN SELECT action_key, category, is_destructive, requires_human_review FROM ai_action_registry
  LOOP
    v_allowed := FALSE;
    v_reason := 'default_deny';

    -- Hard constraint: if human_only, deny everything
    IF v_commitment.human_only = TRUE THEN
      v_allowed := FALSE;
      v_reason := 'constraint:human_only';

    -- Hard constraint: if ai_allowed is false, deny everything
    ELSIF v_commitment.ai_allowed = FALSE THEN
      v_allowed := FALSE;
      v_reason := 'constraint:ai_not_allowed';

    -- Frozen territories: deny all except observe
    ELSIF v_commitment.commitment_type = 'freeze' THEN
      IF v_action.action_key = 'observe_only' THEN
        v_allowed := TRUE;
        v_reason := 'freeze:observe_permitted';
      ELSE
        v_allowed := FALSE;
        v_reason := 'freeze:all_actions_blocked';
      END IF;

    -- Exit territories: deny everything
    ELSIF v_commitment.commitment_type = 'exit' THEN
      v_allowed := FALSE;
      v_reason := 'exit:territory_abandoned';

    -- Observe territories: only observe + analyze
    ELSIF v_commitment.commitment_type = 'observe' THEN
      IF v_action.action_key IN ('observe_only', 'analyze_gaps') THEN
        v_allowed := TRUE;
        v_reason := 'observe:passive_actions_only';
      ELSE
        v_allowed := FALSE;
        v_reason := 'observe:active_actions_blocked';
      END IF;

    -- Maintain territories: allow non-destructive actions
    ELSIF v_commitment.commitment_type = 'maintain' THEN
      IF v_action.is_destructive = TRUE THEN
        v_allowed := FALSE;
        v_reason := 'maintain:destructive_blocked';
      ELSE
        v_allowed := TRUE;
        v_reason := 'maintain:non_destructive_allowed';
      END IF;

    -- Dominate territories: allow all actions
    ELSIF v_commitment.commitment_type = 'dominate' THEN
      v_allowed := TRUE;
      v_reason := 'dominate:full_access';
    END IF;

    -- Apply additional constraints
    IF v_allowed = TRUE AND v_commitment.no_outbound_contact = TRUE THEN
      IF v_action.action_key IN ('call_store', 'send_follow_up') THEN
        v_allowed := FALSE;
        v_reason := v_reason || '+constraint:no_outbound_contact';
      END IF;
    END IF;

    IF v_allowed = TRUE AND v_commitment.no_new_promotions = TRUE THEN
      IF v_action.action_key = 'suggest_promotion' THEN
        v_allowed := FALSE;
        v_reason := v_reason || '+constraint:no_new_promotions';
      END IF;
    END IF;

    IF v_allowed = TRUE AND v_commitment.wholesaler_only_verification = TRUE THEN
      IF v_action.action_key = 'scout_address' THEN
        v_reason := v_reason || '+wholesaler_verification_required';
      END IF;
    END IF;

    -- Insert the resolved permission
    INSERT INTO territory_ai_permissions (
      neighborhood_id,
      commitment_id,
      action_key,
      allowed,
      reason,
      source,
      effective_from,
      created_by
    ) VALUES (
      v_commitment.neighborhood_id,
      v_commitment.id,
      v_action.action_key,
      v_allowed,
      v_reason,
      'commitment',
      now(),
      v_commitment.created_by
    );
  END LOOP;
END;
$$;

-- ============================================================
-- 2. Trigger: auto-resolve on commitment insert
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_resolve_permissions_on_commit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active = TRUE THEN
    PERFORM resolve_permissions_for_commitment(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_resolve_permissions_on_insert
  AFTER INSERT ON public.territory_commitments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_resolve_permissions_on_commit();

-- ============================================================
-- 3. Trigger: re-resolve when commitment is updated
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_resolve_permissions_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If commitment was deactivated, expire its permissions
  IF OLD.is_active = TRUE AND NEW.is_active = FALSE THEN
    UPDATE territory_ai_permissions
    SET effective_until = now()
    WHERE commitment_id = OLD.id
      AND (effective_until IS NULL OR effective_until > now());
  END IF;

  -- If commitment was reactivated or constraints changed, re-resolve
  IF NEW.is_active = TRUE AND (
    OLD.is_active = FALSE
    OR OLD.commitment_type IS DISTINCT FROM NEW.commitment_type
    OR OLD.ai_allowed IS DISTINCT FROM NEW.ai_allowed
    OR OLD.human_only IS DISTINCT FROM NEW.human_only
    OR OLD.no_outbound_contact IS DISTINCT FROM NEW.no_outbound_contact
    OR OLD.no_new_promotions IS DISTINCT FROM NEW.no_new_promotions
    OR OLD.wholesaler_only_verification IS DISTINCT FROM NEW.wholesaler_only_verification
  ) THEN
    PERFORM resolve_permissions_for_commitment(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_resolve_permissions_on_update
  AFTER UPDATE ON public.territory_commitments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_resolve_permissions_on_update();

-- ============================================================
-- 4. Backfill: resolve permissions for all existing active commitments
-- ============================================================
DO $$
DECLARE
  v_id UUID;
BEGIN
  FOR v_id IN SELECT id FROM territory_commitments WHERE is_active = TRUE
  LOOP
    PERFORM resolve_permissions_for_commitment(v_id);
  END LOOP;
END;
$$;
