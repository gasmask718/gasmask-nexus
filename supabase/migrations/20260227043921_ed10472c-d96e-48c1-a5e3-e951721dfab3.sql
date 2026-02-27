
-- Stability Guard columns on dialer_intelligence_runs
ALTER TABLE dialer_intelligence_runs
ADD COLUMN IF NOT EXISTS adaptive_locked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS adaptive_lock_cycles_remaining integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS stability_notes text;

-- snapshot_queue_baseline RPC: returns long-term average queue priority
CREATE OR REPLACE FUNCTION snapshot_queue_baseline(p_business_id uuid, p_window integer DEFAULT 50)
RETURNS TABLE(avg_priority numeric, avg_max_priority numeric, total_runs bigint)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(AVG(d.queue_priority_avg_delta), 0)::numeric AS avg_priority,
    COALESCE(AVG(d.queue_priority_max_delta), 0)::numeric AS avg_max_priority,
    COUNT(*)::bigint AS total_runs
  FROM dialer_intelligence_deltas d
  JOIN dialer_intelligence_runs r ON r.id = d.run_id
  WHERE r.business_id = p_business_id
  ORDER BY r.started_at DESC
  LIMIT p_window;
END;
$$;
