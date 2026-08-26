-- 1. Queue hardening: claim/attempt tracking
ALTER TABLE public.funding_sms_queue
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_status text;

ALTER TABLE public.funding_sms_queue DROP CONSTRAINT IF EXISTS funding_sms_queue_status_check;
ALTER TABLE public.funding_sms_queue
  ADD CONSTRAINT funding_sms_queue_status_check
  CHECK (status = ANY (ARRAY['queued'::text,'processing'::text,'sent'::text,'failed'::text,'blocked'::text]));

CREATE INDEX IF NOT EXISTS idx_funding_sms_queue_status_queued
  ON public.funding_sms_queue (status, queued_at);

-- 2. Lock the queue down (RLS was disabled)
GRANT SELECT ON public.funding_sms_queue TO authenticated;
GRANT ALL ON public.funding_sms_queue TO service_role;
ALTER TABLE public.funding_sms_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS funding_sms_queue_staff_select ON public.funding_sms_queue;
CREATE POLICY funding_sms_queue_staff_select ON public.funding_sms_queue
  FOR SELECT TO authenticated
  USING (public.is_funding_staff(auth.uid()));

DROP POLICY IF EXISTS funding_sms_queue_service_all ON public.funding_sms_queue;
CREATE POLICY funding_sms_queue_service_all ON public.funding_sms_queue
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 3. Clients can read their own infrastructure checklist
DROP POLICY IF EXISTS funding_infrastructure_checklist_self_select ON public.funding_infrastructure_checklist;
CREATE POLICY funding_infrastructure_checklist_self_select ON public.funding_infrastructure_checklist
  FOR SELECT TO authenticated
  USING (public.is_funding_client_self(client_id, auth.uid()));

-- 4. Transactional claim helper for the queue processor
CREATE OR REPLACE FUNCTION public.claim_funding_sms_batch(p_limit integer DEFAULT 20, p_max_attempts integer DEFAULT 3)
RETURNS SETOF public.funding_sms_queue
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH picked AS (
    SELECT id
    FROM public.funding_sms_queue
    WHERE status = 'queued'
      AND attempts < p_max_attempts
    ORDER BY queued_at
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(1, LEAST(coalesce(p_limit, 20), 100))
  )
  UPDATE public.funding_sms_queue q
  SET status = 'processing',
      claimed_at = now(),
      last_attempt_at = now(),
      attempts = q.attempts + 1
  FROM picked
  WHERE q.id = picked.id
  RETURNING q.*;
$$;

REVOKE ALL ON FUNCTION public.claim_funding_sms_batch(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_funding_sms_batch(integer, integer) TO service_role;
