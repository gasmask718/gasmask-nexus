-- ============================================================================
-- STORE MERGE PREVIEW INFRASTRUCTURE (READ-ONLY ANALYSIS)
-- ============================================================================
-- Creates: 2 tables (dynasty_merge_overrides, dynasty_merge_skiplist)
--          3 functions (analyze_store_duplicate_groups,
--                       analyze_store_duplicate_groups_summary,
--                       detect_data_duplicates_in_group)
-- Does NOT modify: any store records, detect_store_address_duplicates(),
--                  normalize_store_address(), RLS on existing tables,
--                  bulk upload code, ingestion wizard.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. OVERRIDE / SKIPLIST TABLES
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.dynasty_merge_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  duplicate_group_id integer NOT NULL,
  normalized_address text NOT NULL,
  manual_winner_store_id uuid NOT NULL,
  reason text,
  set_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  set_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merge_overrides_group ON public.dynasty_merge_overrides(duplicate_group_id);
CREATE INDEX IF NOT EXISTS idx_merge_overrides_addr ON public.dynasty_merge_overrides(normalized_address);

ALTER TABLE public.dynasty_merge_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners and admins can manage merge overrides" ON public.dynasty_merge_overrides;
CREATE POLICY "Owners and admins can manage merge overrides"
ON public.dynasty_merge_overrides
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));


CREATE TABLE IF NOT EXISTS public.dynasty_merge_skiplist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  duplicate_group_id integer NOT NULL,
  normalized_address text NOT NULL,
  reason text,
  set_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  set_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merge_skiplist_group ON public.dynasty_merge_skiplist(duplicate_group_id);
CREATE INDEX IF NOT EXISTS idx_merge_skiplist_addr ON public.dynasty_merge_skiplist(normalized_address);

ALTER TABLE public.dynasty_merge_skiplist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners and admins can manage merge skiplist" ON public.dynasty_merge_skiplist;
CREATE POLICY "Owners and admins can manage merge skiplist"
ON public.dynasty_merge_skiplist
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

-- ----------------------------------------------------------------------------
-- 2. analyze_store_duplicate_groups()
--    One row per duplicate store record with weighted activity counts.
-- ----------------------------------------------------------------------------

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
  -- Money (weight 10)
  invoices_count bigint,
  invoice_total_amount numeric,
  orders_count bigint,
  store_orders_count bigint,
  wholesale_orders_count bigint,
  store_payments_count bigint,
  store_transactions_count bigint,
  store_wallet_balance numeric,
  store_credits_count bigint,
  -- Notes (weight 10)
  store_notes_count bigint,
  store_voice_notes_count bigint,
  -- Contacts (weight 10)
  store_contacts_count bigint,
  contact_profiles_count bigint,
  -- Calls (weight 5)
  manual_call_logs_count bigint,
  call_recordings_count bigint,
  call_revenue_events_count bigint,
  call_revenue_attribution_count bigint,
  store_call_intelligence_count bigint,
  live_calls_count bigint,
  voicemails_count bigint,
  dialer_followups_count bigint,
  -- Comms (weight 5)
  communication_events_count bigint,
  communication_messages_count bigint,
  messaging_targets_count bigint,
  contact_interactions_count bigint,
  -- Visits / Field Ops (weight 5)
  route_stops_count bigint,
  route_checkins_count bigint,
  visit_logs_count bigint,
  store_visits_count bigint,
  deliveries_count bigint,
  location_events_count bigint,
  -- Tasks (weight 5)
  mission_items_count bigint,
  reminders_count bigint,
  followup_recommendations_count bigint,
  -- Brand / Sticker / Tube (weight 2)
  store_brand_relationships_count bigint,
  store_brand_stickers_count bigint,
  bag_sale_ledger_count bigint,
  tube_sale_ledger_count bigint,
  -- Risk / Pipeline (weight 2)
  fraud_flags_count bigint,
  store_opportunities_count bigint,
  deals_count bigint,
  sales_prospects_count bigint,
  -- Sub-buckets (Category 2)
  enrichment_count bigint,        -- contact_enrichment_candidates
  inventory_state_count bigint,   -- store_tube_inventory_status
  pipeline_count bigint,          -- (folded into deals/opps for now, kept for symmetry)
  messaging_log_count bigint,     -- messaging_messages + invoice_receipt_log + outbound_call_queue
  -- Other (Category 3) - sum of remaining ~85 FK tables
  other_fk_count bigint,
  -- Computed
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
    SELECT d.duplicate_group_id, d.normalized_address, d.store_count::int AS group_size,
           unnest(d.store_ids) AS sid
    FROM public.detect_store_address_duplicates() d
  ),
  base AS (
    SELECT dup.duplicate_group_id, dup.normalized_address, dup.group_size, s.id AS sid,
           s.name, s.address_street, s.phone, s.created_at, s.updated_at,
           (s.deleted_at IS NULL) AS active
    FROM dup
    JOIN public.stores s ON s.id = dup.sid
  ),
  -- Aggregate counts per store_id
  agg AS (
    SELECT b.sid,
      -- Money
      (SELECT COUNT(*) FROM public.invoices x WHERE x.store_id = b.sid AND x.deleted_at IS NULL) AS invoices_count,
      (SELECT COALESCE(SUM(COALESCE(x.total_amount, x.total, 0)),0) FROM public.invoices x WHERE x.store_id = b.sid AND x.deleted_at IS NULL) AS invoice_total_amount,
      (SELECT MAX(x.created_at) FROM public.invoices x WHERE x.store_id = b.sid AND x.deleted_at IS NULL) AS last_invoice_date,
      (SELECT COUNT(*) FROM public.orders x WHERE x.store_id = b.sid AND x.deleted_at IS NULL) AS orders_count,
      (SELECT COUNT(*) FROM public.store_orders x WHERE x.store_id = b.sid) AS store_orders_count,
      (SELECT COUNT(*) FROM public.wholesale_orders x WHERE x.store_id = b.sid) AS wholesale_orders_count,
      (SELECT COUNT(*) FROM public.store_payments x WHERE x.store_id = b.sid) AS store_payments_count,
      (SELECT COUNT(*) FROM public.store_transactions x WHERE x.store_id = b.sid) AS store_transactions_count,
      (SELECT COALESCE(SUM(x.balance),0) FROM public.store_wallet x WHERE x.store_id = b.sid) AS store_wallet_balance,
      (SELECT COUNT(*) FROM public.store_credits x WHERE x.store_id = b.sid) AS store_credits_count,
      -- Notes
      (SELECT COUNT(*) FROM public.store_notes x WHERE x.store_id = b.sid) AS store_notes_count,
      (SELECT COUNT(*) FROM public.store_voice_notes x WHERE x.store_id = b.sid) AS store_voice_notes_count,
      -- Contacts
      (SELECT COUNT(*) FROM public.store_contacts x WHERE x.store_id = b.sid) AS store_contacts_count,
      (SELECT COUNT(*) FROM public.contact_profiles x WHERE x.store_id = b.sid) AS contact_profiles_count,
      -- Calls
      (SELECT COUNT(*) FROM public.manual_call_logs x WHERE x.store_id = b.sid) AS manual_call_logs_count,
      (SELECT MAX(x.created_at) FROM public.manual_call_logs x WHERE x.store_id = b.sid) AS last_call_date,
      (SELECT COUNT(*) FROM public.call_recordings x WHERE x.store_id = b.sid) AS call_recordings_count,
      (SELECT COUNT(*) FROM public.call_revenue_events x WHERE x.store_id = b.sid) AS call_revenue_events_count,
      (SELECT COUNT(*) FROM public.call_revenue_attribution x WHERE x.store_id = b.sid) AS call_revenue_attribution_count,
      (SELECT COUNT(*) FROM public.store_call_intelligence x WHERE x.store_id = b.sid) AS store_call_intelligence_count,
      (SELECT COUNT(*) FROM public.live_calls x WHERE x.store_id = b.sid) AS live_calls_count,
      (SELECT COUNT(*) FROM public.voicemails x WHERE x.store_id = b.sid) AS voicemails_count,
      (SELECT COUNT(*) FROM public.dialer_followups x WHERE x.store_id = b.sid) AS dialer_followups_count,
      -- Comms
      (SELECT COUNT(*) FROM public.communication_events x WHERE x.store_id = b.sid) AS communication_events_count,
      (SELECT COUNT(*) FROM public.communication_messages x WHERE x.store_id = b.sid) AS communication_messages_count,
      (SELECT COUNT(*) FROM public.messaging_targets x WHERE x.store_id = b.sid) AS messaging_targets_count,
      (SELECT COUNT(*) FROM public.contact_interactions x WHERE x.store_id = b.sid) AS contact_interactions_count,
      -- Visits
      (SELECT COUNT(*) FROM public.route_stops x WHERE x.store_id = b.sid) AS route_stops_count,
      (SELECT COUNT(*) FROM public.route_checkins x WHERE x.store_id = b.sid) AS route_checkins_count,
      (SELECT COUNT(*) FROM public.visit_logs x WHERE x.store_id = b.sid) AS visit_logs_count,
      (SELECT MAX(x.created_at) FROM public.visit_logs x WHERE x.store_id = b.sid) AS last_visit_date,
      (SELECT COUNT(*) FROM public.store_visits x WHERE x.store_id = b.sid) AS store_visits_count,
      (SELECT COUNT(*) FROM public.deliveries x WHERE x.store_id = b.sid) AS deliveries_count,
      (SELECT COUNT(*) FROM public.location_events x WHERE x.store_id = b.sid) AS location_events_count,
      -- Tasks
      (SELECT COUNT(*) FROM public.mission_items x WHERE x.store_id = b.sid) AS mission_items_count,
      (SELECT COUNT(*) FROM public.reminders x WHERE x.store_id = b.sid) AS reminders_count,
      (SELECT COUNT(*) FROM public.followup_recommendations x WHERE x.store_id = b.sid) AS followup_recommendations_count,
      -- Brand
      (SELECT COUNT(*) FROM public.store_brand_relationships x WHERE x.store_id = b.sid) AS store_brand_relationships_count,
      (SELECT COUNT(*) FROM public.store_brand_stickers x WHERE x.store_id = b.sid) AS store_brand_stickers_count,
      (SELECT COUNT(*) FROM public.bag_sale_ledger x WHERE x.store_id = b.sid) AS bag_sale_ledger_count,
      (SELECT COUNT(*) FROM public.tube_sale_ledger x WHERE x.store_id = b.sid) AS tube_sale_ledger_count,
      -- Risk / pipeline
      (SELECT COUNT(*) FROM public.fraud_flags x WHERE x.store_id = b.sid) AS fraud_flags_count,
      (SELECT COUNT(*) FROM public.store_opportunities x WHERE x.store_id = b.sid) AS store_opportunities_count,
      (SELECT COUNT(*) FROM public.deals x WHERE x.store_id = b.sid) AS deals_count,
      (SELECT COUNT(*) FROM public.sales_prospects x WHERE x.converted_store_id = b.sid) AS sales_prospects_count,
      -- Sub-buckets (Cat 2)
      (SELECT COUNT(*) FROM public.contact_enrichment_candidates x WHERE x.store_id = b.sid) AS enrichment_count,
      (SELECT COUNT(*) FROM public.store_tube_inventory_status x WHERE x.store_id = b.sid) AS inventory_state_count,
      0::bigint AS pipeline_count,
      (
        (SELECT COUNT(*) FROM public.messaging_messages x WHERE x.store_id = b.sid) +
        (SELECT COUNT(*) FROM public.invoice_receipt_log x WHERE x.store_id = b.sid) +
        (SELECT COUNT(*) FROM public.outbound_call_queue x WHERE x.store_id = b.sid)
      ) AS messaging_log_count,
      -- Cat 3: lump sum of remaining FK tables (best-effort, internal/system)
      (
        (SELECT COUNT(*) FROM public.agent_assignments x WHERE x.store_id = b.sid) +
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
      ) AS other_fk_count
    FROM base b
  ),
  combined AS (
    SELECT b.duplicate_group_id, b.normalized_address, b.group_size, b.sid,
           b.name, b.address_street, b.phone, b.created_at, b.updated_at, b.active,
           a.*,
           -- Weighted score (Cat-1 weights baked in)
           (
             10 * (a.invoices_count + a.orders_count + a.store_orders_count + a.wholesale_orders_count
                   + a.store_payments_count + a.store_transactions_count + a.store_credits_count
                   + a.store_notes_count + a.store_voice_notes_count
                   + a.store_contacts_count + a.contact_profiles_count)
             + 5 * (a.manual_call_logs_count + a.call_recordings_count + a.call_revenue_events_count
                    + a.call_revenue_attribution_count + a.store_call_intelligence_count + a.live_calls_count
                    + a.voicemails_count + a.dialer_followups_count
                    + a.communication_events_count + a.communication_messages_count
                    + a.messaging_targets_count + a.contact_interactions_count
                    + a.route_stops_count + a.route_checkins_count + a.visit_logs_count
                    + a.store_visits_count + a.deliveries_count + a.location_events_count
                    + a.mission_items_count + a.reminders_count + a.followup_recommendations_count)
             + 2 * (a.store_brand_relationships_count + a.store_brand_stickers_count
                    + a.bag_sale_ledger_count + a.tube_sale_ledger_count
                    + a.fraud_flags_count + a.store_opportunities_count + a.deals_count
                    + a.sales_prospects_count
                    + a.enrichment_count + a.inventory_state_count + a.messaging_log_count)
             + 1 * (a.other_fk_count)
           ) AS total_activity_score,
           GREATEST(
             COALESCE(a.last_invoice_date, 'epoch'::timestamptz),
             COALESCE(a.last_call_date, 'epoch'::timestamptz),
             COALESCE(a.last_visit_date, 'epoch'::timestamptz),
             COALESCE(b.updated_at, 'epoch'::timestamptz)
           ) AS last_any_activity
    FROM base b
    JOIN agg a ON a.sid = b.sid
  ),
  ranked AS (
    SELECT c.*,
      ROW_NUMBER() OVER (
        PARTITION BY c.duplicate_group_id
        ORDER BY c.total_activity_score DESC,
                 c.last_any_activity DESC NULLS LAST,
                 c.created_at ASC NULLS LAST,
                 c.sid ASC
      ) AS rnk,
      SUM(CASE WHEN c.total_activity_score > 0 THEN 1 ELSE 0 END)
        OVER (PARTITION BY c.duplicate_group_id) AS active_in_group
    FROM combined c
  )
  SELECT
    r.duplicate_group_id, r.normalized_address, r.group_size, r.sid,
    r.name, r.address_street, r.phone, r.created_at, r.updated_at, r.active,
    r.invoices_count, r.invoice_total_amount, r.orders_count, r.store_orders_count,
    r.wholesale_orders_count, r.store_payments_count, r.store_transactions_count,
    r.store_wallet_balance, r.store_credits_count,
    r.store_notes_count, r.store_voice_notes_count,
    r.store_contacts_count, r.contact_profiles_count,
    r.manual_call_logs_count, r.call_recordings_count, r.call_revenue_events_count,
    r.call_revenue_attribution_count, r.store_call_intelligence_count, r.live_calls_count,
    r.voicemails_count, r.dialer_followups_count,
    r.communication_events_count, r.communication_messages_count,
    r.messaging_targets_count, r.contact_interactions_count,
    r.route_stops_count, r.route_checkins_count, r.visit_logs_count,
    r.store_visits_count, r.deliveries_count, r.location_events_count,
    r.mission_items_count, r.reminders_count, r.followup_recommendations_count,
    r.store_brand_relationships_count, r.store_brand_stickers_count,
    r.bag_sale_ledger_count, r.tube_sale_ledger_count,
    r.fraud_flags_count, r.store_opportunities_count, r.deals_count, r.sales_prospects_count,
    r.enrichment_count, r.inventory_state_count, r.pipeline_count, r.messaging_log_count,
    r.other_fk_count,
    r.total_activity_score,
    r.last_invoice_date, r.last_call_date, r.last_visit_date,
    NULLIF(r.last_any_activity, 'epoch'::timestamptz) AS last_any_activity,
    (r.total_activity_score = 0) AS is_pristine_shell,
    (r.rnk = 1) AS is_winner,
    (r.active_in_group >= 2) AS needs_manual_review
  FROM ranked r
  ORDER BY r.duplicate_group_id, r.rnk;
END;
$$;

REVOKE ALL ON FUNCTION public.analyze_store_duplicate_groups() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.analyze_store_duplicate_groups() TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. analyze_store_duplicate_groups_summary()
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.analyze_store_duplicate_groups_summary()
RETURNS TABLE (
  duplicate_group_id integer,
  normalized_address text,
  group_size integer,
  pristine_shell_count bigint,
  active_record_count bigint,
  proposed_winner_store_id uuid,
  proposed_winner_name text,
  proposed_winner_activity_score bigint,
  group_classification text,
  review_priority text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH a AS (
    SELECT * FROM public.analyze_store_duplicate_groups()
  ),
  per_group AS (
    SELECT
      a.duplicate_group_id,
      MAX(a.normalized_address) AS normalized_address,
      MAX(a.group_size) AS group_size,
      SUM(CASE WHEN a.is_pristine_shell THEN 1 ELSE 0 END) AS pristine_shell_count,
      SUM(CASE WHEN NOT a.is_pristine_shell THEN 1 ELSE 0 END) AS active_record_count,
      MAX(CASE WHEN a.is_winner THEN a.store_id END) AS proposed_winner_store_id,
      MAX(CASE WHEN a.is_winner THEN a.store_name END) AS proposed_winner_name,
      MAX(CASE WHEN a.is_winner THEN a.total_activity_score END) AS proposed_winner_activity_score,
      MAX(a.total_activity_score) AS top_score,
      -- 2nd-highest score in group
      (ARRAY_AGG(a.total_activity_score ORDER BY a.total_activity_score DESC))[2] AS second_score
    FROM a
    GROUP BY a.duplicate_group_id
  )
  SELECT
    p.duplicate_group_id,
    p.normalized_address,
    p.group_size::int,
    p.pristine_shell_count,
    p.active_record_count,
    p.proposed_winner_store_id,
    p.proposed_winner_name,
    p.proposed_winner_activity_score,
    CASE
      WHEN p.active_record_count = 0 THEN 'all_pristine'
      WHEN p.active_record_count = 1 THEN 'pristine_easy'
      WHEN p.second_score IS NULL OR p.second_score = 0 THEN 'pristine_easy'
      WHEN p.top_score >= p.second_score * 3 THEN 'scattered_clear_winner'
      WHEN p.second_score::numeric / NULLIF(p.top_score,0)::numeric > 0.7 THEN 'scattered_close_call'
      ELSE 'scattered_clear_winner'
    END AS group_classification,
    CASE
      WHEN p.active_record_count >= 2 AND p.second_score::numeric / NULLIF(p.top_score,0)::numeric > 0.7 THEN 'HIGH'
      WHEN p.active_record_count >= 2 THEN 'MEDIUM'
      ELSE 'LOW'
    END AS review_priority
  FROM per_group p
  ORDER BY
    CASE WHEN p.active_record_count >= 2 AND p.second_score::numeric / NULLIF(p.top_score,0)::numeric > 0.7 THEN 0
         WHEN p.active_record_count >= 2 THEN 1 ELSE 2 END,
    p.top_score DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.analyze_store_duplicate_groups_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.analyze_store_duplicate_groups_summary() TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. detect_data_duplicates_in_group(p_group_id)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.detect_data_duplicates_in_group(p_group_id integer)
RETURNS TABLE (
  entity_type text,
  entity_count_total bigint,
  entity_duplicates_within_group bigint,
  sample_duplicate_pairs jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_ids uuid[];
BEGIN
  -- Find store_ids in this group
  SELECT d.store_ids INTO v_store_ids
  FROM public.detect_store_address_duplicates() d
  WHERE d.duplicate_group_id = p_group_id
  LIMIT 1;

  IF v_store_ids IS NULL THEN
    RETURN;
  END IF;

  -- INVOICES: dup if same invoice_number (if column exists, else skip dup detection)
  RETURN QUERY
  WITH inv AS (
    SELECT id, store_id, total_amount, created_at,
           (to_jsonb(invoices.*) ->> 'invoice_number') AS invoice_number
    FROM public.invoices
    WHERE store_id = ANY(v_store_ids) AND deleted_at IS NULL
  ),
  inv_dups AS (
    SELECT invoice_number, COUNT(*) AS c
    FROM inv WHERE invoice_number IS NOT NULL AND invoice_number <> ''
    GROUP BY invoice_number HAVING COUNT(*) > 1
  )
  SELECT 'invoice'::text,
         (SELECT COUNT(*) FROM inv),
         (SELECT COALESCE(SUM(c-1),0) FROM inv_dups),
         (SELECT COALESCE(jsonb_agg(jsonb_build_object('invoice_number', invoice_number, 'copies', c)), '[]'::jsonb)
          FROM (SELECT * FROM inv_dups LIMIT 3) s);

  -- NOTES: dup if normalized text matches
  RETURN QUERY
  WITH n AS (
    SELECT id, store_id, lower(regexp_replace(COALESCE(note, ''), '\s+', ' ', 'g')) AS norm, created_at
    FROM public.store_notes WHERE store_id = ANY(v_store_ids)
  ),
  n_dups AS (
    SELECT norm, COUNT(*) AS c FROM n WHERE norm <> '' GROUP BY norm HAVING COUNT(*) > 1
  )
  SELECT 'note'::text,
         (SELECT COUNT(*) FROM n),
         (SELECT COALESCE(SUM(c-1),0) FROM n_dups),
         (SELECT COALESCE(jsonb_agg(jsonb_build_object('text_preview', LEFT(norm, 60), 'copies', c)), '[]'::jsonb)
          FROM (SELECT * FROM n_dups LIMIT 3) s);

  -- PHONE NUMBERS (on store records themselves)
  RETURN QUERY
  WITH p AS (
    SELECT id, regexp_replace(COALESCE(phone, ''), '\D', '', 'g') AS digits
    FROM public.stores WHERE id = ANY(v_store_ids)
  ),
  p_dups AS (
    SELECT digits, COUNT(*) AS c FROM p WHERE digits <> '' GROUP BY digits HAVING COUNT(*) > 1
  )
  SELECT 'phone'::text,
         (SELECT COUNT(*) FROM p WHERE digits <> ''),
         (SELECT COALESCE(SUM(c-1),0) FROM p_dups),
         (SELECT COALESCE(jsonb_agg(jsonb_build_object('digits', digits, 'copies', c)), '[]'::jsonb)
          FROM (SELECT * FROM p_dups LIMIT 3) s);

  -- ADDRESSES (already known to normalize-equal in this group, but show formatting variants)
  RETURN QUERY
  WITH a AS (
    SELECT id, address_street, address_city, address_state, address_zip
    FROM public.stores WHERE id = ANY(v_store_ids)
  )
  SELECT 'address_variant'::text,
         (SELECT COUNT(*) FROM a),
         GREATEST((SELECT COUNT(DISTINCT (address_street, address_city, address_state, address_zip)) FROM a) - 1, 0),
         (SELECT COALESCE(jsonb_agg(jsonb_build_object('street', address_street, 'city', address_city, 'state', address_state, 'zip', address_zip)), '[]'::jsonb)
          FROM (SELECT DISTINCT address_street, address_city, address_state, address_zip FROM a LIMIT 5) s);

  -- COMMUNICATION EVENTS: dup if same created_at (truncated to 5s) AND same outcome+duration (best-effort via jsonb)
  RETURN QUERY
  WITH c AS (
    SELECT id, store_id,
           date_trunc('second', created_at) AS sec,
           (to_jsonb(communication_events.*) ->> 'outcome') AS outcome,
           (to_jsonb(communication_events.*) ->> 'duration_seconds') AS dur
    FROM public.communication_events WHERE store_id = ANY(v_store_ids)
  ),
  c_dups AS (
    SELECT sec, outcome, dur, COUNT(*) AS cnt
    FROM c GROUP BY sec, outcome, dur HAVING COUNT(*) > 1
  )
  SELECT 'communication_event'::text,
         (SELECT COUNT(*) FROM c),
         (SELECT COALESCE(SUM(cnt-1),0) FROM c_dups),
         (SELECT COALESCE(jsonb_agg(jsonb_build_object('at', sec, 'outcome', outcome, 'copies', cnt)), '[]'::jsonb)
          FROM (SELECT * FROM c_dups LIMIT 3) s);

  -- ORDERS: dup only if same order_number / external_id
  RETURN QUERY
  WITH o AS (
    SELECT id, store_id,
           COALESCE((to_jsonb(orders.*) ->> 'order_number'), (to_jsonb(orders.*) ->> 'external_id')) AS ref
    FROM public.orders WHERE store_id = ANY(v_store_ids) AND deleted_at IS NULL
  ),
  o_dups AS (
    SELECT ref, COUNT(*) AS c FROM o WHERE ref IS NOT NULL AND ref <> '' GROUP BY ref HAVING COUNT(*) > 1
  )
  SELECT 'order'::text,
         (SELECT COUNT(*) FROM o),
         (SELECT COALESCE(SUM(c-1),0) FROM o_dups),
         (SELECT COALESCE(jsonb_agg(jsonb_build_object('ref', ref, 'copies', c)), '[]'::jsonb)
          FROM (SELECT * FROM o_dups LIMIT 3) s);
END;
$$;

REVOKE ALL ON FUNCTION public.detect_data_duplicates_in_group(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.detect_data_duplicates_in_group(integer) TO authenticated;
