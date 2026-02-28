
CREATE OR REPLACE FUNCTION public.recover_stale_calls(p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  queue_recovered int;
  live_recovered int;
BEGIN
  -- Recover stale queue items
  WITH updated AS (
    UPDATE outbound_call_queue
    SET status = 'failed',
        failure_reason = 'stale_recovered',
        updated_at = now()
    WHERE business_id = p_business_id
      AND status IN ('queued', 'dialing')
      AND created_at < now() - interval '5 minutes'
    RETURNING id
  )
  SELECT count(*) INTO queue_recovered FROM updated;

  -- Recover stale live calls
  WITH updated AS (
    UPDATE live_calls
    SET state = 'failed',
        ended_at = now(),
        updated_at = now()
    WHERE business_id = p_business_id
      AND state NOT IN ('completed', 'failed')
      AND started_at < now() - interval '5 minutes'
    RETURNING id
  )
  SELECT count(*) INTO live_recovered FROM updated;

  RETURN jsonb_build_object(
    'queue_recovered', queue_recovered,
    'live_recovered', live_recovered
  );
END;
$$;
