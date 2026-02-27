
-- ============================================================
-- DIALER INTELLIGENCE RPCs — Phase 1 + 2 + 3
-- ============================================================

-- 1.1 calculate_predictive_profit_score
CREATE OR REPLACE FUNCTION public.calculate_predictive_profit_score(
  p_business_id uuid,
  p_store_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
AS $fn$
DECLARE
  v_revenue_30d numeric := 0;
  v_cost_30d numeric := 0;
  v_net_profit numeric := 0;
  v_lifetime_revenue numeric := 0;
  v_connect_rate numeric := 0;
  v_last_contacted timestamptz;
  v_cooldown_penalty numeric := 0;
  v_score numeric;
  v_reasons text[] := '{}';
BEGIN
  -- Revenue last 30 days from live_call_sessions
  SELECT COALESCE(SUM(COALESCE(actual_revenue, estimated_revenue, 0)), 0)
  INTO v_revenue_30d
  FROM public.live_call_sessions
  WHERE business_id = p_business_id
    AND store_id = p_store_id
    AND connected_at >= now() - interval '30 days';

  -- Lifetime revenue
  SELECT COALESCE(SUM(COALESCE(actual_revenue, estimated_revenue, 0)), 0)
  INTO v_lifetime_revenue
  FROM public.live_call_sessions
  WHERE business_id = p_business_id
    AND store_id = p_store_id;

  -- Costs last 30 days
  SELECT COALESCE(SUM(estimated_cost), 0)
  INTO v_cost_30d
  FROM public.call_cost_events
  WHERE business_id = p_business_id
    AND store_id = p_store_id
    AND created_at >= now() - interval '30 days';

  v_net_profit := v_revenue_30d - v_cost_30d;

  -- Connect rate (store-specific from attempts)
  SELECT CASE WHEN COUNT(*) = 0 THEN 0.18
    ELSE COUNT(*) FILTER (WHERE attempt_state = 'bridged')::numeric / COUNT(*)
  END
  INTO v_connect_rate
  FROM public.dialer_call_attempts
  WHERE business_id = p_business_id
    AND store_id = p_store_id
    AND started_at >= now() - interval '30 days';

  -- Last contacted
  SELECT MAX(connected_at) INTO v_last_contacted
  FROM public.live_call_sessions
  WHERE business_id = p_business_id AND store_id = p_store_id;

  -- Cooldown penalty: if contacted < 3 days ago, penalize
  IF v_last_contacted IS NOT NULL AND v_last_contacted > now() - interval '3 days' THEN
    v_cooldown_penalty := 20;
    v_reasons := array_append(v_reasons, 'recent_contact_penalty');
  END IF;

  -- Weighted score (0-100 scale)
  v_score := GREATEST(0, LEAST(100,
    (v_net_profit * 0.4) +
    (v_connect_rate * 100 * 0.25) +
    (LEAST(v_lifetime_revenue, 5000) / 50 * 0.2) +
    (CASE WHEN v_revenue_30d > 0 THEN 15 ELSE 0 END) -
    v_cooldown_penalty
  ));

  IF v_net_profit > 0 THEN v_reasons := array_append(v_reasons, 'profitable_30d'); END IF;
  IF v_connect_rate > 0.3 THEN v_reasons := array_append(v_reasons, 'high_connect_rate'); END IF;
  IF v_lifetime_revenue > 1000 THEN v_reasons := array_append(v_reasons, 'high_ltv'); END IF;

  RETURN jsonb_build_object(
    'profit_score', round(v_score, 2),
    'lifetime_revenue', round(v_lifetime_revenue, 2),
    'net_profit_30d', round(v_net_profit, 2),
    'cost_30d', round(v_cost_30d, 2),
    'connect_rate_30d', round(v_connect_rate, 4),
    'last_contacted_at', v_last_contacted,
    'reasons', to_jsonb(v_reasons)
  );
END;
$fn$;

-- 1.2 auto_adjust_campaign_weights
CREATE OR REPLACE FUNCTION public.auto_adjust_campaign_weights(p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_rec record;
  v_results jsonb[] := '{}';
  v_count int := 0;
  v_revenue numeric;
  v_cost numeric;
  v_roi numeric;
  v_new_weight numeric;
  v_old_weight numeric;
  v_reason text;
BEGIN
  FOR v_rec IN
    SELECT id, name, campaign_weight
    FROM public.dialer_campaigns
    WHERE business_id = p_business_id AND status = 'active'
  LOOP
    v_old_weight := COALESCE(v_rec.campaign_weight, 1.0);

    -- Revenue from sessions tied to this campaign
    SELECT COALESCE(SUM(COALESCE(actual_revenue, estimated_revenue, 0)), 0)
    INTO v_revenue
    FROM public.live_call_sessions
    WHERE campaign_id = v_rec.id AND connected_at >= now() - interval '3 days';

    SELECT COALESCE(SUM(estimated_cost), 0)
    INTO v_cost
    FROM public.call_cost_events
    WHERE campaign_id = v_rec.id AND created_at >= now() - interval '3 days';

    v_roi := CASE WHEN v_cost > 0 THEN v_revenue / v_cost ELSE 1.0 END;

    -- Adjust: high ROI → boost, low ROI → reduce, clamped ±15%
    IF v_roi > 2.0 THEN
      v_new_weight := LEAST(v_old_weight * 1.15, 3.0);
      v_reason := 'high_roi_boost';
    ELSIF v_roi < 0.5 THEN
      v_new_weight := GREATEST(v_old_weight * 0.85, 0.5);
      v_reason := 'low_roi_downrank';
    ELSIF v_revenue = 0 AND v_cost > 5 THEN
      v_new_weight := GREATEST(v_old_weight * 0.90, 0.5);
      v_reason := 'zero_revenue_cost_drain';
    ELSE
      v_new_weight := v_old_weight;
      v_reason := 'stable';
    END IF;

    v_new_weight := round(v_new_weight, 2);

    IF v_new_weight <> v_old_weight THEN
      UPDATE public.dialer_campaigns
      SET campaign_weight = v_new_weight, updated_at = now()
      WHERE id = v_rec.id;
      v_count := v_count + 1;
    END IF;

    v_results := array_append(v_results, jsonb_build_object(
      'campaign_id', v_rec.id,
      'name', v_rec.name,
      'old_weight', v_old_weight,
      'new_weight', v_new_weight,
      'roi_3d', round(v_roi, 2),
      'reason', v_reason
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'updated_campaigns_count', v_count,
    'campaigns', to_jsonb(v_results)
  );
END;
$fn$;

-- 1.3 get_best_rep_for_store
CREATE OR REPLACE FUNCTION public.get_best_rep_for_store(
  p_business_id uuid,
  p_store_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_agent record;
  v_connect_rate numeric;
  v_pph numeric;
BEGIN
  SELECT da.*
  INTO v_agent
  FROM public.dialer_agent_availability da
  WHERE da.business_id = p_business_id
    AND da.status IN ('available', 'ready')
    AND da.active_calls_count < COALESCE(da.max_concurrent_calls, 1)
  ORDER BY da.efficiency_score DESC NULLS LAST,
           da.last_call_ended_at ASC NULLS FIRST
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_agent IS NULL THEN
    RETURN jsonb_build_object('agent_user_id', null, 'reason', 'no_available_agents');
  END IF;

  -- Get store-specific connect rate for this agent
  SELECT CASE WHEN COUNT(*) < 3 THEN null
    ELSE COUNT(*) FILTER (WHERE attempt_state = 'bridged')::numeric / COUNT(*)
  END
  INTO v_connect_rate
  FROM public.dialer_call_attempts
  WHERE agent_user_id = v_agent.user_id AND store_id = p_store_id;

  -- Estimate profit per hour from sessions
  SELECT CASE WHEN SUM(duration_seconds) > 0
    THEN SUM(COALESCE(actual_revenue, 0)) / (SUM(duration_seconds) / 3600.0)
    ELSE null
  END
  INTO v_pph
  FROM public.live_call_sessions
  WHERE rep_user_id = v_agent.user_id
    AND business_id = p_business_id
    AND connected_at >= now() - interval '30 days';

  RETURN jsonb_build_object(
    'agent_user_id', v_agent.user_id,
    'efficiency_score', v_agent.efficiency_score,
    'connect_rate', v_connect_rate,
    'profit_per_hour', round(COALESCE(v_pph, 0), 2),
    'routing_type', v_agent.phone_route_type,
    'forward_phone', v_agent.forward_phone_e164,
    'reason', 'performance_ranked'
  );
END;
$fn$;

-- 1.4 boost_queue_priority_for_hour
CREATE OR REPLACE FUNCTION public.boost_queue_priority_for_hour(
  p_business_id uuid,
  p_now_ts timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_hour int := EXTRACT(HOUR FROM p_now_ts)::int;
  v_boosted int := 0;
  v_samples jsonb[] := '{}';
  v_rec record;
  v_boost int;
  v_avg_rev numeric;
BEGIN
  -- For each queued item, check if the current hour is historically good for that store
  FOR v_rec IN
    SELECT q.id, q.store_id, q.priority_score
    FROM public.outbound_call_queue q
    WHERE q.business_id = p_business_id
      AND q.status = 'queued'
    LIMIT 500
  LOOP
    -- Check store's historical revenue at this hour
    SELECT COALESCE(AVG(COALESCE(actual_revenue, estimated_revenue, 0)), 0)
    INTO v_avg_rev
    FROM public.live_call_sessions
    WHERE store_id = v_rec.store_id
      AND EXTRACT(HOUR FROM connected_at) = v_hour
      AND connected_at >= now() - interval '60 days';

    -- Boost: 0-20% based on hourly revenue
    v_boost := LEAST(20, GREATEST(0, (v_avg_rev * 2)::int));

    IF v_boost > 0 THEN
      UPDATE public.outbound_call_queue
      SET priority_score = LEAST(100, COALESCE(priority_score, 50) + v_boost),
          updated_at = now()
      WHERE id = v_rec.id;

      v_boosted := v_boosted + 1;

      IF array_length(v_samples, 1) IS NULL OR array_length(v_samples, 1) < 10 THEN
        v_samples := array_append(v_samples, jsonb_build_object(
          'store_id', v_rec.store_id,
          'old_score', v_rec.priority_score,
          'new_score', LEAST(100, COALESCE(v_rec.priority_score, 50) + v_boost),
          'boost_reason', 'hour_' || v_hour || '_avg_rev_' || round(v_avg_rev, 2)
        ));
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'boosted_count', v_boosted,
    'hour', v_hour,
    'sample', to_jsonb(v_samples)
  );
END;
$fn$;

-- ============================================================
-- Phase 2: Patch claim_available_agent for performance-first routing
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_available_agent(p_business_id uuid)
RETURNS SETOF dialer_agent_availability
LANGUAGE plpgsql
AS $fn$
BEGIN
  RETURN QUERY
  WITH agent AS (
    SELECT id
    FROM public.dialer_agent_availability
    WHERE business_id = p_business_id
      AND status IN ('available', 'ready')
      AND active_calls_count < COALESCE(max_concurrent_calls, 1)
    ORDER BY
      efficiency_score DESC NULLS LAST,
      last_call_ended_at ASC NULLS FIRST,
      updated_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.dialer_agent_availability da
  SET status = 'busy',
      active_calls_count = da.active_calls_count + 1,
      updated_at = now()
  FROM agent a
  WHERE da.id = a.id
  RETURNING da.*;
END;
$fn$;

-- ============================================================
-- Phase 3: Inventory → Dialer queue seeding
-- ============================================================
CREATE OR REPLACE FUNCTION public.seed_outbound_queue_from_inventory(
  p_business_id uuid,
  p_mode text DEFAULT 'dry_run'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_inserted int := 0;
  v_updated int := 0;
  v_blocked int := 0;
  v_preview jsonb[] := '{}';
  v_rec record;
  v_existing uuid;
  v_score int;
BEGIN
  -- Candidate: stores with low inventory coverage from the view
  FOR v_rec IN
    SELECT
      sm.id AS store_id,
      sm.phone,
      sm.store_name,
      sm.owner_name,
      ic.days_of_inventory_remaining,
      ic.risk_level,
      ic.avg_daily_velocity_30d
    FROM public.v_inventory_coverage_intelligence ic
    JOIN public.store_master sm ON sm.brand_id IS NOT NULL
    WHERE ic.risk_level IN ('critical', 'red', 'amber')
      AND ic.days_of_inventory_remaining IS NOT NULL
      AND ic.days_of_inventory_remaining < 14
      AND sm.phone IS NOT NULL
      AND sm.do_not_call = false
      -- Not contacted in last 3 days
      AND NOT EXISTS (
        SELECT 1 FROM public.live_call_sessions lcs
        WHERE lcs.store_id = sm.id
          AND lcs.connected_at >= now() - interval '3 days'
      )
      -- Not DNC
      AND NOT EXISTS (
        SELECT 1 FROM public.contact_compliance cc
        WHERE cc.entity_id = sm.id AND cc.dnc = true
      )
    ORDER BY ic.days_of_inventory_remaining ASC
    LIMIT 200
  LOOP
    -- Priority score based on urgency
    v_score := CASE
      WHEN v_rec.risk_level = 'critical' THEN 95
      WHEN v_rec.risk_level = 'red' THEN 80
      ELSE 65
    END;

    -- Check if already in queue
    SELECT id INTO v_existing
    FROM public.outbound_call_queue
    WHERE store_id = v_rec.store_id
      AND status = 'queued'
      AND business_id = p_business_id
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      IF p_mode = 'commit' THEN
        UPDATE public.outbound_call_queue
        SET priority_score = GREATEST(priority_score, v_score),
            notes = 'inventory_trigger: ' || v_rec.risk_level || ' (' || COALESCE(v_rec.days_of_inventory_remaining::text, '?') || 'd remaining)',
            updated_at = now()
        WHERE id = v_existing;
      END IF;
      v_updated := v_updated + 1;
    ELSE
      IF p_mode = 'commit' THEN
        INSERT INTO public.outbound_call_queue (
          store_id, phone_number, contact_name, business_id,
          priority_score, status, notes
        ) VALUES (
          v_rec.store_id, v_rec.phone,
          COALESCE(v_rec.store_name, v_rec.owner_name, 'Unknown'),
          p_business_id, v_score, 'queued',
          'inventory_trigger: ' || v_rec.risk_level || ' (' || COALESCE(v_rec.days_of_inventory_remaining::text, '?') || 'd remaining)'
        );
      END IF;
      v_inserted := v_inserted + 1;
    END IF;

    IF array_length(v_preview, 1) IS NULL OR array_length(v_preview, 1) < 10 THEN
      v_preview := array_append(v_preview, jsonb_build_object(
        'store_id', v_rec.store_id,
        'store_name', v_rec.store_name,
        'risk_level', v_rec.risk_level,
        'days_remaining', v_rec.days_of_inventory_remaining,
        'priority_score', v_score,
        'action', CASE WHEN v_existing IS NOT NULL THEN 'updated' ELSE 'inserted' END
      ));
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'mode', p_mode,
    'inserted_count', v_inserted,
    'updated_count', v_updated,
    'blocked_count', v_blocked,
    'top_10_preview', to_jsonb(v_preview)
  );
END;
$fn$;
