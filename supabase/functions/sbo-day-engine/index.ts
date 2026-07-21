import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_COSTS: Record<string, { provider: string; cost_cents: number; note: string }> = {
  'sbo-fetch-odds': { provider: 'the_odds_api', cost_cents: 0, note: 'Free tier' },
  'sbo-run-predictions': { provider: 'internal', cost_cents: 0, note: 'Internal AI predictions' },
  'sbo-sync-daily': { provider: 'sportsdata_io', cost_cents: 0, note: 'Subscription included' },
  'sbo-sync-pregame': { provider: 'sportsdata_io', cost_cents: 0, note: 'Subscription included' },
  'sbo-sync-prizepicks': { provider: 'prizepicks', cost_cents: 0, note: 'Free unofficial API' },
  'sbo-sync-polymarket-full': { provider: 'polymarket', cost_cents: 0, note: 'Free public API' },
  'sbo-compare-odds': { provider: 'internal', cost_cents: 0, note: 'Internal comparison' },
  'sbo-track-results': { provider: 'sportsdata_io', cost_cents: 0, note: 'Subscription included' },
  'sbo-analyze-model': { provider: 'internal', cost_cents: 0, note: 'Internal model analysis' },
  'sbo-generate-daily-briefing': { provider: 'internal', cost_cents: 0, note: 'Generates SMS briefing' },
  'sbo-send-daily-sms': { provider: 'twilio', cost_cents: 1, note: '~$0.01 per SMS' },
};

// Per-sport step chain (order matters). fetch-odds must precede run-predictions
// so sbo_games has today's rows for the sport when predictions fan out.
const MORNING_STEPS = [
  { fn: 'sbo-sync-daily', label: 'Season Stats + Injuries + Standings', icon: '📊', required: true },
];

const PREGAME_STEPS = [
  { fn: 'sbo-fetch-odds', label: 'Live Odds (DK/FD/BetMGM/Caesars)', icon: '💰', required: true },
  { fn: 'sbo-run-predictions', label: 'AI Predictions (per game, moneyline)', icon: '🧠', required: false },
  { fn: 'sbo-sync-pregame', label: 'Projections + Game Logs + SDIO Props', icon: '📈', required: true },
  { fn: 'sbo-sync-prizepicks', label: 'PrizePicks Props', icon: '🎯', required: false },
  { fn: 'sbo-sync-polymarket-full', label: 'Polymarket Full (214 NBA Markets)', icon: '🔮', required: false },
];

// Global (run once total, after per-sport loop finishes)
const GLOBAL_STEPS = [
  { fn: 'sbo-compare-odds', label: 'Cross-Platform Odds Comparison', icon: '💎', required: false },
  { fn: 'sbo-generate-daily-briefing', label: 'Generate Daily SMS Briefing', icon: '📱', required: false },
  { fn: 'sbo-send-daily-sms', label: 'Send Daily SMS to Phone', icon: '✉️', required: false },
];

const POSTGAME_STEPS = [
  { fn: 'sbo-track-results', label: 'Grade Predictions + Update Accuracy', icon: '📋', required: false },
  { fn: 'sbo-analyze-model', label: 'Model Self-Analysis + Weight Adjustment', icon: '🧬', required: false },
];

// Steps that are hardcoded to NBA (SDIO endpoints / NBA-only feeds).
// These are gated to only execute when sport === 'nba' inside the per-sport loop.
const NBA_ONLY_STEPS = new Set<string>([
  'sbo-sync-daily',
  'sbo-sync-pregame',
  'sbo-sync-prizepicks',
  'sbo-sync-polymarket-full',
]);

// Pipeline-supported sports today. sbo_sports may mark more as active,
// but only these actually produce meaningful output end-to-end.
const SUPPORTED_ALLOWLIST = new Set<string>(['nba', 'mlb']);

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

    // Resolve per-sport + global step lists based on requested `steps` selector.
    const ALL_PERSPORT = [...MORNING_STEPS, ...PREGAME_STEPS];
    const ALL_AVAILABLE = [...ALL_PERSPORT, ...GLOBAL_STEPS, ...POSTGAME_STEPS];

    let perSportSteps: typeof ALL_PERSPORT = [];
    let globalSteps: typeof GLOBAL_STEPS = [];
    let postgameSteps: typeof POSTGAME_STEPS = [];

    if (steps === 'morning') {
      perSportSteps = MORNING_STEPS;
    } else if (steps === 'pregame') {
      perSportSteps = PREGAME_STEPS;
      globalSteps = GLOBAL_STEPS;
    } else if (steps === 'postgame') {
      postgameSteps = POSTGAME_STEPS;
    } else if (steps === 'full' || steps === undefined) {
      perSportSteps = ALL_PERSPORT;
      globalSteps = GLOBAL_STEPS;
    } else if (Array.isArray(steps)) {
      perSportSteps = ALL_PERSPORT.filter(s => steps.includes(s.fn));
      globalSteps = GLOBAL_STEPS.filter(s => steps.includes(s.fn));
      postgameSteps = POSTGAME_STEPS.filter(s => steps.includes(s.fn));
    } else {
      perSportSteps = ALL_PERSPORT;
      globalSteps = GLOBAL_STEPS;
    }

    // Determine active + supported sports.
    const { data: activeSports } = await supabase
      .from('sbo_sports')
      .select('sport_key')
      .eq('is_active', true);

    const sportsToRun: string[] = [];
    const sportsSkippedUnsupported: string[] = [];
    for (const s of (activeSports ?? [])) {
      if (SUPPORTED_ALLOWLIST.has(s.sport_key)) sportsToRun.push(s.sport_key);
      else sportsSkippedUnsupported.push(s.sport_key);
    }

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

    const recordStep = async (
      step: { fn: string; label: string; required?: boolean },
      opts: { sport: string; status: 'success' | 'warning' | 'skipped' | 'error'; records?: number; note?: string; error?: string; duration_ms: number }
    ) => {
      const costInfo = API_COSTS[step.fn];
      const records = opts.records ?? 0;
      if (opts.status !== 'skipped' && opts.status !== 'error') {
        totalRecords += records;
        totalCalls += 1;
        totalCostCents += costInfo?.cost_cents || 0;
      }
      if (opts.status !== 'skipped') {
        await supabase.from('sbo_api_costs').insert({
          run_date: date,
          feed_name: step.fn,
          api_provider: costInfo?.provider || 'unknown',
          endpoint_called: step.fn,
          records_returned: records,
          estimated_cost_cents: opts.status === 'error' ? 0 : (costInfo?.cost_cents || 0),
          api_calls_made: 1,
          response_status: opts.status === 'error' ? 'error' : 'success',
        });
      }
      const entry = {
        fn: step.fn,
        label: step.label,
        sport: opts.sport,
        records,
        duration_ms: opts.duration_ms,
        status: opts.status,
        note: opts.note ?? costInfo?.note,
        ...(opts.error ? { error: opts.error } : {}),
      };
      if (opts.status === 'error') failed.push(entry);
      else completed.push(entry);
    };

    // ---------- Per-sport loop ----------
    for (const sport of sportsToRun) {
      for (const step of perSportSteps) {
        const stepStart = Date.now();

        // NBA-only gate
        if (NBA_ONLY_STEPS.has(step.fn) && sport !== 'nba') {
          await recordStep(step, {
            sport,
            status: 'skipped',
            duration_ms: 0,
            note: `Skipped: ${step.fn} is NBA-only (SDIO/NBA-hardcoded), not supported for ${sport}`,
          });
          continue;
        }

        try {
          console.log(`[${sport}] Running step: ${step.fn}`);

          // Special handling: run-predictions fans out per game
          if (step.fn === 'sbo-run-predictions') {
            const { data: games, error: gamesErr } = await supabase
              .from('sbo_games')
              .select('id')
              .eq('sport_key', sport)
              .eq('game_date', date);
            if (gamesErr) throw gamesErr;

            let predsMade = 0;
            let predsFailed = 0;
            for (const g of (games ?? [])) {
              try {
                const { error: pErr } = await supabase.functions.invoke('sbo-run-predictions', {
                  body: { game_id: g.id, sport_key: sport, prediction_type: 'moneyline' },
                });
                if (pErr) { predsFailed += 1; console.error(`[${sport}] prediction failed for game ${g.id}:`, pErr.message); }
                else predsMade += 1;
              } catch (perGameErr: any) {
                predsFailed += 1;
                console.error(`[${sport}] prediction threw for game ${g.id}:`, perGameErr?.message);
              }
              await new Promise(r => setTimeout(r, 150));
            }

            await recordStep(step, {
              sport,
              status: predsFailed === 0 ? 'success' : (predsMade === 0 ? 'error' : 'warning'),
              records: predsMade,
              duration_ms: Date.now() - stepStart,
              note: `${predsMade} predictions generated, ${predsFailed} failed, ${(games ?? []).length} games queried`,
              ...(predsMade === 0 && predsFailed > 0 ? { error: `All ${predsFailed} per-game predictions failed` } : {}),
            });
            continue;
          }

          // Standard per-sport step — pass sport_key through
          const { data, error } = await supabase.functions.invoke(step.fn, {
            body: { date, sport_key: sport },
          });

          if (error && step.required) throw error;

          const records = data?.records_synced || data?.games_processed ||
            data?.inserted || data?.props || 0;

          await recordStep(step, {
            sport,
            status: error ? 'warning' : 'success',
            records,
            duration_ms: Date.now() - stepStart,
          });

          await new Promise(r => setTimeout(r, 500));
        } catch (e: any) {
          console.error(`[${sport}] Step ${step.fn} failed:`, e.message);
          await recordStep(step, {
            sport,
            status: 'error',
            duration_ms: Date.now() - stepStart,
            error: e.message,
          });
        }
      }
    }

    // ---------- Global steps (run once, after per-sport loop) ----------
    for (const step of globalSteps) {
      const stepStart = Date.now();
      try {
        console.log(`[global] Running step: ${step.fn}`);
        const { data, error } = await supabase.functions.invoke(step.fn, { body: { date } });
        if (error && step.required) throw error;
        const records = data?.records_synced || data?.games_processed || data?.inserted || data?.props || 0;
        await recordStep(step, {
          sport: 'global',
          status: error ? 'warning' : 'success',
          records,
          duration_ms: Date.now() - stepStart,
        });
        await new Promise(r => setTimeout(r, 500));
      } catch (e: any) {
        console.error(`[global] Step ${step.fn} failed:`, e.message);
        await recordStep(step, {
          sport: 'global',
          status: 'error',
          duration_ms: Date.now() - stepStart,
          error: e.message,
        });
      }
    }

    // ---------- Postgame (unchanged semantics — run once globally) ----------
    for (const step of postgameSteps) {
      const stepStart = Date.now();
      try {
        const { data, error } = await supabase.functions.invoke(step.fn, { body: { date } });
        if (error && step.required) throw error;
        const records = data?.records_synced || data?.games_processed || data?.inserted || data?.props || 0;
        await recordStep(step, {
          sport: 'global',
          status: error ? 'warning' : 'success',
          records,
          duration_ms: Date.now() - stepStart,
        });
      } catch (e: any) {
        await recordStep(step, {
          sport: 'global',
          status: 'error',
          duration_ms: Date.now() - stepStart,
          error: e.message,
        });
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    const totalStepsPlanned = (perSportSteps.length * sportsToRun.length) + globalSteps.length + postgameSteps.length;
    const errorCount = failed.length;
    const status = errorCount === 0 ? 'completed'
      : errorCount === totalStepsPlanned ? 'failed' : 'partial';

    // Nest per-sport summary metadata into steps_completed payload (no schema migration).
    const stepsCompletedPayload = {
      sports_run: sportsToRun,
      sports_skipped_unsupported: sportsSkippedUnsupported,
      allowlist: Array.from(SUPPORTED_ALLOWLIST),
      steps: completed,
    };

    await supabase
      .from('sbo_day_engine_runs')
      .update({
        steps_completed: stepsCompletedPayload,
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
      sports_run: sportsToRun,
      sports_skipped_unsupported: sportsSkippedUnsupported,
      completed,
      failed,
      summary: {
        total_steps_planned: totalStepsPlanned,
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
