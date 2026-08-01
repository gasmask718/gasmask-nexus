DO $$
DECLARE
  t text;
  p record;
  tbls text[] := ARRAY[
    'sbo_clamp_readiness','sbo_decision_weight_history','sbo_dynamic_weights',
    'sbo_external_match_logs','sbo_external_results','sbo_function_logs',
    'sbo_learning_events','sbo_pm_tracked_wallets','sbo_pm_wallet_events',
    'sbo_pm_wallet_positions','sbo_pm_wallet_scores','sbo_pm_wallet_snapshots',
    'sbo_prop_predictions','sbo_prop_stat_context','sbo_telegram_posts',
    'sbo_top_plays','sbo_analysis_jobs','sbo_capper_performance','sbo_capper_roi',
    'sbo_signal_performance','sbo_prop_accuracy','sbo_unified_props'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    IF to_regclass('public.'||t) IS NULL THEN CONTINUE; END IF;

    -- drop every existing SELECT policy that is not service_role-scoped
    FOR p IN
      SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename=t AND cmd='SELECT'
        AND NOT ('service_role' = ANY(roles))
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;

    -- also drop any permissive ALL policies open to public/authenticated
    FOR p IN
      SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename=t AND cmd='ALL'
        AND NOT ('service_role' = ANY(roles))
        AND coalesce(qual,'true') = 'true'
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_sbo_operator())',
      'operator_select_'||t, t);

    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;