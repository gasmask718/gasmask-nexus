CREATE OR REPLACE FUNCTION public.analyze_store_duplicate_groups()
RETURNS TABLE (
  duplicate_group_id integer,
  normalized_address text,
  group_size integer,
  store_id uuid,
  store_name text,
  raw_address text,
  phone text,
  created_at timestamptz,
  last_updated_at timestamptz,
  is_active boolean,
  invoices_count bigint,
  invoice_total_amount numeric,
  orders_count bigint,
  store_orders_count bigint,
  wholesale_orders_count bigint,
  store_payments_count bigint,
  store_transactions_count bigint,
  store_wallet_balance numeric,
  store_credits_count bigint,
  store_notes_count bigint,
  store_voice_notes_count bigint,
  store_contacts_count bigint,
  contact_profiles_count bigint,
  manual_call_logs_count bigint,
  call_recordings_count bigint,
  call_revenue_events_count bigint,
  call_revenue_attribution_count bigint,
  store_call_intelligence_count bigint,
  live_calls_count bigint,
  voicemails_count bigint,
  dialer_followups_count bigint,
  communication_events_count bigint,
  communication_messages_count bigint,
  messaging_targets_count bigint,
  contact_interactions_count bigint,
  route_stops_count bigint,
  route_checkins_count bigint,
  visit_logs_count bigint,
  store_visits_count bigint,
  deliveries_count bigint,
  location_events_count bigint,
  mission_items_count bigint,
  reminders_count bigint,
  followup_recommendations_count bigint,
  store_brand_relationships_count bigint,
  store_brand_stickers_count bigint,
  bag_sale_ledger_count bigint,
  tube_sale_ledger_count bigint,
  fraud_flags_count bigint,
  store_opportunities_count bigint,
  deals_count bigint,
  sales_prospects_count bigint,
  enrichment_count bigint,
  inventory_state_count bigint,
  pipeline_count bigint,
  messaging_log_count bigint,
  other_fk_count bigint,
  total_activity_score bigint,
  last_invoice_date timestamptz,
  last_call_date timestamptz,
  last_visit_date timestamptz,
  last_any_activity timestamptz,
  is_pristine_shell boolean,
  is_winner boolean,
  needs_manual_review boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH dup AS (
    SELECT d.duplicate_group_id AS gid, d.normalized_address AS norm_addr,
           d.store_count::int AS gsize, unnest(d.store_ids) AS sid
    FROM public.detect_store_address_duplicates() d
  ),
  base AS (
    SELECT dup.gid, dup.norm_addr, dup.gsize, s.id AS sid,
           s.name AS sname, s.address_street AS saddr, s.phone AS sphone,
           s.created_at AS s_created, s.updated_at AS s_updated,
           (s.deleted_at IS NULL) AS s_active
    FROM dup
    JOIN public.stores s ON s.id = dup.sid
  ),
  agg AS (
    SELECT b.sid AS asid,
      (SELECT COUNT(*) FROM public.invoices x WHERE x.store_id = b.sid AND x.deleted_at IS NULL) AS c_invoices,
      (SELECT COALESCE(SUM(COALESCE(x.total_amount, x.total, 0)),0) FROM public.invoices x WHERE x.store_id = b.sid AND x.deleted_at IS NULL) AS s_inv_total,
      (SELECT MAX(x.created_at) FROM public.invoices x WHERE x.store_id = b.sid AND x.deleted_at IS NULL) AS d_last_invoice,
      (SELECT COUNT(*) FROM public.orders x WHERE x.store_id = b.sid AND x.deleted_at IS NULL) AS c_orders,
      (SELECT COUNT(*) FROM public.store_orders x WHERE x.store_id = b.sid) AS c_storders,
      (SELECT COUNT(*) FROM public.wholesale_orders x WHERE x.store_id = b.sid) AS c_wholesale,
      (SELECT COUNT(*) FROM public.store_payments x WHERE x.store_id = b.sid) AS c_payments,
      (SELECT COUNT(*) FROM public.store_transactions x WHERE x.store_id = b.sid) AS c_txns,
      (SELECT COALESCE(SUM(x.balance),0) FROM public.store_wallet x WHERE x.store_id = b.sid) AS s_wallet,
      (SELECT COUNT(*) FROM public.store_credits x WHERE x.store_id = b.sid) AS c_credits,
      (SELECT COUNT(*) FROM public.store_notes x WHERE x.store_id = b.sid) AS c_notes,
      (SELECT COUNT(*) FROM public.store_voice_notes x WHERE x.store_id = b.sid) AS c_vnotes,
      (SELECT COUNT(*) FROM public.store_contacts x WHERE x.store_id = b.sid) AS c_contacts,
      (SELECT COUNT(*) FROM public.contact_profiles x WHERE x.store_id = b.sid) AS c_cprofiles,
      (SELECT COUNT(*) FROM public.manual_call_logs x WHERE x.store_id = b.sid) AS c_mcalls,
      (SELECT MAX(x.created_at) FROM public.manual_call_logs x WHERE x.store_id = b.sid) AS d_last_call,
      (SELECT COUNT(*) FROM public.call_recordings x WHERE x.store_id = b.sid) AS c_crecs,
      (SELECT COUNT(*) FROM public.call_revenue_events x WHERE x.store_id = b.sid) AS c_crev,
      (SELECT COUNT(*) FROM public.call_revenue_attribution x WHERE x.store_id = b.sid) AS c_crevattr,
      (SELECT COUNT(*) FROM public.store_call_intelligence x WHERE x.store_id = b.sid) AS c_callintel,
      (SELECT COUNT(*) FROM public.live_calls x WHERE x.store_id = b.sid) AS c_live,
      (SELECT COUNT(*) FROM public.voicemails x WHERE x.store_id = b.sid) AS c_vm,
      (SELECT COUNT(*) FROM public.dialer_followups x WHERE x.store_id = b.sid) AS c_dialfu,
      (SELECT COUNT(*) FROM public.communication_events x WHERE x.store_id = b.sid) AS c_commev,
      (SELECT COUNT(*) FROM public.communication_messages x WHERE x.store_id = b.sid) AS c_commmsg,
      (SELECT COUNT(*) FROM public.messaging_targets x WHERE x.store_id = b.sid) AS c_msgtgt,
      (SELECT COUNT(*) FROM public.contact_interactions x WHERE x.store_id = b.sid) AS c_cinter,
      (SELECT COUNT(*) FROM public.route_stops x WHERE x.store_id = b.sid) AS c_rstops,
      (SELECT COUNT(*) FROM public.route_checkins x WHERE x.store_id = b.sid) AS c_rchecks,
      (SELECT COUNT(*) FROM public.visit_logs x WHERE x.store_id = b.sid) AS c_vlogs,
      (SELECT MAX(x.created_at) FROM public.visit_logs x WHERE x.store_id = b.sid) AS d_last_visit,
      (SELECT COUNT(*) FROM public.store_visits x WHERE x.store_id = b.sid) AS c_svisits,
      (SELECT COUNT(*) FROM public.deliveries x WHERE x.store_id = b.sid) AS c_deliv,
      (SELECT COUNT(*) FROM public.location_events x WHERE x.store_id = b.sid) AS c_locev,
      (SELECT COUNT(*) FROM public.mission_items x WHERE x.store_id = b.sid) AS c_missions,
      (SELECT COUNT(*) FROM public.reminders x WHERE x.store_id = b.sid) AS c_reminders,
      (SELECT COUNT(*) FROM public.followup_recommendations x WHERE x.store_id = b.sid) AS c_fup,
      (SELECT COUNT(*) FROM public.store_brand_relationships x WHERE x.store_id = b.sid) AS c_brels,
      (SELECT COUNT(*) FROM public.store_brand_stickers x WHERE x.store_id = b.sid) AS c_bstk,
      (SELECT COUNT(*) FROM public.bag_sale_ledger x WHERE x.store_id = b.sid) AS c_bag,
      (SELECT COUNT(*) FROM public.tube_sale_ledger x WHERE x.store_id = b.sid) AS c_tube,
      (SELECT COUNT(*) FROM public.fraud_flags x WHERE x.store_id = b.sid) AS c_fraud,
      (SELECT COUNT(*) FROM public.store_opportunities x WHERE x.store_id = b.sid) AS c_opps,
      (SELECT COUNT(*) FROM public.deals x WHERE x.store_id = b.sid) AS c_deals,
      (SELECT COUNT(*) FROM public.sales_prospects x WHERE x.converted_store_id = b.sid) AS c_prospects,
      (SELECT COUNT(*) FROM public.contact_enrichment_candidates x WHERE x.store_id = b.sid) AS c_enrich,
      (SELECT COUNT(*) FROM public.store_tube_inventory_status x WHERE x.store_id = b.sid) AS c_invstate,
      0::bigint AS c_pipeline,
      ((SELECT COUNT(*) FROM public.messaging_messages x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.invoice_receipt_log x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.outbound_call_queue x WHERE x.store_id = b.sid)) AS c_msglog,
      ((SELECT COUNT(*) FROM public.agent_assignments x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.agent_store_memory x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.ai_call_logs x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.ai_call_sessions x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.ambassador_assignments x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.biker_assignments x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.biker_issues x WHERE x.location_id = b.sid) +
       (SELECT COUNT(*) FROM public.biker_routes x WHERE x.store_master_id = b.sid) +
       (SELECT COUNT(*) FROM public.brand_contact_store_links x WHERE x.store_master_id = b.sid) +
       (SELECT COUNT(*) FROM public.call_analytics x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.call_prediction_snapshots x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.call_priority_queue x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.call_quality_scores x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.call_reasons x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.campaign_call_queue x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.change_lists x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.checklist_additional_stores x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.checklist_delivery_orders x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.checklist_inventory_photos x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.checklist_sticker_visibility x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.checklist_tube_counts x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.checklist_tube_intelligence x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.commission_disputes x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.commission_ledger x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.commission_override_assignments x WHERE x.source_store_id = b.sid) +
       (SELECT COUNT(*) FROM public.communication_alerts x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.communication_escalations x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.communication_logs x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.conversation_routing x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.dispatch_triggers x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.driver_assignments x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.driver_route_stops x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.engagement_scores x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.field_submissions x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.follow_up_audit_log x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.follow_up_events x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.follow_up_queue x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.generated_assets x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.influencer_conversions x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.inventory_alerts x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.inventory_audit_log x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.inventory_events x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.inventory_stores x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.live_call_sessions x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.note_cleaning_log x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.outbound_personalized_scripts x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.outbound_predictions x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.outbound_queue x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.outreach_plans x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.pending_orders x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.pinned_notes x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.portal_invites x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.predictive_actions x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.predictive_autopilot_log x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.predictive_opportunity_scores x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.predictive_risk_scores x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.proactive_outreach_log x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.product_store_assignments x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.refund_tickets x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.route_insights x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.route_suggestion_stops x WHERE x.location_id = b.sid) +
       (SELECT COUNT(*) FROM public.store_ai_insights x WHERE x.store_master_id = b.sid) +
       (SELECT COUNT(*) FROM public.store_answer_profile x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.store_brand_accounts x WHERE x.store_master_id = b.sid) +
       (SELECT COUNT(*) FROM public.store_cadence_policy x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.store_escalations x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.store_inventory x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.store_people x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.store_performance_snapshots x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.store_product_predictions x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.store_product_state x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.store_questionnaire x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.store_revenue_recommendations x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.store_revenue_scores x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.store_rewards x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.store_status_history x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.store_subscriptions x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.store_tube_inventory x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.store_tube_switches x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.store_vertical_permissions x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.store_wholesaler_associations x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.store_wholesaler_contacts x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.user_invitations x WHERE x.assigned_store_id = b.sid) +
       (SELECT COUNT(*) FROM public.user_store_map x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.visit_products x WHERE x.store_id = b.sid) +
       (SELECT COUNT(*) FROM public.wholesaler_store_map x WHERE x.store_id = b.sid)
      ) AS c_other
    FROM base b
  ),
  combined AS (
    SELECT b.gid, b.norm_addr, b.gsize, b.sid AS bsid,
           b.sname, b.saddr, b.sphone, b.s_created, b.s_updated, b.s_active,
           a.*,
           (
             10 * (a.c_invoices + a.c_orders + a.c_storders + a.c_wholesale
                   + a.c_payments + a.c_txns + a.c_credits
                   + a.c_notes + a.c_vnotes
                   + a.c_contacts + a.c_cprofiles)
             + 5 * (a.c_mcalls + a.c_crecs + a.c_crev + a.c_crevattr + a.c_callintel
                    + a.c_live + a.c_vm + a.c_dialfu
                    + a.c_commev + a.c_commmsg + a.c_msgtgt + a.c_cinter
                    + a.c_rstops + a.c_rchecks + a.c_vlogs + a.c_svisits
                    + a.c_deliv + a.c_locev + a.c_missions + a.c_reminders + a.c_fup)
             + 2 * (a.c_brels + a.c_bstk + a.c_bag + a.c_tube
                    + a.c_fraud + a.c_opps + a.c_deals + a.c_prospects
                    + a.c_enrich + a.c_invstate + a.c_msglog)
             + 1 * (a.c_other)
           ) AS tas,
           GREATEST(
             COALESCE(a.d_last_invoice, 'epoch'::timestamptz),
             COALESCE(a.d_last_call, 'epoch'::timestamptz),
             COALESCE(a.d_last_visit, 'epoch'::timestamptz),
             COALESCE(b.s_updated, 'epoch'::timestamptz)
           ) AS lact
    FROM base b
    JOIN agg a ON a.asid = b.sid
  ),
  ranked AS (
    SELECT c.*,
      ROW_NUMBER() OVER (
        PARTITION BY c.gid
        ORDER BY c.tas DESC, c.lact DESC NULLS LAST, c.s_created ASC NULLS LAST, c.bsid ASC
      ) AS rnk,
      SUM(CASE WHEN c.tas > 0 THEN 1 ELSE 0 END) OVER (PARTITION BY c.gid) AS active_in_group
    FROM combined c
  )
  SELECT
    r.gid, r.norm_addr, r.gsize, r.bsid,
    r.sname, r.saddr, r.sphone, r.s_created, r.s_updated, r.s_active,
    r.c_invoices, r.s_inv_total, r.c_orders, r.c_storders,
    r.c_wholesale, r.c_payments, r.c_txns, r.s_wallet, r.c_credits,
    r.c_notes, r.c_vnotes, r.c_contacts, r.c_cprofiles,
    r.c_mcalls, r.c_crecs, r.c_crev, r.c_crevattr, r.c_callintel, r.c_live, r.c_vm, r.c_dialfu,
    r.c_commev, r.c_commmsg, r.c_msgtgt, r.c_cinter,
    r.c_rstops, r.c_rchecks, r.c_vlogs, r.c_svisits, r.c_deliv, r.c_locev,
    r.c_missions, r.c_reminders, r.c_fup,
    r.c_brels, r.c_bstk, r.c_bag, r.c_tube,
    r.c_fraud, r.c_opps, r.c_deals, r.c_prospects,
    r.c_enrich, r.c_invstate, r.c_pipeline, r.c_msglog,
    r.c_other,
    r.tas,
    r.d_last_invoice, r.d_last_call, r.d_last_visit,
    NULLIF(r.lact, 'epoch'::timestamptz),
    (r.tas = 0),
    (r.rnk = 1),
    (r.active_in_group >= 2)
  FROM ranked r
  ORDER BY r.gid, r.rnk;
END;
$$;

GRANT EXECUTE ON FUNCTION public.analyze_store_duplicate_groups() TO authenticated, supabase_read_only_user, service_role, anon;