import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Props counts
    const { count: totalProps } = await supabase
      .from('props_master')
      .select('*', { count: 'exact', head: true });

    const { count: withStats } = await supabase
      .from('props_master')
      .select('*', { count: 'exact', head: true })
      .not('season_avg', 'is', null);

    const { count: withResults } = await supabase
      .from('props_master')
      .select('*', { count: 'exact', head: true })
      .neq('result', 'pending');

    const { count: contextCount } = await supabase
      .from('sbo_prop_stat_context')
      .select('*', { count: 'exact', head: true });

    // 2. Recent function logs
    const { data: recentLogs } = await supabase
      .from('sbo_function_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(10);

    // 3. Calculate health
    const total = totalProps ?? 0;
    const statsCount = withStats ?? 0;
    const resultsCount = withResults ?? 0;
    const statsCoverage = total > 0 ? Math.round((statsCount / total) * 100) : 0;
    const resultsCoverage = total > 0 ? Math.round((resultsCount / total) * 100) : 0;

    // Check last function runs
    const logs = recentLogs ?? [];
    const lastCollectStats = logs.find((l: any) => l.function_name === 'sbo-collect-stats');
    const lastExpandContext = logs.find((l: any) => l.function_name === 'sbo-expand-stat-context');
    const lastAnalysis = logs.find((l: any) => l.function_name === 'sbo-run-analysis');
    const lastSettle = logs.find((l: any) => l.function_name === 'sbo-settle-results');

    // Determine alerts
    const alerts: { level: string; message: string }[] = [];
    if (statsCoverage < 95) alerts.push({ level: 'warning', message: `Stats coverage at ${statsCoverage}% (target: 95%+)` });
    if (statsCoverage < 50) alerts.push({ level: 'critical', message: `Stats coverage critically low: ${statsCoverage}%` });

    // Check for recent failures
    const recentFailures = logs.filter((l: any) => l.status === 'failed');
    if (recentFailures.length > 0) {
      alerts.push({ level: 'warning', message: `${recentFailures.length} recent function failure(s)` });
    }

    const overallStatus = alerts.some(a => a.level === 'critical') ? 'critical'
      : alerts.some(a => a.level === 'warning') ? 'warning' : 'healthy';

    return new Response(JSON.stringify({
      status: overallStatus,
      stats_coverage: statsCoverage,
      results_coverage: resultsCoverage,
      total_props: total,
      props_with_stats: statsCount,
      props_with_results: resultsCount,
      context_entries: contextCount ?? 0,
      alerts,
      functions: {
        collect_stats: lastCollectStats ? { status: lastCollectStats.status, last_run: lastCollectStats.started_at, records: lastCollectStats.records_processed, duration_ms: lastCollectStats.duration_ms } : null,
        expand_context: lastExpandContext ? { status: lastExpandContext.status, last_run: lastExpandContext.started_at, records: lastExpandContext.records_processed, duration_ms: lastExpandContext.duration_ms } : null,
        run_analysis: lastAnalysis ? { status: lastAnalysis.status, last_run: lastAnalysis.started_at, records: lastAnalysis.records_processed, duration_ms: lastAnalysis.duration_ms } : null,
        settle_results: lastSettle ? { status: lastSettle.status, last_run: lastSettle.started_at, records: lastSettle.records_processed, duration_ms: lastSettle.duration_ms } : null,
      },
      recent_logs: logs.slice(0, 5).map((l: any) => ({
        function_name: l.function_name,
        status: l.status,
        records_processed: l.records_processed,
        started_at: l.started_at,
        duration_ms: l.duration_ms,
        error: l.error_message,
      })),
      checked_at: new Date().toISOString(),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
