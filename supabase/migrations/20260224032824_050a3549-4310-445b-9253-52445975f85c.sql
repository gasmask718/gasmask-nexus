
-- Add session_id to call_cost_events for direct join
ALTER TABLE public.call_cost_events ADD COLUMN IF NOT EXISTS session_id uuid;

-- Rep profit metrics view (using queue_item_id as fallback join)
CREATE OR REPLACE VIEW public.v_rep_profit_metrics AS
SELECT
  s.rep_user_id,
  s.business_id,
  COUNT(DISTINCT s.id) AS total_sessions,
  COUNT(DISTINCT s.id) FILTER (WHERE s.outcome IS NOT NULL AND s.outcome != 'no_answer') AS total_connects,
  COALESCE(SUM(r.amount), 0) AS total_revenue,
  COALESCE(SUM(c.estimated_cost), 0) AS total_cost,
  COALESCE(SUM(r.amount), 0) - COALESCE(SUM(c.estimated_cost), 0) AS net_profit,
  COALESCE(SUM(s.duration_seconds), 0) AS total_talk_seconds,
  CASE 
    WHEN COALESCE(SUM(s.duration_seconds), 0) > 0 
    THEN (COALESCE(SUM(r.amount), 0) - COALESCE(SUM(c.estimated_cost), 0)) / (SUM(s.duration_seconds) / 3600.0)
    ELSE 0
  END AS profit_per_hour
FROM public.live_call_sessions s
LEFT JOIN public.call_revenue_events r ON r.session_id = s.id
LEFT JOIN public.call_cost_events c ON c.queue_item_id = s.queue_item_id
WHERE s.rep_user_id IS NOT NULL
GROUP BY s.rep_user_id, s.business_id;
