
-- 1. Add live_calls linkage to AI campaign queue rows
ALTER TABLE public.live_calls
  ADD COLUMN IF NOT EXISTS queue_item_id uuid,
  ADD COLUMN IF NOT EXISTS campaign_id uuid,
  ADD COLUMN IF NOT EXISTS call_session_id uuid;

CREATE INDEX IF NOT EXISTS idx_live_calls_queue_item ON public.live_calls(queue_item_id);
CREATE INDEX IF NOT EXISTS idx_live_calls_campaign ON public.live_calls(campaign_id);
CREATE INDEX IF NOT EXISTS idx_live_calls_session ON public.live_calls(call_session_id);

-- 2. Track when we noticed a missing Bland webhook delivery
ALTER TABLE public.outbound_call_queue
  ADD COLUMN IF NOT EXISTS bland_call_id_missing_logged_at timestamptz;

-- 3. Server-side dispatcher: atomically claim N rows for a campaign
CREATE OR REPLACE FUNCTION public.claim_dialer_queue_items(
  p_campaign_id uuid,
  p_limit int
)
RETURNS SETOF public.outbound_call_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH cte AS (
    SELECT id
    FROM public.outbound_call_queue
    WHERE campaign_id = p_campaign_id
      AND status IN ('queued', 'failed_bridge')
      AND (next_retry_at IS NULL OR next_retry_at <= now())
    ORDER BY priority_score DESC NULLS LAST, created_at ASC
    LIMIT GREATEST(p_limit, 0)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.outbound_call_queue q
  SET status = 'dialing',
      dialing_started_at = now(),
      updated_at = now()
  FROM cte
  WHERE q.id = cte.id
  RETURNING q.*;
END;
$$;

-- 4. Stuck-call sweep
CREATE OR REPLACE FUNCTION public.dialer_stuck_call_sweep()
RETURNS TABLE(swept_count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  WITH stuck AS (
    UPDATE public.outbound_call_queue
    SET status = 'failed',
        last_error_severity = 'warning',
        ended_at = COALESCE(ended_at, now()),
        updated_at = now()
    WHERE status IN ('dialing', 'ringing', 'intro_playing', 'awaiting_input', 'bridging')
      AND COALESCE(dialing_started_at, updated_at) < now() - interval '5 minutes'
    RETURNING id
  )
  SELECT COUNT(*)::int INTO v_count FROM stuck;

  -- Also close any orphan live_calls
  UPDATE public.live_calls
  SET state = 'failed',
      ended_at = COALESCE(ended_at, now()),
      updated_at = now()
  WHERE state NOT IN ('completed', 'failed')
    AND COALESCE(started_at, created_at) < now() - interval '5 minutes';

  RETURN QUERY SELECT v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_dialer_queue_items(uuid, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.dialer_stuck_call_sweep() TO service_role;
