
-- ══════════════════════════════════════════════════════════════
-- UT SCALE ARCHITECTURE: RPCs + Indexes
-- ══════════════════════════════════════════════════════════════

-- ── INDEXES for ut_partner_leads ───────────────────────────
CREATE INDEX IF NOT EXISTS idx_ut_leads_ai_score ON ut_partner_leads (ai_score DESC);
CREATE INDEX IF NOT EXISTS idx_ut_leads_callback ON ut_partner_leads (callback_due_at ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_ut_leads_status ON ut_partner_leads (status);
CREATE INDEX IF NOT EXISTS idx_ut_leads_category ON ut_partner_leads (category);
CREATE INDEX IF NOT EXISTS idx_ut_leads_city ON ut_partner_leads (city);
CREATE INDEX IF NOT EXISTS idx_ut_leads_created ON ut_partner_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ut_leads_status_callback ON ut_partner_leads (status, callback_due_at ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_ut_leads_status_score ON ut_partner_leads (status, ai_score DESC);
CREATE INDEX IF NOT EXISTS idx_ut_leads_category_status ON ut_partner_leads (category, status);

-- ── INDEX for ut_outreach_logs ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ut_logs_created ON ut_outreach_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ut_logs_lead_id ON ut_outreach_logs (lead_id);
CREATE INDEX IF NOT EXISTS idx_ut_logs_outcome ON ut_outreach_logs (outcome);

-- ══════════════════════════════════════════════════════════════
-- RPC: ut_get_lead_stats — aggregated lead analytics
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.ut_get_lead_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM ut_partner_leads),
    'by_status', (
      SELECT jsonb_object_agg(status, cnt)
      FROM (SELECT status, count(*) AS cnt FROM ut_partner_leads GROUP BY status) s
    ),
    'by_category', (
      SELECT jsonb_object_agg(category, jsonb_build_object(
        'total', total, 'onboarded', onboarded
      ))
      FROM (
        SELECT category, count(*) AS total,
               count(*) FILTER (WHERE status = 'onboarded') AS onboarded
        FROM ut_partner_leads GROUP BY category
      ) c
    ),
    'by_city', (
      SELECT jsonb_object_agg(city, jsonb_build_object(
        'total', total, 'onboarded', onboarded
      ))
      FROM (
        SELECT city, count(*) AS total,
               count(*) FILTER (WHERE status = 'onboarded') AS onboarded
        FROM ut_partner_leads WHERE city IS NOT NULL GROUP BY city
      ) ct
    ),
    'by_source', (
      SELECT jsonb_object_agg(source, cnt)
      FROM (SELECT coalesce(source, 'unknown') AS source, count(*) AS cnt FROM ut_partner_leads GROUP BY source) sr
    ),
    'avg_score', (SELECT coalesce(round(avg(ai_score)), 0) FROM ut_partner_leads),
    'avg_touches_to_onboard', (
      SELECT coalesce(round(avg(outreach_count)::numeric, 1), 0)
      FROM ut_partner_leads WHERE status = 'onboarded'
    )
  );
$$;

-- ══════════════════════════════════════════════════════════════
-- RPC: ut_get_outcome_distribution — outcome counts
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.ut_get_outcome_distribution()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    jsonb_object_agg(outcome, cnt),
    '{}'::jsonb
  )
  FROM (SELECT outcome, count(*) AS cnt FROM ut_outreach_logs GROUP BY outcome) o;
$$;

-- ══════════════════════════════════════════════════════════════
-- RPC: ut_get_va_performance — today's VA metrics
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.ut_get_va_performance()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH today_logs AS (
    SELECT channel, outcome
    FROM ut_outreach_logs
    WHERE created_at >= (current_date AT TIME ZONE 'UTC')
  ),
  call_logs AS (
    SELECT outcome FROM today_logs WHERE channel IN ('call', 'ai_call')
  ),
  metrics AS (
    SELECT
      (SELECT count(*) FROM call_logs) AS calls_made,
      (SELECT count(*) FROM call_logs WHERE outcome NOT IN ('no_answer', 'wrong_number')) AS connected,
      (SELECT count(*) FROM today_logs WHERE outcome = 'interested') AS interested,
      (SELECT count(*) FROM today_logs WHERE outcome = 'onboarded') AS onboarded,
      (SELECT count(*) FROM today_logs WHERE channel = 'sms') AS sms_sent,
      (SELECT count(*) FROM today_logs WHERE outcome IN ('callback_requested', 'follow_up_required', 'voicemail_left')) AS follow_ups_set,
      (SELECT count(*) FROM call_logs WHERE outcome = 'no_answer') AS no_answer_count
  )
  SELECT jsonb_build_object(
    'calls_made', m.calls_made,
    'connected', m.connected,
    'interested', m.interested,
    'onboarded', m.onboarded,
    'sms_sent', m.sms_sent,
    'follow_ups_set', m.follow_ups_set,
    'no_answer_rate', CASE WHEN m.calls_made > 0 THEN round((m.no_answer_count::numeric / m.calls_made) * 100) ELSE 0 END,
    'conversion_rate', CASE WHEN m.connected > 0 THEN round((m.interested::numeric / m.connected) * 100) ELSE 0 END
  )
  FROM metrics m;
$$;
