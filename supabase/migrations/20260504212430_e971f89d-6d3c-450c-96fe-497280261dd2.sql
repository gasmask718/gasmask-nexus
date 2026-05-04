-- Strip guard
CREATE OR REPLACE FUNCTION public.refresh_merge_analysis_cache()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_started timestamptz := clock_timestamp(); v_completed timestamptz; v_rows int;
BEGIN
  DELETE FROM public.dynasty_merge_analysis_cache;
  INSERT INTO public.dynasty_merge_analysis_cache (
    store_id, duplicate_group_id, normalized_address, group_size, store_name, raw_address, phone,
    created_at, last_updated_at, is_active,
    invoices_count, invoice_total_amount, orders_count, store_orders_count, wholesale_orders_count,
    store_payments_count, store_transactions_count, store_wallet_balance, store_credits_count,
    store_notes_count, store_voice_notes_count, store_contacts_count, contact_profiles_count,
    manual_call_logs_count, call_recordings_count, call_revenue_events_count, call_revenue_attribution_count,
    store_call_intelligence_count, live_calls_count, voicemails_count, dialer_followups_count,
    communication_events_count, communication_messages_count, messaging_targets_count,
    contact_interactions_count, route_stops_count, route_checkins_count, visit_logs_count,
    store_visits_count, deliveries_count, location_events_count, mission_items_count, reminders_count,
    followup_recommendations_count, store_brand_relationships_count, store_brand_stickers_count,
    bag_sale_ledger_count, tube_sale_ledger_count, fraud_flags_count, store_opportunities_count,
    deals_count, sales_prospects_count, enrichment_count, inventory_state_count, pipeline_count,
    messaging_log_count, other_fk_count, total_activity_score,
    last_invoice_date, last_call_date, last_visit_date, last_any_activity,
    is_pristine_shell, is_winner, needs_manual_review)
  SELECT a.store_id, a.duplicate_group_id, a.normalized_address, a.group_size, a.store_name, a.raw_address, a.phone,
    a.created_at, a.last_updated_at, a.is_active,
    a.invoices_count, a.invoice_total_amount, a.orders_count, a.store_orders_count, a.wholesale_orders_count,
    a.store_payments_count, a.store_transactions_count, a.store_wallet_balance, a.store_credits_count,
    a.store_notes_count, a.store_voice_notes_count, a.store_contacts_count, a.contact_profiles_count,
    a.manual_call_logs_count, a.call_recordings_count, a.call_revenue_events_count, a.call_revenue_attribution_count,
    a.store_call_intelligence_count, a.live_calls_count, a.voicemails_count, a.dialer_followups_count,
    a.communication_events_count, a.communication_messages_count, a.messaging_targets_count,
    a.contact_interactions_count, a.route_stops_count, a.route_checkins_count, a.visit_logs_count,
    a.store_visits_count, a.deliveries_count, a.location_events_count, a.mission_items_count, a.reminders_count,
    a.followup_recommendations_count, a.store_brand_relationships_count, a.store_brand_stickers_count,
    a.bag_sale_ledger_count, a.tube_sale_ledger_count, a.fraud_flags_count, a.store_opportunities_count,
    a.deals_count, a.sales_prospects_count, a.enrichment_count, a.inventory_state_count, a.pipeline_count,
    a.messaging_log_count, a.other_fk_count, a.total_activity_score,
    a.last_invoice_date, a.last_call_date, a.last_visit_date, a.last_any_activity,
    a.is_pristine_shell, a.is_winner, a.needs_manual_review
  FROM public.analyze_store_duplicate_groups() a;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_completed := clock_timestamp();
  UPDATE public.dynasty_merge_analysis_cache_meta
     SET last_refreshed_at = v_completed,
         last_refresh_duration_seconds = EXTRACT(EPOCH FROM (v_completed - v_started)),
         rows_cached = v_rows,
         refreshed_by = auth.uid()
   WHERE id = 1;
  RETURN jsonb_build_object('rows_cached', v_rows,'started_at', v_started,'completed_at', v_completed,'duration_seconds', EXTRACT(EPOCH FROM (v_completed - v_started)));
END; $function$;

-- Run it and log
DO $$
DECLARE v jsonb;
BEGIN
  SELECT public.refresh_merge_analysis_cache() INTO v;
  INSERT INTO public.dynasty_change_log (change_type, entity_type, entity_id, after_data, notes, session_label)
  VALUES ('merge_cache_refresh','session',gen_random_uuid(),v,'Post-extraction cache refresh','fix-001i-extract-addresses-2026-05-04');
END $$;

-- Restore guard
CREATE OR REPLACE FUNCTION public.refresh_merge_analysis_cache()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_started timestamptz := clock_timestamp(); v_completed timestamptz; v_rows int;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner')) THEN
    RAISE EXCEPTION 'Not authorized'; END IF;
  DELETE FROM public.dynasty_merge_analysis_cache;
  INSERT INTO public.dynasty_merge_analysis_cache (
    store_id, duplicate_group_id, normalized_address, group_size, store_name, raw_address, phone,
    created_at, last_updated_at, is_active,
    invoices_count, invoice_total_amount, orders_count, store_orders_count, wholesale_orders_count,
    store_payments_count, store_transactions_count, store_wallet_balance, store_credits_count,
    store_notes_count, store_voice_notes_count, store_contacts_count, contact_profiles_count,
    manual_call_logs_count, call_recordings_count, call_revenue_events_count, call_revenue_attribution_count,
    store_call_intelligence_count, live_calls_count, voicemails_count, dialer_followups_count,
    communication_events_count, communication_messages_count, messaging_targets_count,
    contact_interactions_count, route_stops_count, route_checkins_count, visit_logs_count,
    store_visits_count, deliveries_count, location_events_count, mission_items_count, reminders_count,
    followup_recommendations_count, store_brand_relationships_count, store_brand_stickers_count,
    bag_sale_ledger_count, tube_sale_ledger_count, fraud_flags_count, store_opportunities_count,
    deals_count, sales_prospects_count, enrichment_count, inventory_state_count, pipeline_count,
    messaging_log_count, other_fk_count, total_activity_score,
    last_invoice_date, last_call_date, last_visit_date, last_any_activity,
    is_pristine_shell, is_winner, needs_manual_review)
  SELECT a.store_id, a.duplicate_group_id, a.normalized_address, a.group_size, a.store_name, a.raw_address, a.phone,
    a.created_at, a.last_updated_at, a.is_active,
    a.invoices_count, a.invoice_total_amount, a.orders_count, a.store_orders_count, a.wholesale_orders_count,
    a.store_payments_count, a.store_transactions_count, a.store_wallet_balance, a.store_credits_count,
    a.store_notes_count, a.store_voice_notes_count, a.store_contacts_count, a.contact_profiles_count,
    a.manual_call_logs_count, a.call_recordings_count, a.call_revenue_events_count, a.call_revenue_attribution_count,
    a.store_call_intelligence_count, a.live_calls_count, a.voicemails_count, a.dialer_followups_count,
    a.communication_events_count, a.communication_messages_count, a.messaging_targets_count,
    a.contact_interactions_count, a.route_stops_count, a.route_checkins_count, a.visit_logs_count,
    a.store_visits_count, a.deliveries_count, a.location_events_count, a.mission_items_count, a.reminders_count,
    a.followup_recommendations_count, a.store_brand_relationships_count, a.store_brand_stickers_count,
    a.bag_sale_ledger_count, a.tube_sale_ledger_count, a.fraud_flags_count, a.store_opportunities_count,
    a.deals_count, a.sales_prospects_count, a.enrichment_count, a.inventory_state_count, a.pipeline_count,
    a.messaging_log_count, a.other_fk_count, a.total_activity_score,
    a.last_invoice_date, a.last_call_date, a.last_visit_date, a.last_any_activity,
    a.is_pristine_shell, a.is_winner, a.needs_manual_review
  FROM public.analyze_store_duplicate_groups() a;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_completed := clock_timestamp();
  UPDATE public.dynasty_merge_analysis_cache_meta
     SET last_refreshed_at = v_completed,
         last_refresh_duration_seconds = EXTRACT(EPOCH FROM (v_completed - v_started)),
         rows_cached = v_rows,
         refreshed_by = auth.uid()
   WHERE id = 1;
  RETURN jsonb_build_object('rows_cached', v_rows,'started_at', v_started,'completed_at', v_completed,'duration_seconds', EXTRACT(EPOCH FROM (v_completed - v_started)));
END; $function$;