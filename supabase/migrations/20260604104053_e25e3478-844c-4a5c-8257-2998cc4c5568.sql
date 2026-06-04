
CREATE OR REPLACE FUNCTION public.has_ai_permission(_domain text, _action text DEFAULT 'execute')
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_global_kill boolean; v_domain_kill boolean; v_autopilot boolean; v_allowed boolean;
  v_reason text;
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
  v_reason := CASE
    WHEN v_global_kill THEN 'global_kill_switch_active'
    WHEN v_domain_kill THEN 'domain_kill_switch_active'
    WHEN NOT COALESCE(v_autopilot,true) THEN 'autopilot_disabled'
    ELSE NULL
  END;

  INSERT INTO public.ai_decision_log(
    ai_agent, action_key, permission_allowed, permission_source,
    decision_payload, blocked_reason, enforcement_source, actor, created_at
  ) VALUES (
    'has_ai_permission', _domain || ':' || _action, v_allowed, 'has_ai_permission()',
    jsonb_build_object('domain',_domain,'action',_action,
      'global_kill',v_global_kill,'domain_kill',v_domain_kill,'autopilot',v_autopilot),
    v_reason, 'db_function', 'system', now()
  );
  RETURN v_allowed;
END; $$;
GRANT EXECUTE ON FUNCTION public.has_ai_permission(text,text) TO authenticated, service_role, anon;
