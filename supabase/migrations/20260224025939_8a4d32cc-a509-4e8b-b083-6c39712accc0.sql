
-- Phase D: Agent State Machine + Safe Claim Engine

-- 1. Add claim locking columns to outbound_call_queue
ALTER TABLE public.outbound_call_queue 
  ADD COLUMN IF NOT EXISTS claimed_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS claim_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS claim_token uuid;

-- 2. Add throttle settings to dialer_settings
ALTER TABLE public.dialer_settings
  ADD COLUMN IF NOT EXISTS max_calls_per_minute integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS max_simultaneous_dials integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS connect_rate_target numeric DEFAULT 0.18;

-- 3. Server-side agent state transition validation function
CREATE OR REPLACE FUNCTION public.validate_agent_state_transition(
  p_current_status text,
  p_new_status text
) RETURNS boolean AS $$
BEGIN
  RETURN CASE
    WHEN p_current_status = 'offline' AND p_new_status = 'available' THEN true
    WHEN p_current_status = 'available' AND p_new_status = 'dialing' THEN true
    WHEN p_current_status = 'available' AND p_new_status = 'busy' THEN true
    WHEN p_current_status = 'dialing' AND p_new_status = 'bridged' THEN true
    WHEN p_current_status = 'dialing' AND p_new_status = 'available' THEN true
    WHEN p_current_status = 'bridged' AND p_new_status = 'wrap_up' THEN true
    WHEN p_current_status = 'busy' AND p_new_status = 'wrap_up' THEN true
    WHEN p_current_status = 'wrap_up' AND p_new_status = 'available' THEN true
    -- Allow admin override to offline from any state
    WHEN p_new_status = 'offline' THEN true
    ELSE false
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Trigger to enforce agent state transitions
CREATE OR REPLACE FUNCTION public.enforce_agent_state_transition()
RETURNS trigger AS $$
BEGIN
  IF OLD.status IS NOT NULL AND NEW.status != OLD.status THEN
    IF NOT public.validate_agent_state_transition(OLD.status, NEW.status) THEN
      RAISE EXCEPTION 'Invalid agent state transition: % → %', OLD.status, NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_agent_state ON public.dialer_agent_availability;
CREATE TRIGGER trg_enforce_agent_state
  BEFORE UPDATE ON public.dialer_agent_availability
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_agent_state_transition();

-- 5. Updated claim_queue_items with DNC check and claim fields
CREATE OR REPLACE FUNCTION public.claim_queue_items(
  p_business_id uuid,
  p_campaign_id uuid DEFAULT NULL,
  p_limit_count integer DEFAULT 5,
  p_max_attempts integer DEFAULT 3,
  p_agent_user_id uuid DEFAULT NULL
) RETURNS SETOF public.outbound_call_queue AS $$
DECLARE
  v_claim_token uuid := gen_random_uuid();
BEGIN
  RETURN QUERY
  WITH claimable AS (
    SELECT q.id
    FROM public.outbound_call_queue q
    LEFT JOIN public.store_master sm ON sm.id = q.store_id
    WHERE q.business_id = p_business_id
      AND q.status = 'queued'
      AND q.attempt_count < p_max_attempts
      AND (p_campaign_id IS NULL OR q.campaign_id = p_campaign_id)
      AND (q.next_retry_at IS NULL OR q.next_retry_at <= now())
      AND (q.claim_expires_at IS NULL OR q.claim_expires_at < now())
      AND COALESCE(sm.do_not_call, false) = false
    ORDER BY q.priority_score DESC NULLS LAST, q.created_at ASC
    LIMIT p_limit_count
    FOR UPDATE OF q SKIP LOCKED
  )
  UPDATE public.outbound_call_queue oq
  SET status = 'dialing',
      last_attempt_at = now(),
      attempt_count = oq.attempt_count + 1,
      dialing_started_at = now(),
      updated_at = now(),
      claimed_by_user_id = p_agent_user_id,
      claimed_at = now(),
      claim_expires_at = now() + interval '90 seconds',
      claim_token = v_claim_token
  FROM claimable c
  WHERE oq.id = c.id
  RETURNING oq.*;
END;
$$ LANGUAGE plpgsql;

-- 6. Updated claim_available_agent with concurrency check
CREATE OR REPLACE FUNCTION public.claim_available_agent(
  p_business_id uuid
) RETURNS SETOF public.dialer_agent_availability AS $$
BEGIN
  RETURN QUERY
  WITH agent AS (
    SELECT id
    FROM public.dialer_agent_availability
    WHERE business_id = p_business_id
      AND status = 'available'
      AND active_calls_count < COALESCE(max_concurrent_calls, 1)
    ORDER BY updated_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.dialer_agent_availability da
  SET status = 'busy',
      active_calls_count = da.active_calls_count + 1,
      updated_at = now()
  FROM agent a
  WHERE da.id = a.id
  RETURNING da.*;
END;
$$ LANGUAGE plpgsql;

-- 7. Claim expiration watchdog RPC
CREATE OR REPLACE FUNCTION public.dialer_claim_watchdog(
  p_business_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_expired_claims integer := 0;
  v_stuck_dialing integer := 0;
  v_stuck_answered integer := 0;
  v_crashed_sessions integer := 0;
  v_dnc_blocked integer := 0;
BEGIN
  -- Expired claims: dialing with expired claim and no session
  WITH expired AS (
    UPDATE public.outbound_call_queue
    SET status = 'queued',
        claimed_by_user_id = NULL,
        claimed_at = NULL,
        claim_expires_at = NULL,
        claim_token = NULL,
        updated_at = now()
    WHERE business_id = p_business_id
      AND status = 'dialing'
      AND claim_expires_at IS NOT NULL
      AND claim_expires_at < now()
      AND id NOT IN (
        SELECT queue_item_id FROM public.live_call_sessions 
        WHERE queue_item_id IS NOT NULL AND ended_at IS NULL
      )
    RETURNING id
  )
  SELECT count(*) INTO v_expired_claims FROM expired;

  -- Stuck dialing > 2 minutes with no claim expiry set
  WITH stuck AS (
    UPDATE public.outbound_call_queue
    SET status = 'failed',
        next_retry_at = now() + interval '10 minutes',
        claimed_by_user_id = NULL,
        claimed_at = NULL,
        claim_expires_at = NULL,
        claim_token = NULL,
        updated_at = now()
    WHERE business_id = p_business_id
      AND status = 'dialing'
      AND dialing_started_at < now() - interval '2 minutes'
    RETURNING id
  )
  SELECT count(*) INTO v_stuck_dialing FROM stuck;

  -- Stuck answered > 60 seconds with no session
  WITH stuck_ans AS (
    UPDATE public.outbound_call_queue
    SET status = 'queued',
        next_retry_at = now() + interval '10 minutes',
        claimed_by_user_id = NULL,
        claimed_at = NULL,
        claim_expires_at = NULL,
        claim_token = NULL,
        updated_at = now()
    WHERE business_id = p_business_id
      AND status = 'answered'
      AND answered_at < now() - interval '60 seconds'
    RETURNING id
  )
  SELECT count(*) INTO v_stuck_answered FROM stuck_ans;

  -- Crashed sessions: active session but agent offline > 2 min
  WITH crashed AS (
    UPDATE public.live_call_sessions ls
    SET ended_at = now(),
        outcome = 'agent_crash',
        duration_seconds = EXTRACT(EPOCH FROM (now() - ls.connected_at))::integer
    FROM public.dialer_agent_availability da
    WHERE ls.business_id = p_business_id
      AND ls.ended_at IS NULL
      AND ls.rep_user_id = da.user_id
      AND da.status = 'offline'
      AND ls.connected_at < now() - interval '2 minutes'
    RETURNING ls.id, ls.rep_user_id
  )
  SELECT count(*) INTO v_crashed_sessions FROM crashed;

  -- DNC compliance: auto-complete any queued items for DNC stores
  WITH dnc AS (
    UPDATE public.outbound_call_queue q
    SET status = 'completed',
        updated_at = now()
    FROM public.store_master sm
    WHERE q.business_id = p_business_id
      AND q.store_id = sm.id
      AND sm.do_not_call = true
      AND q.status IN ('queued', 'dialing')
    RETURNING q.id
  )
  SELECT count(*) INTO v_dnc_blocked FROM dnc;

  RETURN jsonb_build_object(
    'expired_claims', v_expired_claims,
    'stuck_dialing', v_stuck_dialing,
    'stuck_answered', v_stuck_answered,
    'crashed_sessions', v_crashed_sessions,
    'dnc_blocked', v_dnc_blocked,
    'total_recovered', v_expired_claims + v_stuck_dialing + v_stuck_answered + v_crashed_sessions + v_dnc_blocked
  );
END;
$$ LANGUAGE plpgsql;

-- 8. Update the original watchdog RPC to use the new one
CREATE OR REPLACE FUNCTION public.dialer_watchdog_recover(
  p_business_id uuid
) RETURNS jsonb AS $$
BEGIN
  RETURN public.dialer_claim_watchdog(p_business_id);
END;
$$ LANGUAGE plpgsql;
