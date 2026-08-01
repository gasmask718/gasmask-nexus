
CREATE OR REPLACE FUNCTION public.is_sbo_operator(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::app_role,'owner'::app_role,'developer'::app_role,'staff'::app_role)
  )
$$;

-- ===== BUCKET c1: fully-open (public) policies =====
DROP POLICY IF EXISTS "Allow all access to sbo_automation_log" ON public.sbo_automation_log;
DROP POLICY IF EXISTS "Allow all access to sbo_parlay_builder" ON public.sbo_parlay_builder;
DROP POLICY IF EXISTS "Allow all access to sbo_parlay_legs" ON public.sbo_parlay_legs;
DROP POLICY IF EXISTS "Allow all on sbo_results_verification" ON public.sbo_results_verification;
DROP POLICY IF EXISTS "Allow all operations on sbo_saved_picks" ON public.sbo_saved_picks;
DROP POLICY IF EXISTS "Allow all access to signal inputs" ON public.sbo_signal_inputs;
DROP POLICY IF EXISTS "Allow all access to sbo_sms_recipients" ON public.sbo_sms_recipients;
DROP POLICY IF EXISTS "Allow all access to sbo_sms_sends_log" ON public.sbo_sms_sends_log;
DROP POLICY IF EXISTS "Allow all access to weighted picks" ON public.sbo_weighted_picks;
DROP POLICY IF EXISTS "Auth insert sbo_signal_performance" ON public.sbo_signal_performance;
DROP POLICY IF EXISTS "Auth update sbo_signal_performance" ON public.sbo_signal_performance;
DROP POLICY IF EXISTS "Service can insert unified props" ON public.sbo_unified_props;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sbo_automation_log','sbo_parlay_builder','sbo_parlay_legs','sbo_results_verification',
    'sbo_saved_picks','sbo_signal_inputs','sbo_sms_recipients','sbo_sms_sends_log',
    'sbo_weighted_picks','sbo_signal_performance','sbo_unified_props',
    'sbo_capper_picks','sbo_cappers','sbo_tracked_wallets','sbo_wallet_activity',
    'sbo_capper_performance','sbo_capper_roi','sbo_decision_weight_history','sbo_dynamic_weights',
    'sbo_external_results','sbo_function_logs','sbo_learning_events','sbo_pm_tracked_wallets',
    'sbo_pm_wallet_events','sbo_pm_wallet_positions','sbo_pm_wallet_scores','sbo_pm_wallet_snapshots',
    'sbo_prop_predictions'
  ]
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    -- ensure signed-in read access survives dropped ALL policies
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND cmd='SELECT'
    ) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', 'auth_read_'||t, t);
    END IF;
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_sbo_operator())', 'operator_insert_'||t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_sbo_operator()) WITH CHECK (public.is_sbo_operator())', 'operator_update_'||t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_sbo_operator())', 'operator_delete_'||t, t);
  END LOOP;
END $$;

-- ===== BUCKET c2: authenticated-can-do-anything =====
DROP POLICY IF EXISTS "Authenticated users can manage capper picks" ON public.sbo_capper_picks;
DROP POLICY IF EXISTS "Authenticated users can manage cappers" ON public.sbo_cappers;
DROP POLICY IF EXISTS "Authenticated users can manage wallets" ON public.sbo_tracked_wallets;
DROP POLICY IF EXISTS "Authenticated users can manage wallet activity" ON public.sbo_wallet_activity;

-- ===== BUCKET c3: permissive write policies for authenticated =====
DROP POLICY IF EXISTS "Auth insert sbo_capper_performance" ON public.sbo_capper_performance;
DROP POLICY IF EXISTS "Auth update sbo_capper_performance" ON public.sbo_capper_performance;
DROP POLICY IF EXISTS "Auth insert sbo_capper_roi" ON public.sbo_capper_roi;
DROP POLICY IF EXISTS "Auth update sbo_capper_roi" ON public.sbo_capper_roi;
DROP POLICY IF EXISTS "Allow authenticated insert on sbo_decision_weight_history" ON public.sbo_decision_weight_history;
DROP POLICY IF EXISTS "Allow authenticated insert sbo_decision_weight_history" ON public.sbo_decision_weight_history;
DROP POLICY IF EXISTS "Allow authenticated update sbo_dynamic_weights" ON public.sbo_dynamic_weights;
DROP POLICY IF EXISTS "Allow authenticated insert on sbo_external_results" ON public.sbo_external_results;
DROP POLICY IF EXISTS "Service role can insert function logs" ON public.sbo_function_logs;
DROP POLICY IF EXISTS "Service role can update function logs" ON public.sbo_function_logs;
DROP POLICY IF EXISTS "Allow authenticated insert sbo_learning_events" ON public.sbo_learning_events;
DROP POLICY IF EXISTS "Allow authenticated delete sbo_pm_tracked_wallets" ON public.sbo_pm_tracked_wallets;
DROP POLICY IF EXISTS "Allow authenticated insert sbo_pm_tracked_wallets" ON public.sbo_pm_tracked_wallets;
DROP POLICY IF EXISTS "Allow authenticated update sbo_pm_tracked_wallets" ON public.sbo_pm_tracked_wallets;
DROP POLICY IF EXISTS "Allow authenticated insert sbo_pm_wallet_events" ON public.sbo_pm_wallet_events;
DROP POLICY IF EXISTS "Allow authenticated insert sbo_pm_wallet_positions" ON public.sbo_pm_wallet_positions;
DROP POLICY IF EXISTS "Allow authenticated update sbo_pm_wallet_positions" ON public.sbo_pm_wallet_positions;
DROP POLICY IF EXISTS "Allow authenticated insert sbo_pm_wallet_scores" ON public.sbo_pm_wallet_scores;
DROP POLICY IF EXISTS "Allow authenticated update sbo_pm_wallet_scores" ON public.sbo_pm_wallet_scores;
DROP POLICY IF EXISTS "Allow authenticated insert sbo_pm_wallet_snapshots" ON public.sbo_pm_wallet_snapshots;
DROP POLICY IF EXISTS "Allow authenticated insert sbo_prop_predictions" ON public.sbo_prop_predictions;
DROP POLICY IF EXISTS "Allow authenticated update sbo_prop_predictions" ON public.sbo_prop_predictions;
