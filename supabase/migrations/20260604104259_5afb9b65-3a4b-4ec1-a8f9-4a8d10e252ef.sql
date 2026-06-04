
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
      v_title:='Nightly route-candidate digest'; v_details:='Surface stores due for visit, stale routes, overdue deliveries.'; v_act:='route_digest';
    ELSIF w.worker_department='Intelligence' THEN
      v_title:='Daily anomaly summary'; v_details:='Scan revenue, calls, inventory vs trailing-7-day baseline.'; v_act:='anomaly_summary';
    ELSIF w.worker_department='Sales/CRM' THEN
      v_title:='Cold-store re-engagement candidates'; v_details:='Tier-2/3 stores with no contact in 14d.'; v_act:='reengagement_scan';
    ELSIF w.worker_department='Finance' THEN
      v_title:='Daily P&L drift check'; v_details:='Actuals vs forecast, flag deviations > 10%.'; v_act:='pnl_drift';
    ELSE
      v_title:=format('Daily briefing — %s', w.worker_department); v_details:='KPI snapshot + top 3 actionable items.'; v_act:='briefing';
    END IF;

    INSERT INTO public.ai_work_tasks(
      task_title, task_details, assigned_to_worker_id, auto_assigned,
      status, priority, department, task_type, execution_mode,
      input_data, risk_level, confidence_score
    ) VALUES (
      v_title, v_details, w.id, true, 'pending', 'medium', w.worker_department, v_act, 'recommendation_only',
      jsonb_build_object('source','floor9_engine_tick','tick_at',now()), 'low', 0.75
    ) RETURNING id INTO v_task_id;

    INSERT INTO public.ai_instinct_log(
      worker_id, task_id, action_type, input_data, reasoning,
      decision_path, confidence_score, created_at
    ) VALUES (
      w.id, v_task_id, v_act, jsonb_build_object('trigger','nightly'),
      format('Worker %s idle since %s — auto-queued %s',
             w.worker_name, COALESCE(to_char(w.last_task_at,'YYYY-MM-DD HH24:MI'),'never'), v_act),
      jsonb_build_array('check_idle','dept_template','queue'), 0.75, now()
    );

    INSERT INTO public.ai_action_queue(
      task_id, worker_id, action_type, action_summary,
      ai_recommendation, reasoning, risk_level, status, confidence_score
    ) VALUES (
      v_task_id, w.id, v_act,
      format('Run %s for %s', v_act, w.worker_name),
      v_title,
      jsonb_build_object('details', v_details, 'source','floor9_engine_tick'),
      'low', 'pending', 0.75
    );

    v_created := v_created + 1;
  END LOOP;
  RETURN jsonb_build_object('ok',true,'tasks_created',v_created,'workers_blocked',v_blocked,'tick_at',now());
END; $$;
GRANT EXECUTE ON FUNCTION public.floor9_engine_tick() TO authenticated, service_role;
