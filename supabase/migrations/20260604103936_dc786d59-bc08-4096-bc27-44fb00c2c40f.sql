
-- =====================================================================
-- T4a: Producer Pipelines (AI + Comms engines) — retry
-- =====================================================================

CREATE OR REPLACE FUNCTION public.has_ai_permission(_domain text, _action text DEFAULT 'execute')
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_global_kill boolean; v_domain_kill boolean; v_autopilot boolean; v_allowed boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.ai_kill_switch_state WHERE is_active=true AND scope='global')
    INTO v_global_kill;
  SELECT EXISTS(
    SELECT 1 FROM public.ai_kill_switch_state
    WHERE is_active=true AND (scope=_domain OR activation_reason ILIKE '%'||_domain||'%')
  ) INTO v_domain_kill;
  SELECT COALESCE(autopilot_enabled,true) INTO v_autopilot
  FROM public.autopilot_settings ORDER BY updated_at DESC NULLS LAST LIMIT 1;
  v_allowed := NOT v_global_kill AND NOT v_domain_kill AND COALESCE(v_autopilot,true);

  INSERT INTO public.ai_decision_log(
    decision_type, decision_outcome, reasoning, input_data, confidence_score, created_at
  ) VALUES (
    'permission_check',
    CASE WHEN v_allowed THEN 'allowed' ELSE 'blocked' END,
    format('domain=%s action=%s global_kill=%s domain_kill=%s autopilot=%s',
           _domain, _action, v_global_kill, v_domain_kill, v_autopilot),
    jsonb_build_object('domain',_domain,'action',_action),
    CASE WHEN v_allowed THEN 1.0 ELSE 0.0 END, now()
  );
  RETURN v_allowed;
END; $$;
GRANT EXECUTE ON FUNCTION public.has_ai_permission(text,text) TO authenticated, service_role, anon;

-- engagement_scores unique key BEFORE the tick that needs it
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='engagement_scores_business_store_unique') THEN
    BEGIN
      ALTER TABLE public.engagement_scores
        ADD CONSTRAINT engagement_scores_business_store_unique UNIQUE (business_id, store_id);
    EXCEPTION WHEN others THEN NULL; END;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.floor9_engine_tick()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w record; v_task_id uuid; v_title text; v_details text; v_act text;
  v_created int := 0; v_blocked int := 0;
BEGIN
  FOR w IN
    SELECT id, worker_name, worker_role, worker_department, status, last_task_at
    FROM public.ai_workers
    WHERE status='active'
      AND (last_task_at IS NULL OR last_task_at < now() - interval '20 hours')
  LOOP
    IF NOT public.has_ai_permission(lower(coalesce(w.worker_department,'general')),'queue_task') THEN
      v_blocked := v_blocked + 1; CONTINUE;
    END IF;
    IF w.worker_department='Operations' THEN
      v_title:='Nightly route-candidate digest';
      v_details:='Surface stores due for visit, stale routes, overdue deliveries.';
      v_act:='route_digest';
    ELSIF w.worker_department='Intelligence' THEN
      v_title:='Daily anomaly summary';
      v_details:='Scan revenue, calls, inventory vs trailing-7-day baseline.';
      v_act:='anomaly_summary';
    ELSIF w.worker_department='Sales/CRM' THEN
      v_title:='Cold-store re-engagement candidates';
      v_details:='Tier-2/3 stores with no contact in 14d.';
      v_act:='reengagement_scan';
    ELSIF w.worker_department='Finance' THEN
      v_title:='Daily P&L drift check';
      v_details:='Actuals vs forecast, flag deviations > 10%.';
      v_act:='pnl_drift';
    ELSE
      v_title:=format('Daily briefing — %s', w.worker_department);
      v_details:='KPI snapshot + top 3 actionable items.';
      v_act:='briefing';
    END IF;

    INSERT INTO public.ai_work_tasks(
      task_title, task_details, assigned_to_worker_id, auto_assigned,
      status, priority, department, task_type, execution_mode,
      input_data, risk_level, confidence_score
    ) VALUES (
      v_title, v_details, w.id, true,
      'pending', 'medium', w.worker_department, v_act, 'shadow',
      jsonb_build_object('source','floor9_engine_tick','tick_at',now()),
      'low', 0.75
    ) RETURNING id INTO v_task_id;

    INSERT INTO public.ai_instinct_log(
      worker_id, task_id, action_type, input_data, reasoning,
      decision_path, confidence_score, created_at
    ) VALUES (
      w.id, v_task_id, v_act,
      jsonb_build_object('trigger','nightly'),
      format('Worker %s idle since %s — auto-queued %s',
             w.worker_name, COALESCE(to_char(w.last_task_at,'YYYY-MM-DD HH24:MI'),'never'), v_act),
      jsonb_build_array('check_idle','dept_template','queue'),
      0.75, now()
    );

    INSERT INTO public.ai_action_queue(
      task_id, worker_id, action_type, action_summary,
      ai_recommendation, reasoning, risk_level, status, confidence_score
    ) VALUES (
      v_task_id, w.id, v_act,
      format('Run %s for %s', v_act, w.worker_name),
      v_title, v_details, 'low', 'pending', 0.75
    );

    v_created := v_created + 1;
  END LOOP;
  RETURN jsonb_build_object('ok',true,'tasks_created',v_created,'workers_blocked',v_blocked,'tick_at',now());
END; $$;
GRANT EXECUTE ON FUNCTION public.floor9_engine_tick() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.engagement_scores_tick()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows int;
BEGIN
  IF NOT public.has_ai_permission('communication','aggregate') THEN
    RETURN jsonb_build_object('ok',false,'blocked',true);
  END IF;
  WITH agg AS (
    SELECT business_id, store_id,
      count(*) FILTER (WHERE direction='inbound')::numeric AS inbound_n,
      count(*) FILTER (WHERE direction='outbound')::numeric AS outbound_n,
      count(*) AS total_n,
      max(created_at) FILTER (WHERE direction='inbound') AS last_in,
      max(created_at) FILTER (WHERE direction='outbound') AS last_out,
      avg(CASE sentiment WHEN 'positive' THEN 1 WHEN 'negative' THEN -1 ELSE 0 END)::numeric AS sent_avg
    FROM public.communication_messages
    WHERE store_id IS NOT NULL AND created_at > now() - interval '60 days'
    GROUP BY business_id, store_id
  )
  INSERT INTO public.engagement_scores(
    business_id, store_id, score, response_rate, last_contact, last_inbound, last_outbound,
    total_messages, sentiment_trend, ai_notes, updated_at
  )
  SELECT business_id, store_id,
    LEAST(100, GREATEST(0,
      ROUND( (CASE WHEN outbound_n>0 THEN (inbound_n/outbound_n)*40 ELSE 0 END)
           + GREATEST(0, 40 - EXTRACT(EPOCH FROM (now()-GREATEST(last_in,last_out)))/86400)
           + (COALESCE(sent_avg,0)*20+20)
      )::int
    )),
    CASE WHEN outbound_n>0 THEN ROUND(inbound_n/outbound_n,3) ELSE 0 END,
    GREATEST(last_in,last_out), last_in, last_out, total_n::int,
    CASE WHEN sent_avg>0.2 THEN 'rising' WHEN sent_avg<-0.2 THEN 'falling' ELSE 'stable' END,
    'auto-computed by engagement_scores_tick', now()
  FROM agg
  ON CONFLICT (business_id, store_id) DO UPDATE SET
    score = EXCLUDED.score,
    response_rate = EXCLUDED.response_rate,
    last_contact = EXCLUDED.last_contact,
    last_inbound = EXCLUDED.last_inbound,
    last_outbound = EXCLUDED.last_outbound,
    total_messages = EXCLUDED.total_messages,
    sentiment_trend = EXCLUDED.sentiment_trend,
    updated_at = now();
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object('ok',true,'rows',v_rows);
END; $$;
GRANT EXECUTE ON FUNCTION public.engagement_scores_tick() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ingest_bland_cost_tick()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows int;
BEGIN
  IF NOT public.has_ai_permission('cost_ingest','bland') THEN
    RETURN jsonb_build_object('ok',false,'blocked',true);
  END IF;
  INSERT INTO public.call_cost_events(
    call_sid, duration_seconds, billable_minutes, estimated_cost, rate_per_minute,
    carrier, cost_type, created_at
  )
  SELECT dac.call_id, COALESCE(dac.duration_seconds,0),
    ROUND(COALESCE(dac.duration_seconds,0)/60.0,2),
    ROUND(COALESCE(dac.cost_cents,0)/100.0,4), 0.09, 'bland', 'ai_call',
    COALESCE(dac.call_ended_at, dac.created_at, now())
  FROM public.dynasty_ai_calls dac
  WHERE COALESCE(dac.call_ended_at, dac.created_at) > now() - interval '7 days'
    AND NOT EXISTS (
      SELECT 1 FROM public.call_cost_events cce
      WHERE cce.call_sid = dac.call_id AND cce.carrier='bland'
    );
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object('ok',true,'rows_inserted',v_rows);
END; $$;
GRANT EXECUTE ON FUNCTION public.ingest_bland_cost_tick() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ingest_twilio_cost_tick()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows int;
BEGIN
  IF NOT public.has_ai_permission('cost_ingest','twilio') THEN
    RETURN jsonb_build_object('ok',false,'blocked',true);
  END IF;
  INSERT INTO public.call_cost_events(
    business_id, queue_item_id, call_sid, duration_seconds, billable_minutes,
    estimated_cost, rate_per_minute, carrier, cost_type, created_at
  )
  SELECT tcl.business_id, tcl.queue_item_id, tcl.call_sid,
    COALESCE(tcl.duration,0), ROUND(COALESCE(tcl.duration,0)/60.0,2),
    ROUND((COALESCE(tcl.duration,0)/60.0)*0.022,4), 0.022, 'twilio', 'voice',
    COALESCE(tcl.created_at, now())
  FROM public.twilio_call_logs tcl
  WHERE tcl.created_at > now() - interval '7 days'
    AND NOT EXISTS (
      SELECT 1 FROM public.call_cost_events cce
      WHERE cce.call_sid = tcl.call_sid AND cce.carrier='twilio'
    );
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object('ok',true,'rows_inserted',v_rows);
END; $$;
GRANT EXECUTE ON FUNCTION public.ingest_twilio_cost_tick() TO authenticated, service_role;

INSERT INTO public.health_checks(check_key, kind, business, floor, label, cadence_expected_minutes, enabled)
VALUES
  ('floor9_engine_tick',      'cron',    'gasmask','Floor 9', 'Floor 9 producer tick',           60,   true),
  ('engagement_scores_tick',  'cron',    'gasmask','Floor 2', 'Engagement scores aggregator',    180,  true),
  ('ingest_bland_cost_tick',  'cron',    'gasmask','Finance', 'Bland.ai cost ingestion',         1440, true),
  ('ingest_twilio_cost_tick', 'cron',    'gasmask','Finance', 'Twilio cost ingestion',           1440, true),
  ('call_shadow_predictor',   'trigger', 'gasmask','Floor 9', 'Shadow predictions on live calls', 60,  true)
ON CONFLICT (check_key) DO UPDATE
  SET label = EXCLUDED.label,
      cadence_expected_minutes = EXCLUDED.cadence_expected_minutes,
      enabled = EXCLUDED.enabled,
      updated_at = now();

UPDATE public.floor_directory
   SET status='ready', last_audited=now()
 WHERE page_route IN ('/ai/workforce','/finance/cost-dashboard','/dynasty-automations');
