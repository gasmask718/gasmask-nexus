
-- PHASE B.1: Stability Hardening Patch

-- 1. Engine lock table (re-entrancy guard)
CREATE TABLE IF NOT EXISTS public.dialer_engine_locks (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id),
  locked_until timestamptz NOT NULL DEFAULT now(),
  locked_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dialer_engine_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin roles manage engine locks" ON public.dialer_engine_locks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','owner','va'))
  );

-- 2. Engine cycle audit logs
CREATE TABLE IF NOT EXISTS public.dialer_engine_cycle_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id),
  campaign_id uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  lock_acquired boolean NOT NULL DEFAULT false,
  claimed_count integer DEFAULT 0,
  outcomes jsonb DEFAULT '{}',
  agents_claimed integer DEFAULT 0,
  errors jsonb DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dialer_engine_cycle_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin roles read engine logs" ON public.dialer_engine_cycle_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','owner','va'))
  );

-- 3. Add numeric business hours + backoff to dialer_settings
ALTER TABLE public.dialer_settings 
  ADD COLUMN IF NOT EXISTS business_hours_start_min integer DEFAULT 540,
  ADD COLUMN IF NOT EXISTS business_hours_end_min integer DEFAULT 1080,
  ADD COLUMN IF NOT EXISTS retry_backoff_minutes integer[] DEFAULT '{15,60,240}',
  ADD COLUMN IF NOT EXISTS retry_max_days integer DEFAULT 7;

-- 4. Add watchdog columns to outbound_call_queue
ALTER TABLE public.outbound_call_queue
  ADD COLUMN IF NOT EXISTS dialing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS answered_at timestamptz;

-- 5. Atomic queue claiming RPC
CREATE OR REPLACE FUNCTION public.claim_queue_items(
  p_business_id uuid,
  p_campaign_id uuid DEFAULT NULL,
  p_limit_count integer DEFAULT 10,
  p_max_attempts integer DEFAULT 3
)
RETURNS SETOF public.outbound_call_queue
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH claimable AS (
    SELECT id
    FROM public.outbound_call_queue
    WHERE business_id = p_business_id
      AND status = 'queued'
      AND attempt_count < p_max_attempts
      AND (p_campaign_id IS NULL OR campaign_id = p_campaign_id)
      AND (next_retry_at IS NULL OR next_retry_at <= now())
    ORDER BY priority_score DESC, created_at ASC
    LIMIT p_limit_count
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.outbound_call_queue q
  SET status = 'dialing',
      last_attempt_at = now(),
      attempt_count = attempt_count + 1,
      dialing_started_at = now(),
      updated_at = now()
  FROM claimable c
  WHERE q.id = c.id
  RETURNING q.*;
END;
$$;

-- 6. Atomic agent claiming RPC
CREATE OR REPLACE FUNCTION public.claim_available_agent(
  p_business_id uuid
)
RETURNS SETOF public.dialer_agent_availability
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH target AS (
    SELECT id
    FROM public.dialer_agent_availability
    WHERE business_id = p_business_id
      AND status = 'available'
      AND active_calls_count < max_concurrent_calls
    ORDER BY updated_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.dialer_agent_availability a
  SET status = 'busy',
      active_calls_count = active_calls_count + 1,
      updated_at = now()
  FROM target t
  WHERE a.id = t.id
  RETURNING a.*;
END;
$$;

-- 7. Watchdog RPC: recover stuck calls
CREATE OR REPLACE FUNCTION public.dialer_watchdog_recover(
  p_business_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stuck_dialing integer;
  stuck_answered integer;
BEGIN
  -- Stuck in dialing > 2 minutes
  WITH stuck AS (
    UPDATE public.outbound_call_queue
    SET status = 'failed',
        next_retry_at = now() + interval '10 minutes',
        updated_at = now()
    WHERE business_id = p_business_id
      AND status = 'dialing'
      AND dialing_started_at < now() - interval '2 minutes'
    RETURNING id
  )
  SELECT count(*) INTO stuck_dialing FROM stuck;

  -- Stuck in answered > 60 seconds with no bridge
  WITH stuck AS (
    UPDATE public.outbound_call_queue
    SET status = 'queued',
        next_retry_at = now() + interval '10 minutes',
        updated_at = now()
    WHERE business_id = p_business_id
      AND status = 'answered'
      AND answered_at < now() - interval '60 seconds'
    RETURNING id
  )
  SELECT count(*) INTO stuck_answered FROM stuck;

  RETURN jsonb_build_object(
    'recovered_dialing', stuck_dialing,
    'recovered_answered', stuck_answered,
    'recovered_at', now()
  );
END;
$$;

-- Enable realtime for engine logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.dialer_engine_cycle_logs;
