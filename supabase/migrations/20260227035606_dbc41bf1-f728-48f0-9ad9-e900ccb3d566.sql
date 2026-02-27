
-- Rolling impact stats RPC
CREATE OR REPLACE FUNCTION public.get_rolling_impact_stats(p_business_id uuid, p_window int DEFAULT 10)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  WITH recent AS (
    SELECT impact_score
    FROM dialer_intelligence_runs
    WHERE business_id = p_business_id
      AND impact_score IS NOT NULL
      AND ended_at IS NOT NULL
    ORDER BY started_at DESC
    LIMIT p_window
  )
  SELECT jsonb_build_object(
    'avg_impact', round(coalesce(avg(impact_score), 0)::numeric, 2),
    'positive_runs', count(*) FILTER (WHERE impact_score > 0),
    'negative_runs', count(*) FILTER (WHERE impact_score < 0),
    'zero_runs', count(*) FILTER (WHERE impact_score = 0),
    'total_runs', count(*),
    'max_impact', coalesce(max(impact_score), 0),
    'min_impact', coalesce(min(impact_score), 0)
  )
  FROM recent;
$$;
