
-- Snapshot RPCs for delta capture (lightweight summaries, no full copies)

-- 1. Queue summary snapshot
CREATE OR REPLACE FUNCTION public.snapshot_queue_summary(p_business_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT coalesce(jsonb_build_object(
    'count', count(*),
    'avg_priority', round(coalesce(avg(priority_score), 0)::numeric, 2),
    'max_priority', coalesce(max(priority_score), 0)
  ), '{"count":0,"avg_priority":0,"max_priority":0}'::jsonb)
  FROM outbound_call_queue
  WHERE business_id = p_business_id
    AND status IN ('queued', 'retry');
$$;

-- 2. Campaign summary snapshot
CREATE OR REPLACE FUNCTION public.snapshot_campaign_summary(p_business_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT coalesce(jsonb_build_object(
    'count', count(*),
    'avg_weight', round(coalesce(avg(campaign_weight), 1)::numeric, 3),
    'max_weight', round(coalesce(max(campaign_weight), 1)::numeric, 3)
  ), '{"count":0,"avg_weight":1,"max_weight":1}'::jsonb)
  FROM dialer_campaigns
  WHERE business_id = p_business_id
    AND status = 'active';
$$;

-- 3. Agent routing distribution snapshot (last 60 min)
CREATE OR REPLACE FUNCTION public.snapshot_agent_distribution(p_business_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  WITH recent AS (
    SELECT rep_user_id, count(*) as calls
    FROM live_call_sessions
    WHERE business_id = p_business_id
      AND connected_at >= now() - interval '60 minutes'
      AND rep_user_id IS NOT NULL
    GROUP BY rep_user_id
  ),
  totals AS (
    SELECT 
      coalesce(sum(calls), 0) as total,
      coalesce(max(calls), 0) as top_rep_calls
    FROM recent
  )
  SELECT jsonb_build_object(
    'total_attempts', totals.total,
    'top_rep_calls', totals.top_rep_calls,
    'top_rep_share', CASE WHEN totals.total > 0 
      THEN round((totals.top_rep_calls::numeric / totals.total) * 100, 1)
      ELSE 0 END
  )
  FROM totals;
$$;
