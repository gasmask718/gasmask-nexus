import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_COSTS: Record<string, { provider: string; cost_cents: number; note: string }> = {
  'sbo-fetch-odds': { provider: 'the_odds_api', cost_cents: 0, note: 'Free tier' },
  'sbo-run-predictions': { provider: 'internal', cost_cents: 0, note: 'Internal AI predictions' },
  'sbo-run-prop-predictions': { provider: 'internal', cost_cents: 0, note: 'Internal AI prop predictions (fanout)' },

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
  { fn: 'sbo-run-prop-predictions', label: 'AI Prop Predictions (per prop)', icon: '🎯', required: false },
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
      prop_fanout_limit,

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
    let skippedCount = 0;
    const startTime = Date.now();

    const recordStep = async (
      step: { fn: string; label: string; required?: boolean },
      opts: { sport: string; status: 'success' | 'warning' | 'skipped' | 'error'; records?: number; note?: string; error?: string; duration_ms: number }
    ) => {
      const costInfo = API_COSTS[step.fn];
      const records = opts.records ?? 0;

      // A REQUIRED step that "succeeds" with zero records and no explanatory
      // note is not healthy — it's a silent no-op (dead feed, off-season, etc).
      // Downgrade to `warning` so it surfaces instead of reading green.
      let status = opts.status;
      let note = opts.note;
      if (status === 'success' && step.required && records === 0 && !opts.note) {
        status = 'warning';
        note = 'Required step returned 0 records — feed may be stale, off-season, or misconfigured';
      }

      if (status === 'skipped') {
        skippedCount += 1;
      } else if (status !== 'error') {
        totalRecords += records;
        totalCalls += 1;
        totalCostCents += costInfo?.cost_cents || 0;
      }
      if (status !== 'skipped') {
        await supabase.from('sbo_api_costs').insert({
          run_date: date,
          feed_name: step.fn,
          api_provider: costInfo?.provider || 'unknown',
          endpoint_called: step.fn,
          records_returned: records,
          estimated_cost_cents: status === 'error' ? 0 : (costInfo?.cost_cents || 0),
          api_calls_made: 1,
          response_status: status === 'error' ? 'error' : 'success',
        });
      }
      const entry = {
        fn: step.fn,
        label: step.label,
        sport: opts.sport,
        records,
        duration_ms: opts.duration_ms,
        status,
        note: note ?? costInfo?.note,
        ...(opts.error ? { error: opts.error } : {}),
      };
      if (status === 'error') failed.push(entry);
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

          // ── Per-prop prediction fanout ──────────────────────────────────
          // Invokes sbo-run-predictions' player_prop branch once per deduped
          // prop. Idempotent (same-day predictions are pre-filtered), capped,
          // and bounded by a wall-clock budget so it can never eat the whole
          // 150s edge-function limit. Resumable across pregame runs.
          if (step.fn === 'sbo-run-prop-predictions') {
            const MAX_PROPS_PER_RUN = Number(prop_fanout_limit ?? 25);
            const TIME_BUDGET_MS = 60_000;

            const dayStart = `${date}T00:00:00Z`;
            const _next = new Date(`${date}T00:00:00Z`);
            _next.setUTCDate(_next.getUTCDate() + 1);
            const dayEnd = _next.toISOString();

            const { data: props, error: propsErr } = await supabase
              .from('sbo_player_props')
              .select('id, player_name, prop_type, line, source, created_at')
              .eq('sport_key', sport)
              .gte('game_date', dayStart)
              .lt('game_date', dayEnd)
              .order('created_at', { ascending: false });
            if (propsErr) throw propsErr;

            // Dedupe by (player_name, prop_type): freshest wins, book preference
            // breaks ties (real sportsbook line beats a PrizePicks line).
            const SOURCE_RANK: Record<string, number> = { draftkings: 3, fanduel: 2, prizepicks: 1 };
            const bestByKey = new Map<string, any>();
            for (const p of (props ?? [])) {
              const key = `${(p.player_name || '').toLowerCase()}|${p.prop_type}`;
              const cur = bestByKey.get(key);
              if (!cur) { bestByKey.set(key, p); continue; }
              const newer = new Date(p.created_at).getTime() > new Date(cur.created_at).getTime();
              const better = (SOURCE_RANK[p.source] ?? 0) > (SOURCE_RANK[cur.source] ?? 0);
              if (newer || better) bestByKey.set(key, p);
            }
            let queue = [...bestByKey.values()];
            const dedupedTotal = queue.length;

            // Pre-filter props that already have a prediction today (resumable).
            const etToday = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
            const { data: existing } = await supabase
              .from('sbo_predictions')
              .select('prop_id')
              .eq('prediction_type', 'player_prop')
              .gte('created_at', `${etToday}T00:00:00`)
              .not('prop_id', 'is', null);
            const done = new Set((existing ?? []).map((r: any) => r.prop_id));
            queue = queue.filter(p => !done.has(p.id));
            const pending = queue.length;

            let saved = 0, skipped = 0, failedProps = 0, invoked = 0;
            let stopReason: string | null = null;

            for (const prop of queue) {
              if (invoked >= MAX_PROPS_PER_RUN) { stopReason = `cap ${MAX_PROPS_PER_RUN} reached`; break; }
              if (Date.now() - stepStart > TIME_BUDGET_MS) { stopReason = `time budget ${TIME_BUDGET_MS / 1000}s reached`; break; }

              invoked += 1;
              try {
                const { data: res, error: invErr } = await supabase.functions.invoke('sbo-run-predictions', {
                  body: { prop_id: prop.id, prediction_type: 'player_prop' },
                });
                if (invErr) { failedProps += 1; continue; }
                if (res?.insert_error) { failedProps += 1; continue; }
                if (res?.saved === true && res?.prediction_id) saved += 1;
                else if (res?.skipped === true || res?.source === 'cache') skipped += 1;
                else failedProps += 1;
              } catch (propErr: any) {
                console.error(`[${sport}] prop ${prop.id} failed:`, propErr?.message);
                failedProps += 1;
              }
              await new Promise(r => setTimeout(r, 400));
            }

            const remaining = Math.max(pending - invoked, 0);
            await recordStep(step, {
              sport,
              status: failedProps > 0 && saved === 0 && invoked > 0 ? 'warning' : 'success',
              records: saved,
              duration_ms: Date.now() - stepStart,
              note: `${dedupedTotal} deduped props (${(props ?? []).length} raw) · ${invoked} invoked · ${saved} saved · ${skipped} skipped · ${failedProps} failed · ${remaining} remaining${stopReason ? ` — stopped: ${stopReason}` : ''}${dedupedTotal === 0 ? ' — no props for this sport today' : ''}`,
            });
            continue;
          }

          // Special handling: run-predictions fans out per game

          if (step.fn === 'sbo-run-predictions') {
            // DISABLED 2026-07-22: sbo-run-predictions has no derivation
            // for `predicted_outcome` on moneyline predictions — every
            // insert fails the NOT NULL constraint. Skipping honestly
            // rather than logging silent failures. Structure preserved
            // so re-enabling is just restoring the fanout body once a
            // real derivation exists.
            const dayStart = `${date}T00:00:00Z`;
            const _next = new Date(`${date}T00:00:00Z`);
            _next.setUTCDate(_next.getUTCDate() + 1);
            const dayEnd = _next.toISOString();
            const { data: games, error: gamesErr } = await supabase
              .from('sbo_games')
              .select('id')
              .eq('sport_key', sport)
              .gte('game_date', dayStart)
              .lt('game_date', dayEnd);
            if (gamesErr) throw gamesErr;

            const gamesQueried = (games ?? []).length;
            await recordStep(step, {
              sport,
              status: 'success',
              records: 0,
              duration_ms: Date.now() - stepStart,
              note: `${gamesQueried} games queried, 0 invoked — skipped: moneyline predicted_outcome derivation not yet implemented (disabled 2026-07-22)`,
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
    const realStepsPlanned = totalStepsPlanned - skippedCount;
    const errorCount = failed.length;
    const status = errorCount === 0 ? 'completed'
      : (realStepsPlanned > 0 && errorCount === realStepsPlanned) ? 'failed'
      : 'partial';

    // Lightweight duration safety net — Supabase edge function wall-clock is 150s.
    // Warn at >120s so we notice ceiling pressure before a real timeout.
    const DURATION_WARN_THRESHOLD_S = 120;
    const durationWarning = duration > DURATION_WARN_THRESHOLD_S
      ? `⚠️ Run took ${duration}s — approaching 150s edge-function wall-clock limit. Consider adding chunked concurrency to per-game prediction fanout if this recurs.`
      : null;

    // Nest per-sport summary metadata into steps_completed payload (no schema migration).
    const stepsCompletedPayload = {
      sports_run: sportsToRun,
      sports_skipped_unsupported: sportsSkippedUnsupported,
      allowlist: Array.from(SUPPORTED_ALLOWLIST),
      steps_planned: totalStepsPlanned,
      steps_skipped: skippedCount,
      real_steps_planned: realStepsPlanned,
      ...(durationWarning ? { duration_warning: durationWarning } : {}),
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
