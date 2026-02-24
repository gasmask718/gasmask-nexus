
-- Re-apply Phase G columns that failed with previous migration

-- Store answer profile additions
ALTER TABLE public.store_answer_profile ADD COLUMN IF NOT EXISTS priority_score numeric DEFAULT 0;
ALTER TABLE public.store_answer_profile ADD COLUMN IF NOT EXISTS lifetime_revenue numeric DEFAULT 0;

-- Dialer settings additions
ALTER TABLE public.dialer_settings ADD COLUMN IF NOT EXISTS use_dynamic_connect_rate boolean DEFAULT false;
ALTER TABLE public.dialer_settings ADD COLUMN IF NOT EXISTS auto_profit_protection boolean DEFAULT false;
ALTER TABLE public.dialer_settings ADD COLUMN IF NOT EXISTS profit_throttle_threshold numeric DEFAULT 0;
ALTER TABLE public.dialer_settings ADD COLUMN IF NOT EXISTS negative_profit_days_to_pause integer DEFAULT 3;

-- Agent availability additions
ALTER TABLE public.dialer_agent_availability ADD COLUMN IF NOT EXISTS efficiency_score numeric DEFAULT 0;
ALTER TABLE public.dialer_agent_availability ADD COLUMN IF NOT EXISTS base_max_concurrent integer DEFAULT 1;

-- Campaign additions
ALTER TABLE public.dialer_campaigns ADD COLUMN IF NOT EXISTS campaign_weight numeric DEFAULT 1.0;
ALTER TABLE public.dialer_campaigns ADD COLUMN IF NOT EXISTS auto_paused boolean DEFAULT false;
ALTER TABLE public.dialer_campaigns ADD COLUMN IF NOT EXISTS auto_pause_reason text;

-- Store priority ranking view
CREATE OR REPLACE VIEW public.v_store_priority_ranking AS
SELECT
  sap.store_id,
  sap.business_id,
  sap.priority_score,
  sap.answer_rate,
  sap.lifetime_revenue,
  sap.total_attempts,
  sap.total_answers,
  sap.last_attempt_at,
  sap.last_answer_at,
  sm.store_name,
  sm.do_not_call
FROM public.store_answer_profile sap
LEFT JOIN public.store_master sm ON sm.id = sap.store_id
WHERE COALESCE(sm.do_not_call, false) = false
ORDER BY sap.priority_score DESC NULLS LAST;

-- Campaign optimization view
CREATE OR REPLACE VIEW public.v_campaign_optimization AS
SELECT
  dc.id AS campaign_id,
  dc.name AS campaign_name,
  dc.campaign_weight,
  dc.auto_paused,
  dc.auto_pause_reason,
  dc.status,
  dc.business_id,
  COALESCE(cm.revenue, 0) AS revenue,
  COALESCE(cm.total_cost, 0) AS total_cost,
  COALESCE(cm.net_profit, 0) AS net_profit,
  COALESCE(cm.margin_pct, 0) AS margin_pct,
  COALESCE(cm.total_calls, 0) AS total_calls,
  COALESCE(cm.revenue_per_dial, 0) AS revenue_per_dial,
  COALESCE(cm.profit_per_dial, 0) AS profit_per_dial
FROM public.dialer_campaigns dc
LEFT JOIN public.v_campaign_margin cm ON cm.campaign_id = dc.id;

-- Store priority scoring function
CREATE OR REPLACE FUNCTION public.calculate_store_priority(p_business_id uuid)
RETURNS integer AS $$
DECLARE
  v_count integer := 0;
  v_rec record;
BEGIN
  FOR v_rec IN
    SELECT 
      sap.store_id,
      COALESCE(sap.lifetime_revenue, 0) AS lifetime_revenue,
      COALESCE(sap.answer_rate, 0) AS answer_rate,
      COALESCE(sci.interest_score, 0) AS interest_score,
      EXTRACT(DAY FROM now() - COALESCE(sap.last_attempt_at, now() - interval '30 days')) AS days_since
    FROM public.store_answer_profile sap
    LEFT JOIN public.store_call_intelligence sci ON sci.store_id = sap.store_id
    WHERE sap.business_id = p_business_id
  LOOP
    UPDATE public.store_answer_profile
    SET priority_score = GREATEST(0,
      (v_rec.lifetime_revenue * 0.4) +
      (v_rec.answer_rate * 100 * 0.3) +
      (v_rec.interest_score * 0.2) -
      (v_rec.days_since * 0.1)
    ),
    updated_at = now()
    WHERE store_id = v_rec.store_id;
    
    UPDATE public.outbound_call_queue
    SET priority_score = GREATEST(0,
      (v_rec.lifetime_revenue * 0.4) +
      (v_rec.answer_rate * 100 * 0.3) +
      (v_rec.interest_score * 0.2) -
      (v_rec.days_since * 0.1)
    )
    WHERE store_id = v_rec.store_id
      AND status = 'queued'
      AND business_id = p_business_id;
    
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Rep efficiency scoring function
CREATE OR REPLACE FUNCTION public.calculate_rep_efficiency(p_business_id uuid)
RETURNS integer AS $$
DECLARE
  v_count integer := 0;
  v_rec record;
BEGIN
  FOR v_rec IN
    SELECT 
      rep_user_id,
      COALESCE(profit_per_hour, 0) AS pph,
      CASE WHEN total_sessions > 0 THEN total_connects::numeric / total_sessions ELSE 0 END AS connect_rate,
      total_sessions
    FROM public.v_rep_profit_metrics
    WHERE business_id = p_business_id
  LOOP
    UPDATE public.dialer_agent_availability
    SET efficiency_score = (v_rec.pph * 0.5) + (v_rec.connect_rate * 100 * 0.3) + LEAST(v_rec.total_sessions, 100) * 0.2,
        max_concurrent_calls = CASE
          WHEN (v_rec.pph * 0.5) + (v_rec.connect_rate * 100 * 0.3) > 50 THEN COALESCE(base_max_concurrent, 1) + 1
          ELSE COALESCE(base_max_concurrent, 1)
        END,
        updated_at = now()
    WHERE user_id = v_rec.rep_user_id
      AND business_id = p_business_id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Rolling connect rate function
CREATE OR REPLACE FUNCTION public.get_rolling_connect_rate(p_business_id uuid, p_window integer DEFAULT 100)
RETURNS numeric AS $$
DECLARE
  v_total integer;
  v_connected integer;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE outcome IS NOT NULL AND outcome NOT IN ('no_answer', 'failed', 'voicemail'))
  INTO v_total, v_connected
  FROM (
    SELECT outcome FROM public.live_call_sessions
    WHERE business_id = p_business_id
    ORDER BY connected_at DESC
    LIMIT p_window
  ) sub;
  IF v_total = 0 THEN RETURN 0.18; END IF;
  RETURN v_connected::numeric / v_total;
END;
$$ LANGUAGE plpgsql;
