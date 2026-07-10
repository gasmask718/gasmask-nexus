ALTER TABLE IF EXISTS public.funding_daily_briefings RENAME TO funding_daily_briefings_legacy;

CREATE OR REPLACE VIEW public.funding_daily_briefings AS
SELECT
  id,
  briefing_date,
  total_active_clients,
  clients_summary,
  alerts,
  operator_actions,
  generated_by,
  created_at,
  generated_at,
  clients_total,
  clients_active,
  reminders_due_today,
  funding_received_mtd,
  ai_summary,
  ai_summary AS briefing_content,
  raw_data
FROM public.funding_morning_briefings;

GRANT SELECT ON public.funding_daily_briefings TO authenticated;
GRANT SELECT ON public.funding_daily_briefings TO service_role;