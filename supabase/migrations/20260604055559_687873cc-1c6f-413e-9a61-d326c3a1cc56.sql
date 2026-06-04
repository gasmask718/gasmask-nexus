
-- ─────────────────────────────────────────────────────────────────────────────
-- OS-WIDE SYSTEM HEALTH MONITOR — registry, history, alert dedupe
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_key text UNIQUE NOT NULL,
  kind text NOT NULL CHECK (kind IN ('cron','function','trigger','chain','integration','data_canary','agent')),
  business text NOT NULL DEFAULT 'os',
  floor text,
  label text NOT NULL,
  cadence_expected_minutes int,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_run_at timestamptz,
  last_ok_at timestamptz,
  last_status text CHECK (last_status IN ('pass','warn','fail','unknown')) DEFAULT 'unknown',
  last_message text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.health_checks TO authenticated;
GRANT ALL ON public.health_checks TO service_role;
ALTER TABLE public.health_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read health_checks" ON public.health_checks FOR SELECT TO authenticated USING (true);
CREATE POLICY "service write health_checks" ON public.health_checks FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_health_checks_business_floor ON public.health_checks (business, floor);
CREATE INDEX IF NOT EXISTS idx_health_checks_kind ON public.health_checks (kind);
CREATE INDEX IF NOT EXISTS idx_health_checks_status ON public.health_checks (last_status) WHERE enabled = true;

CREATE TABLE IF NOT EXISTS public.health_check_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('pass','warn','fail')),
  message text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.health_check_runs TO authenticated;
GRANT ALL ON public.health_check_runs TO service_role;
ALTER TABLE public.health_check_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read health_check_runs" ON public.health_check_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "service write health_check_runs" ON public.health_check_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_health_check_runs_key_time ON public.health_check_runs (check_key, created_at DESC);

CREATE TABLE IF NOT EXISTS public.health_check_alerts (
  check_key text PRIMARY KEY,
  last_alert_at timestamptz NOT NULL DEFAULT now(),
  last_status text,
  last_message text
);
GRANT SELECT ON public.health_check_alerts TO authenticated;
GRANT ALL ON public.health_check_alerts TO service_role;
ALTER TABLE public.health_check_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read health_check_alerts" ON public.health_check_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "service write health_check_alerts" ON public.health_check_alerts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Auto-updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_health_checks_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_health_checks_updated ON public.health_checks;
CREATE TRIGGER trg_health_checks_updated BEFORE UPDATE ON public.health_checks
  FOR EACH ROW EXECUTE FUNCTION public.touch_health_checks_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED REGISTRY — every cron, integration, chain, canary, agent we ship
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.health_checks (check_key, kind, business, floor, label, cadence_expected_minutes, config) VALUES
  -- CRONS (from cron.job audit; cadence_expected_minutes = max acceptable gap)
  ('cron.process-settlement-releases','cron','os','finance','Settlement releases (hourly)',120,'{"jobname":"process-settlement-releases"}'),
  ('cron.process-notification-queue','cron','os','comms','Notification queue drain (1m)',5,'{"jobname":"process-notification-queue-every-minute"}'),
  ('cron.brandaro-followup-worker','cron','brandaro','automation','Brandaro followup worker (5m)',15,'{"jobname":"brandaro-followup-worker"}'),
  ('cron.brandaro-retry-worker','cron','brandaro','automation','Brandaro retry worker (10m)',25,'{"jobname":"brandaro-retry-worker"}'),
  ('cron.brandaro-build-worker','cron','brandaro','automation','Brandaro build worker (5m)',15,'{"jobname":"brandaro-build-worker-cron"}'),
  ('cron.brandaro-send-followups-1m','cron','brandaro','automation','Brandaro send followups (1m)',5,'{"jobname":"brandaro-send-followups-cron"}'),
  ('cron.brandaro-recovery-worker','cron','brandaro','automation','Brandaro recovery worker (1m)',5,'{"jobname":"brandaro-recovery-worker"}'),
  ('cron.reset-number-pool-daily','cron','os','comms','Reset number pool (daily)',1500,'{"jobname":"reset-number-pool-daily"}'),
  ('cron.market-domination-optimize-offers','cron','brandaro','revenue','Optimize offers (30m)',45,'{"jobname":"market-domination-optimize-offers"}'),
  ('cron.market-domination-evaluate-pricing','cron','brandaro','revenue','Evaluate pricing (hourly)',90,'{"jobname":"market-domination-evaluate-pricing"}'),
  ('cron.brandaro-retry-jobs','cron','brandaro','automation','Brandaro retry jobs (5m)',15,'{"jobname":"brandaro-retry-jobs"}'),
  ('cron.brandaro-nightly-discovery','cron','brandaro','discovery','Brandaro nightly discovery',1500,'{"jobname":"brandaro-nightly-discovery"}'),
  ('cron.brandaro-send-followups-daily','cron','brandaro','automation','Brandaro daily followups',1500,'{"jobname":"brandaro-send-followups"}'),
  ('cron.morning-ops-cycle','cron','os','ops','Morning ops cycle',1500,'{"jobname":"morning-ops-cycle"}'),
  ('cron.brandaro-scout-agent','cron','brandaro','ai','Brandaro scout agent (6h)',400,'{"jobname":"brandaro-scout-agent"}'),
  ('cron.ceo-briefing-agent','cron','os','ai','CEO briefing agent (daily)',1500,'{"jobname":"ceo-briefing-agent"}'),
  ('cron.account-health-agent','cron','os','ai','Account health agent',1500,'{"jobname":"account-health-agent"}'),
  ('cron.followup-cadence-agent','cron','os','ai','Followup cadence agent',1500,'{"jobname":"followup-cadence-agent"}'),
  ('cron.revenue-intelligence-agent','cron','os','ai','Revenue intelligence agent',1500,'{"jobname":"revenue-intelligence-agent"}'),
  ('cron.collections-agent','cron','os','ai','Collections agent (M/W/F)',4500,'{"jobname":"collections-agent"}'),
  ('cron.onboarding-agent','cron','os','ai','Onboarding agent',1500,'{"jobname":"onboarding-agent"}'),
  ('cron.gasmask-opportunity-sync','cron','gasmask','ops','GasMask opportunity sync (30m)',45,'{"jobname":"gasmask-opportunity-sync"}'),
  ('cron.sbo-morning-sync','cron','sbo','ingest','SBO morning sync',1500,'{"jobname":"sbo-morning-sync"}'),
  ('cron.sbo-pregame-sync','cron','sbo','ingest','SBO pregame sync',1500,'{"jobname":"sbo-pregame-sync"}'),
  ('cron.sbo-result-tracking','cron','sbo','results','SBO result tracking',1500,'{"jobname":"sbo-result-tracking"}'),
  ('cron.auto-verify-results','cron','sbo','results','Auto verify results',1500,'{"jobname":"auto-verify-results"}'),
  ('cron.sbo-daily-10am-est','cron','sbo','daily','SBO daily 10am ET',1500,'{"jobname":"sbo-daily-10am-est"}'),
  ('cron.monthly-gdrive-backup','cron','os','ops','Monthly GDrive backup',44640,'{"jobname":"monthly-gdrive-backup"}'),
  ('cron.nightly-agent-self-learn','cron','os','ai','Nightly agent self-learn',1500,'{"jobname":"nightly-agent-self-learn"}'),
  ('cron.solar-followup-sender','cron','solar','automation','Solar followup sender (1m)',5,'{"jobname":"solar-followup-sender-every-minute"}'),
  ('cron.ut-ambassador-monitor-15m','cron','unforgettable','ambassador','UT ambassador monitor (15m)',30,'{"jobname":"ut-ambassador-monitor-15min"}'),
  ('cron.ut-ambassador-deep-test-daily','cron','unforgettable','ambassador','UT ambassador deep test',1500,'{"jobname":"ut-ambassador-deep-test-daily"}'),
  ('cron.ut-ambassador-daily-optimization','cron','unforgettable','ambassador','UT ambassador daily optimization',1500,'{"jobname":"ut-ambassador-daily-optimization"}'),
  ('cron.dispatch-campaign-tick','cron','os','comms','Dispatch campaign tick (1m)',5,'{"jobname":"dispatch-campaign-tick"}'),
  ('cron.dialer-stuck-sweep','cron','os','comms','Dialer stuck sweep (1m)',5,'{"jobname":"dialer-stuck-sweep"}'),
  ('cron.bulk-sms-resume','cron','os','comms','Bulk SMS resume (5m)',15,'{"jobname":"bulk-sms-resume"}'),
  ('cron.bulk-ai-call-resume','cron','os','comms','Bulk AI call resume (5m)',15,'{"jobname":"bulk-ai-call-resume"}'),
  ('cron.tt-release-expired-auths','cron','toptier','dispatch','TT release expired auths (15m)',30,'{"jobname":"tt-release-expired-auths-every-15m"}'),
  ('cron.dc-configure-webhooks-bulk-daily','cron','os','comms','DC webhooks bulk config',1500,'{"jobname":"dc-configure-webhooks-bulk-daily"}'),
  ('cron.comms-health-monitor-20m','cron','os','comms','Comms health monitor (20m)',40,'{"jobname":"comms-health-monitor-every-20m"}'),
  ('cron.dd-reorder-nudges-nightly','cron','dynasty_direct','ai','DD reorder nudges nightly',1500,'{"jobname":"dd-reorder-nudges-nightly"}'),
  ('cron.dd-review-summary-drain','cron','dynasty_direct','ai','DD review summary drain (2m)',7,'{"jobname":"dd-review-summary-drain"}'),
  ('cron.dd-cart-recovery','cron','dynasty_direct','ai','DD cart recovery (15m)',30,'{"jobname":"dd-cart-recovery-cron"}'),
  ('cron.dd-sla-snapshot-nightly','cron','dynasty_direct','ai','DD SLA snapshot nightly',1500,'{"jobname":"dd-sla-snapshot-nightly"}'),
  ('cron.dd-order-anomaly-nightly','cron','dynasty_direct','ai','DD order anomaly nightly',1500,'{"jobname":"dd-order-anomaly-nightly"}'),

  -- INTEGRATIONS
  ('integration.twilio','integration','os','comms','Twilio (credentials + balance + numbers)',60,'{}'),
  ('integration.bland_ai','integration','os','comms','Bland AI (pathways reachable)',60,'{}'),
  ('integration.mapbox','integration','os','geo','Mapbox token (geocode probe)',360,'{}'),
  ('integration.lovable_gateway','integration','os','ai','Lovable AI Gateway (Gemini probe)',60,'{}'),
  ('integration.stripe','integration','os','finance','Stripe (key-ready slot)',1500,'{"key_ready":true}'),
  ('integration.easypost','integration','os','logistics','EasyPost (key-ready slot)',1500,'{"key_ready":true}'),
  ('integration.resend','integration','os','comms','Resend (key-ready slot)',1500,'{"key_ready":true}'),
  ('integration.serpapi','integration','os','intel','SerpAPI (key-ready slot)',1500,'{"key_ready":true}'),

  -- TRIGGERS (heartbeat canaries — recent write produced expected side-effect)
  ('trigger.review_to_summary_job','trigger','dynasty_direct','ai','Review insert enqueues summary job',1500,'{}'),
  ('trigger.paid_order_consumed_reservation','trigger','dynasty_direct','fulfillment','Paid order consumes inventory reservation',1500,'{}'),
  ('trigger.last_order_at_bump','trigger','os','crm','Order updates store.last_order_at',1500,'{}'),
  ('trigger.fulfillment_fan_out','trigger','dynasty_direct','fulfillment','Order fans out to wholesaler fulfillments',1500,'{}'),
  ('trigger.ambassador_lifecycle','trigger','unforgettable','ambassador','Ambassador status transitions logged',1500,'{}'),
  ('trigger.invoice_rollup','trigger','os','finance','Invoice line→header rollup',1500,'{}'),

  -- CHAINS (multi-step pipelines; synthetic-test capable)
  ('chain.order_to_routing_to_reserve','chain','dynasty_direct','fulfillment','Order → routing → fan-out → reserve',null,'{"synthetic":true}'),
  ('chain.ai_call_to_route_candidate','chain','os','ai','AI call → analysis → route candidate',null,'{"synthetic":true}'),
  ('chain.review_to_job_to_summary','chain','dynasty_direct','ai','Review → job → summary',null,'{"synthetic":true}'),

  -- DATA CANARIES
  ('canary.orphan_orders','data_canary','dynasty_direct','fulfillment','Orphan paid orders (no fulfillment)',60,'{"threshold":0}'),
  ('canary.stuck_pending_orders_3d','data_canary','dynasty_direct','fulfillment','Orders pending >3 days',60,'{"days":3,"threshold":0}'),
  ('canary.unrouted_fulfillments','data_canary','dynasty_direct','fulfillment','Fulfillments missing wholesaler routing',60,'{"threshold":0}'),
  ('canary.stale_review_summary_jobs','data_canary','dynasty_direct','ai','Review summary jobs older than 30m',60,'{"minutes":30,"threshold":5}'),
  ('canary.stale_notification_queue','data_canary','os','comms','Notification queue pending >2h',60,'{"hours":2,"threshold":10}'),
  ('canary.dup_order_clusters','data_canary','dynasty_direct','fraud','Duplicate-total order clusters (24h)',1500,'{"threshold":0}'),

  -- AGENTS (AI maintenance workforce)
  ('agent.dd_anomaly_classifier','agent','dynasty_direct','ai','DD anomaly classifier',1500,'{"function":"dd-order-anomaly-cron","outputs_table":"dd_anomaly_findings"}'),
  ('agent.dd_sla_snapshot','agent','dynasty_direct','ai','DD SLA snapshot agent',1500,'{"function":"dd-sla-snapshot","outputs_table":"dd_sla_snapshots"}'),
  ('agent.dd_reorder_nudges','agent','dynasty_direct','ai','DD reorder nudge drafter',1500,'{"function":"dd-reorder-nudges","outputs_table":"communication_drafts"}'),
  ('agent.dd_application_triage','agent','dynasty_direct','ai','DD application triage scorer',null,'{"function":"dd-application-triage","outputs_table":"dd_application_scores"}'),
  ('agent.note_cleaner','agent','os','ai','Note cleaner agent',1500,'{"function":"run-note-cleaner"}'),
  ('agent.dd_cart_recovery','agent','dynasty_direct','ai','DD cart recovery drafter',30,'{"function":"dd-cart-recovery-cron","outputs_table":"notification_queue"}'),
  ('agent.dd_review_summarizer','agent','dynasty_direct','ai','DD review summarizer',7,'{"function":"dd-ai-review-summary","outputs_table":"review_summaries"}')
ON CONFLICT (check_key) DO UPDATE SET
  kind = EXCLUDED.kind, business = EXCLUDED.business, floor = EXCLUDED.floor,
  label = EXCLUDED.label, cadence_expected_minutes = EXCLUDED.cadence_expected_minutes,
  config = EXCLUDED.config;
