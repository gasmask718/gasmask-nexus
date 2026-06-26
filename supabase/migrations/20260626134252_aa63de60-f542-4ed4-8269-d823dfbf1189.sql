
-- =====================================================================
-- TIER 1 — Enable RLS + admin/owner policy on the 65 exposed tables
-- =====================================================================
DO $$
DECLARE
  t text;
  exposed text[] := ARRAY[
    '_merge_matrix_results','_quarantine_misclassified_stores','ai_dispatch_feedback',
    'brandaro_event_failures','brandaro_framework_stats','brandaro_industry_intelligence',
    'brandaro_market_intelligence','brandaro_payment_links','brandaro_pending_messages',
    'dc_business_pipelines','legacy_invoice_price_map','platform_settings',
    'sales_mastery_call_scores','sales_mastery_coaching_triggers','sales_mastery_leaderboard',
    'sales_mastery_objections',
    'sbo_accuracy_log','sbo_actual_bets','sbo_api_budget','sbo_api_costs','sbo_arbitrage',
    'sbo_bankroll','sbo_bettor_profile','sbo_calibration','sbo_clv_tracker',
    'sbo_daily_briefings','sbo_daily_profit_plan','sbo_day_engine_runs',
    'sbo_defense_vs_position','sbo_game_intelligence','sbo_games','sbo_hedge_engine',
    'sbo_injuries','sbo_line_movement','sbo_live_picks','sbo_model_performance',
    'sbo_odds','sbo_odds_comparison','sbo_parlay_payouts','sbo_parlays',
    'sbo_player_game_logs','sbo_player_projections','sbo_player_props',
    'sbo_player_season_stats','sbo_polymarket','sbo_polymarket_markets',
    'sbo_polymarket_signals','sbo_predictions','sbo_prop_correlations','sbo_run_log',
    'sbo_sdio_props','sbo_simulations','sbo_sms_log','sbo_sync_log','sbo_team_stats',
    'sbo_unit_log','sbo_user_books','sbo_va_sessions','sbo_wealth_sync',
    'sbo_weight_history',
    'ut_rfq_requests','ut_rfq_supplier_responses','ut_shipments','ut_shipping_quotes',
    'ut_supplier_conversations'
  ];
BEGIN
  FOREACH t IN ARRAY exposed LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);

    -- Drop any prior baseline policy of the same name (idempotent)
    EXECUTE format('DROP POLICY IF EXISTS "Admins and owners full access" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Admins and owners full access" ON public.%I
         FOR ALL TO authenticated
         USING (public.has_role(auth.uid(),''admin''::public.app_role)
             OR public.has_role(auth.uid(),''owner''::public.app_role))
         WITH CHECK (public.has_role(auth.uid(),''admin''::public.app_role)
             OR public.has_role(auth.uid(),''owner''::public.app_role))', t);
  END LOOP;
END $$;

-- =====================================================================
-- TIER 2 — Add baseline policies to the 13 RLS-enabled / no-policy tables
-- Admin + owner can read & manage; service_role retains full access via GRANT
-- =====================================================================
DO $$
DECLARE
  t text;
  locked text[] := ARRAY[
    'ai_scoring_runs','brandaro_auto_actions','dd_email_suppressions',
    'dropship_orders','dropship_revenue','dynasty_os_api_logs','email_jobs',
    'note_cleaning_log','review_summary_jobs','sbo_backfill_log',
    'sbo_capper_aliases','trending_products','tt_dispatch_tokens'
  ];
BEGIN
  FOREACH t IN ARRAY locked LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);

    EXECUTE format('DROP POLICY IF EXISTS "Admins and owners full access" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Admins and owners full access" ON public.%I
         FOR ALL TO authenticated
         USING (public.has_role(auth.uid(),''admin''::public.app_role)
             OR public.has_role(auth.uid(),''owner''::public.app_role))
         WITH CHECK (public.has_role(auth.uid(),''admin''::public.app_role)
             OR public.has_role(auth.uid(),''owner''::public.app_role))', t);
  END LOOP;
END $$;

-- =====================================================================
-- TIER 3 — Recreate v_public_store_locator with security_invoker
-- =====================================================================
DROP VIEW IF EXISTS public.v_public_store_locator;
CREATE VIEW public.v_public_store_locator
  WITH (security_invoker = true) AS
SELECT sm.id AS store_id,
       sm.store_name,
       COALESCE(s.neighborhood, b.name) AS neighborhood,
       s.address_city  AS city,
       s.address_street AS street,
       s.lat,
       s.lng
  FROM public.store_master sm
  JOIN public.stores s ON s.id = sm.id
  LEFT JOIN public.boroughs b ON b.id = sm.borough_id
 WHERE sm.deleted_at IS NULL
   AND s.deleted_at IS NULL
   AND sm.status = 'active'
   AND COALESCE(s.is_simulation, false) = false
   AND COALESCE(s.is_test_data, false) = false
   AND s.lat IS NOT NULL
   AND s.lng IS NOT NULL;

GRANT SELECT ON public.v_public_store_locator TO anon, authenticated;
