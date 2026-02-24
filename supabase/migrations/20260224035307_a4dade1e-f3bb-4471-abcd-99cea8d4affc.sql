-- PHASE H Part 2: Views + RPC

CREATE OR REPLACE VIEW public.v_sales_funnel AS
SELECT
  s.campaign_id,
  c.name AS campaign_name,
  COUNT(*) AS total_dials,
  COUNT(*) FILTER (WHERE s.outcome IN ('answered','bridged','completed')) AS total_answers,
  COUNT(*) FILTER (WHERE s.outcome IN ('bridged','completed')) AS total_bridged,
  COUNT(*) FILTER (WHERE dc.category = 'positive') AS total_interested,
  COUNT(*) FILTER (WHERE s.order_created = true) AS total_orders,
  COALESCE(SUM(s.actual_revenue), 0) AS total_revenue,
  CASE WHEN COUNT(*) FILTER (WHERE s.outcome IN ('bridged','completed')) > 0
    THEN COUNT(*) FILTER (WHERE s.order_created = true)::numeric / COUNT(*) FILTER (WHERE s.outcome IN ('bridged','completed'))
    ELSE 0 END AS close_rate,
  CASE WHEN COUNT(*) FILTER (WHERE s.outcome IN ('answered','bridged','completed')) > 0
    THEN COALESCE(SUM(s.actual_revenue), 0) / COUNT(*) FILTER (WHERE s.outcome IN ('answered','bridged','completed'))
    ELSE 0 END AS revenue_per_connect,
  CASE WHEN COUNT(*) FILTER (WHERE s.outcome IN ('answered','bridged','completed')) > 0
    THEN (COALESCE(SUM(s.actual_revenue), 0) - COALESCE(SUM(ce.estimated_cost), 0)) / COUNT(*) FILTER (WHERE s.outcome IN ('answered','bridged','completed'))
    ELSE 0 END AS profit_per_connect
FROM public.live_call_sessions s
LEFT JOIN public.dialer_campaigns c ON c.id = s.campaign_id
LEFT JOIN public.dialer_disposition_config dc ON dc.id = s.disposition_id
LEFT JOIN public.call_cost_events ce ON ce.session_id = s.id
WHERE s.campaign_id IS NOT NULL
GROUP BY s.campaign_id, c.name;

CREATE OR REPLACE VIEW public.v_rep_close_rate AS
SELECT
  s.rep_user_id,
  COUNT(*) AS total_sessions,
  COUNT(*) FILTER (WHERE s.outcome IN ('bridged','completed')) AS total_connects,
  COUNT(*) FILTER (WHERE s.order_created = true) AS total_orders,
  COALESCE(SUM(s.actual_revenue), 0) AS total_revenue,
  COALESCE(SUM(ce.estimated_cost), 0) AS total_cost,
  COALESCE(SUM(s.actual_revenue), 0) - COALESCE(SUM(ce.estimated_cost), 0) AS net_profit,
  CASE WHEN COUNT(*) FILTER (WHERE s.outcome IN ('bridged','completed')) > 0
    THEN COUNT(*) FILTER (WHERE s.order_created = true)::numeric / COUNT(*) FILTER (WHERE s.outcome IN ('bridged','completed'))
    ELSE 0 END AS close_rate,
  CASE WHEN SUM(s.duration_seconds) > 0
    THEN (COALESCE(SUM(s.actual_revenue), 0) - COALESCE(SUM(ce.estimated_cost), 0)) / (SUM(s.duration_seconds) / 3600.0)
    ELSE 0 END AS profit_per_hour
FROM public.live_call_sessions s
LEFT JOIN public.call_cost_events ce ON ce.session_id = s.id
WHERE s.rep_user_id IS NOT NULL
GROUP BY s.rep_user_id;

CREATE OR REPLACE FUNCTION public.apply_call_disposition(
  p_session_id uuid,
  p_disposition_id uuid,
  p_notes text DEFAULT NULL,
  p_estimated_revenue numeric DEFAULT 0,
  p_actual_revenue numeric DEFAULT 0
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_session record;
  v_disp record;
  v_store_id uuid;
  v_campaign_id uuid;
  v_rep_id uuid;
  v_cost numeric;
BEGIN
  SELECT * INTO v_session FROM public.live_call_sessions WHERE id = p_session_id;
  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'session_not_found');
  END IF;

  SELECT * INTO v_disp FROM public.dialer_disposition_config WHERE id = p_disposition_id;
  IF v_disp IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'disposition_not_found');
  END IF;

  v_store_id := v_session.store_id;
  v_campaign_id := v_session.campaign_id;
  v_rep_id := v_session.rep_user_id;

  UPDATE public.live_call_sessions SET
    disposition_id = p_disposition_id,
    disposition_notes = p_notes,
    estimated_revenue = p_estimated_revenue,
    actual_revenue = p_actual_revenue,
    order_created = v_disp.creates_invoice_draft,
    follow_up_scheduled = v_disp.creates_follow_up
  WHERE id = p_session_id;

  IF v_disp.name = 'Do Not Call' AND v_store_id IS NOT NULL THEN
    UPDATE public.store_master SET
      do_not_call = true,
      last_opt_out_timestamp = now(),
      do_not_call_reason = COALESCE(p_notes, 'Requested during call')
    WHERE id = v_store_id;

    INSERT INTO public.dialer_opt_out_events (store_id, session_id, rep_user_id, event_type, notes)
    VALUES (v_store_id, p_session_id, v_rep_id, 'opt_out', COALESCE(p_notes, 'DNC disposition applied'));

    INSERT INTO public.compliance_events (store_id, session_id, rep_user_id, event_type, notes)
    VALUES (v_store_id, p_session_id, v_rep_id, 'dnc_applied', COALESCE(p_notes, 'DNC from disposition'));
  END IF;

  IF v_store_id IS NOT NULL AND v_disp.pipeline_stage IS NOT NULL THEN
    UPDATE public.store_answer_profile SET
      lifecycle_stage = v_disp.pipeline_stage,
      updated_at = now()
    WHERE store_id = v_store_id;
  END IF;

  IF p_actual_revenue > 0 THEN
    SELECT COALESCE(SUM(estimated_cost), 0) INTO v_cost
    FROM public.call_cost_events WHERE session_id = p_session_id;

    INSERT INTO public.call_revenue_attribution (session_id, store_id, campaign_id, rep_user_id, revenue_amount, cost_amount, net_profit)
    VALUES (p_session_id, v_store_id, v_campaign_id, v_rep_id, p_actual_revenue, v_cost, p_actual_revenue - v_cost);

    INSERT INTO public.call_revenue_events (business_id, session_id, store_id, campaign_id, rep_user_id, amount)
    VALUES (v_session.business_id, p_session_id, v_store_id, v_campaign_id, v_rep_id, p_actual_revenue);
  END IF;

  IF v_disp.creates_follow_up AND v_store_id IS NOT NULL THEN
    INSERT INTO public.follow_up_queue (store_id, business_id, reason, recommended_action, priority, due_at, context)
    VALUES (
      v_store_id,
      v_session.business_id,
      'dialer_' || lower(replace(v_disp.name, ' ', '_')),
      'ai_call',
      CASE WHEN v_disp.category = 'positive' THEN 2 ELSE 3 END,
      now() + interval '1 day',
      jsonb_build_object('source', 'disposition_engine', 'session_id', p_session_id, 'disposition', v_disp.name)
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'disposition', v_disp.name,
    'category', v_disp.category,
    'follow_up_created', v_disp.creates_follow_up,
    'revenue_attributed', p_actual_revenue
  );
END;
$$;