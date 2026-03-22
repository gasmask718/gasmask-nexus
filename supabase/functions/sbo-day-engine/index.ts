import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_COSTS: Record<string, { provider: string; cost_cents: number; note: string }> = {
  'sbo-fetch-odds': { provider: 'the_odds_api', cost_cents: 0, note: 'Free tier' },
  'sbo-sync-daily': { provider: 'sportsdata_io', cost_cents: 0, note: 'Subscription included' },
  'sbo-sync-pregame': { provider: 'sportsdata_io', cost_cents: 0, note: 'Subscription included' },
  'sbo-sync-prizepicks': { provider: 'prizepicks', cost_cents: 0, note: 'Free unofficial API' },
  'sbo-sync-polymarket': { provider: 'polymarket', cost_cents: 0, note: 'Free public API' },
  'sbo-track-results': { provider: 'sportsdata_io', cost_cents: 0, note: 'Subscription included' },
};

const MORNING_STEPS = [
  { fn: 'sbo-sync-daily', label: 'Season Stats + Injuries + Standings', icon: '📊', required: true },
];

const PREGAME_STEPS = [
  { fn: 'sbo-fetch-odds', label: 'Live Odds (DK/FD/BetMGM/Caesars)', icon: '💰', required: true },
  { fn: 'sbo-sync-pregame', label: 'Projections + Game Logs + SDIO Props', icon: '📈', required: true },
  { fn: 'sbo-sync-prizepicks', label: 'PrizePicks Props', icon: '🎯', required: false },
  { fn: 'sbo-sync-polymarket', label: 'Polymarket Prediction Market Odds', icon: '🔮', required: false },
];

const POSTGAME_STEPS = [
  { fn: 'sbo-track-results', label: 'Grade Predictions + Update Accuracy', icon: '📋', required: false },
];

const FULL_STEPS = [...MORNING_STEPS, ...PREGAME_STEPS];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const {
      run_type = 'manual',
      steps = 'full',
      date = new Date().toISOString().split('T')[0],
    } = body;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const ALL_AVAILABLE = [...MORNING_STEPS, ...PREGAME_STEPS, ...POSTGAME_STEPS];
    const stepsToRun = steps === 'morning' ? MORNING_STEPS
      : steps === 'pregame' ? PREGAME_STEPS
      : steps === 'postgame' ? POSTGAME_STEPS
      : steps === 'full' ? [...MORNING_STEPS, ...PREGAME_STEPS]
      : Array.isArray(steps) ? ALL_AVAILABLE.filter(s => steps.includes(s.fn))
      : [...MORNING_STEPS, ...PREGAME_STEPS];

    const { data: runRecord } = await supabase
      .from('sbo_day_engine_runs')
      .insert({
        run_date: date,
        run_type,
        trigger_time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    const runId = runRecord?.id;
    const completed: any[] = [];
    const failed: any[] = [];
    let totalRecords = 0;
    let totalCalls = 0;
    let totalCostCents = 0;
    const startTime = Date.now();

    for (const step of stepsToRun) {
      const stepStart = Date.now();
      try {
        console.log(`Running step: ${step.fn}`);

        const { data, error } = await supabase.functions.invoke(step.fn, {
          body: { date },
        });

        if (error && step.required) throw error;

        const costInfo = API_COSTS[step.fn];
        const records = data?.records_synced || data?.games_processed ||
          data?.inserted || data?.props || 0;

        totalRecords += records;
        totalCalls += 1;
        totalCostCents += costInfo?.cost_cents || 0;

        await supabase.from('sbo_api_costs').insert({
          run_date: date,
          feed_name: step.fn,
          api_provider: costInfo?.provider || 'unknown',
          endpoint_called: step.fn,
          records_returned: records,
          estimated_cost_cents: costInfo?.cost_cents || 0,
          api_calls_made: 1,
          response_status: error ? 'error' : 'success',
        });

        completed.push({
          fn: step.fn,
          label: step.label,
          records,
          duration_ms: Date.now() - stepStart,
          status: error ? 'warning' : 'success',
          note: costInfo?.note,
        });

        await new Promise(r => setTimeout(r, 500));

      } catch (e: any) {
        console.error(`Step ${step.fn} failed:`, e.message);
        failed.push({
          fn: step.fn,
          label: step.label,
          error: e.message,
          duration_ms: Date.now() - stepStart,
        });

        await supabase.from('sbo_api_costs').insert({
          run_date: date,
          feed_name: step.fn,
          api_provider: API_COSTS[step.fn]?.provider || 'unknown',
          endpoint_called: step.fn,
          records_returned: 0,
          estimated_cost_cents: 0,
          api_calls_made: 1,
          response_status: 'error',
        });
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    const status = failed.length === 0 ? 'completed'
      : failed.length === stepsToRun.length ? 'failed' : 'partial';

    await supabase
      .from('sbo_day_engine_runs')
      .update({
        steps_completed: completed,
        steps_failed: failed,
        total_records_synced: totalRecords,
        total_api_calls: totalCalls,
        estimated_cost_cents: totalCostCents,
        duration_seconds: duration,
        status,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);

    return new Response(JSON.stringify({
      success: true,
      run_id: runId,
      status,
      completed,
      failed,
      summary: {
        total_steps: stepsToRun.length,
        completed_steps: completed.length,
        failed_steps: failed.length,
        total_records_synced: totalRecords,
        total_api_calls: totalCalls,
        estimated_cost_cents: totalCostCents,
        estimated_cost_usd: (totalCostCents / 100).toFixed(2),
        duration_seconds: duration,
      },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
