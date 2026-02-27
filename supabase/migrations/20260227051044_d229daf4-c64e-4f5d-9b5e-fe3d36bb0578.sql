-- Create truth view for UI consumption
CREATE OR REPLACE VIEW public.v_dialer_latest_run AS
SELECT DISTINCT ON (business_id)
  business_id,
  id as run_id,
  started_at,
  ended_at,
  overall_status,
  run_mode,
  impact_score,
  adaptive_multiplier,
  adaptive_mode,
  effective_refresh_interval,
  rolling_avg_impact,
  rolling_negative_ratio,
  adaptive_locked,
  adaptive_lock_cycles_remaining,
  stability_notes,
  forecast_window_days,
  projected_attempts,
  projected_connects,
  projected_revenue,
  projected_cost,
  projected_profit,
  forecast_confidence,
  forecast_inputs,
  target_gap,
  target_mode_action
FROM public.dialer_intelligence_runs
ORDER BY business_id, started_at DESC;

-- RLS on the base table already covers access; view inherits via security_invoker
-- But we need to grant select on the view
GRANT SELECT ON public.v_dialer_latest_run TO authenticated;
GRANT SELECT ON public.v_dialer_latest_run TO anon;