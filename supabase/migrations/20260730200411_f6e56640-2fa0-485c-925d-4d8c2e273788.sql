CREATE OR REPLACE VIEW public.ut_territory_stats_summary AS
SELECT
  COALESCE(SUM(j.leads_found), 0)::bigint AS total_leads,
  COALESCE(SUM(j.duplicates_skipped), 0)::bigint AS total_dupes,
  COALESCE(SUM(j.enriched_count), 0)::bigint AS total_enriched,
  COUNT(*)::bigint AS total_jobs,
  COUNT(*) FILTER (WHERE j.status = 'completed')::bigint AS completed_jobs,
  COUNT(*) FILTER (WHERE j.status = 'failed')::bigint AS failed_jobs,
  COUNT(*) FILTER (WHERE j.status = 'queued')::bigint AS queued_jobs,
  COUNT(*) FILTER (WHERE j.status = 'running')::bigint AS running_jobs,
  COUNT(DISTINCT j.category) FILTER (WHERE j.status = 'completed')::bigint AS categories_covered,
  (SELECT COUNT(*) FROM public.ut_state_coverage s WHERE s.status IN ('completed','in_progress'))::bigint AS states_covered
FROM public.ut_territory_jobs j;

GRANT SELECT ON public.ut_territory_stats_summary TO authenticated;
GRANT SELECT ON public.ut_territory_stats_summary TO service_role;