import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Sports with a working free-ESPN grading path (registry in _shared/espnGrading.ts).
import { GRADED_SPORT_KEYS } from '../_shared/espnGrading.ts';


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

// A pipeline step. `sports` is the sport-support declaration: when
// present, the step only runs for those sport_keys. Absent = runs for
// every allowlisted sport. This replaces the old NBA_ONLY_STEPS set,
// which hardcoded `sport !== 'nba'` in the loop and would have needed
// editing again for every new sport.
type EngineStep = {
  fn: string;
  label: string;
  icon: string;
  required: boolean;
  sports?: string[];
  sportsNote?: string;
};

// Per-sport step chain (order matters). fetch-odds must precede run-predictions
// so sbo_games has today's rows for the sport when predictions fan out.
const MORNING_STEPS: EngineStep[] = [
  { fn: 'sbo-sync-daily', label: 'Season Stats + Injuries + Standings', icon: '📊', required: true, sports: ['nba'], sportsNote: 'SportsDataIO NBA-only feed' },
];

const PREGAME_STEPS: EngineStep[] = [
  { fn: 'sbo-fetch-odds', label: 'Live Odds (DK/FD/BetMGM/Caesars)', icon: '💰', required: true },
  { fn: 'sbo-run-prop-predictions', label: 'AI Prop Predictions (per prop)', icon: '🎯', required: false },
  { fn: 'sbo-run-predictions', label: 'AI Predictions (per game, moneyline)', icon: '🧠', required: false },

  { fn: 'sbo-sync-pregame', label: 'Projections + Game Logs + SDIO Props', icon: '📈', required: true, sports: ['nba'], sportsNote: 'SportsDataIO NBA-only feed' },
  { fn: 'sbo-sync-prizepicks', label: 'PrizePicks Props', icon: '🎯', required: false, sports: ['nba'], sportsNote: 'PrizePicks sync is NBA-hardcoded' },
  { fn: 'sbo-sync-polymarket-full', label: 'Polymarket Full (214 NBA Markets)', icon: '🔮', required: false, sports: ['nba'], sportsNote: 'Polymarket markets are NBA-hardcoded' },
];

// Global (run once total, after per-sport loop finishes)
const GLOBAL_STEPS: EngineStep[] = [
  { fn: 'sbo-compare-odds', label: 'Cross-Platform Odds Comparison', icon: '💎', required: false },
  { fn: 'sbo-generate-daily-briefing', label: 'Generate Daily SMS Briefing', icon: '📱', required: false },
  { fn: 'sbo-send-daily-sms', label: 'Send Daily SMS to Phone', icon: '✉️', required: false },
];

const POSTGAME_STEPS: EngineStep[] = [
  // Grading runs on free ESPN feeds. Label + required flag are resolved at
  // runtime from GRADED_SPORT_KEYS (see below) so this stops saying "MLB"
  // once WNBA/NFL configs land — and so a night with no ESPN-graded sport
  // running doesn't get flagged required-but-empty.
  { fn: 'sbo-verify-results', label: 'Result Grading (ESPN scores + player props)', icon: '⚖️', required: true },
  // Stats Brain ingestion (2b). Runs AFTER grading so the day's finals exist,
  // and only for sports that have an ESPN grading config (same parser).
  { fn: 'sbo-ingest-player-stats', label: 'Player Game Stats Ingestion (ESPN)', icon: '🧾', required: false, sports: GRADED_SPORT_KEYS, sportsNote: 'Free ESPN box scores; sports with a grading config only' },
  // Alt-sport CAPPER-PICK grading (CFL + MMA). Game/match level only —
  // no props, no sbo_predictions, no stats brain, no clamp gates, no
  // market lines. Runs once globally (no `sports` fanout) inside the
  // existing daily cadence; deliberately not `required` because these
  // feeds are third-party and may be empty on any given night.
  { fn: 'sbo-grade-capper-picks-alt', label: 'Capper Pick Grading — Alt Sports (CFL, MMA)', icon: '🥊', required: false },
  { fn: 'sbo-track-results', label: 'Grade Predictions + Update Accuracy', icon: '📋', required: false },
  { fn: 'sbo-analyze-model', label: 'Model Self-Analysis + Weight Adjustment', icon: '🧬', required: false },
];

// Pipeline-supported sports today. sbo_sports may mark more as active,
// but only these actually produce meaningful output end-to-end.
// nfl/nhl are fully scaffolded in sbo-fetch-odds (SPORT_MAP + PROP_MARKETS +
// PROP_TYPE_MAP) — they ingest odds/props, but have no ESPN GRADING_CONFIG yet,
// so grading + stats ingestion stay MLB-only by design.
const SUPPORTED_ALLOWLIST = new Set<string>(['nba', 'mlb', 'nfl', 'nhl', 'wnba']);

// ── Season windows (BUG-01) ────────────────────────────────────────
// A zero-row feed is only an ERROR when the sport is actually in season.
// NBA in August is a legitimate zero and must NOT fail the run.
// Inclusive month ranges (1-12) in US/Eastern terms; a window whose start
// month is greater than its end month wraps the calendar year.
const SEASON_WINDOWS: Record<string, { start: number; end: number }> = {
  mlb: { start: 3, end: 10 },   // Mar–Oct
  wnba: { start: 5, end: 9 },   // May–Sep
  nfl: { start: 9, end: 2 },    // Sep–Feb (wraps)
  nhl: { start: 10, end: 6 },   // Oct–Jun (wraps)
  nba: { start: 10, end: 6 },   // Oct–Jun (wraps)
};

function isInSeason(sportKey: string, dateStr: string): boolean {
  const w = SEASON_WINDOWS[(sportKey || '').toLowerCase()];
  if (!w) return false; // unknown sport: never fail the run on its behalf
  const month = Number(dateStr.slice(5, 7));
  if (!month) return false;
  return w.start <= w.end
    ? month >= w.start && month <= w.end
    : month >= w.start || month <= w.end;
}

// sbo-fetch-odds reports games_inserted/props_inserted; other steps report
// records_synced/games_processed/inserted/props. Reading only the latter set
// (the old behaviour) made every odds fetch look like zero records, which is
// exactly how a dead upstream feed stayed invisible.
function extractRecords(data: any): number {
  if (!data || typeof data !== 'object') return 0;
  const explicit = data.records_synced ?? data.games_processed ?? data.inserted ?? data.props;
  if (typeof explicit === 'number') return explicit;
  const oddsTotal = (Number(data.games_inserted) || 0) + (Number(data.props_inserted) || 0);
  if (oddsTotal > 0) return oddsTotal;
  if (typeof data.games_fetched === 'number' || typeof data.props_fetched === 'number') return 0;
  return 0;
}

// A required feed that produced zero rows for an IN-SEASON sport. Collected
// during the run and turned into a thrown failure at the end so the run
// cannot report HTTP 200 while writing nothing.
type FeedBlocker = { sport: string; fn: string; detail: string };

// Whole-invocation wall clock. Each fanout step used to claim its own fixed 60s
// budget, which was safe at 2 sports and would blow the ~150s edge limit at 4.
// Steps now draw from this shared deadline instead.
const RUN_BUDGET_MS = 115_000;


serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Hoisted run state so the finally block can always close the run row,
  // even on crash, thrown error, or client-side timeout.
  let supabaseRef: any = null;
  let runId: string | undefined;
  let finalized = false;
  const completed: any[] = [];
  const failed: any[] = [];
  let totalRecords = 0;
  let totalCalls = 0;
  let totalCostCents = 0;
  let skippedCount = 0;
  const startTime = Date.now();
  let fatalError: string | null = null;
  // Required feeds that returned zero rows for an in-season sport (BUG-01).
  const blockers: FeedBlocker[] = [];

  try {

    const body = await req.json().catch(() => ({}));
    const {
      run_type = 'manual',
      steps = 'full',
      date = new Date().toISOString().split('T')[0],
      prop_fanout_limit,

    } = body;

    const RUN_START = Date.now();
    const remainingRunMs = () => Math.max(0, RUN_BUDGET_MS - (Date.now() - RUN_START));
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    supabaseRef = supabase;


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

    // Resolve the ESPN grading step's label + required flag from the sports
    // actually running tonight that have a grading config. Required only when
    // at least one of them does — otherwise a clean zero is honest, not a warning.
    const gradedRunning = sportsToRun.filter(s => GRADED_SPORT_KEYS.includes(s));
    postgameSteps = postgameSteps.map(s =>
      s.fn === 'sbo-verify-results'
        ? {
            ...s,
            required: gradedRunning.length > 0,
            label: gradedRunning.length > 0
              ? `Result Grading — ESPN (${gradedRunning.map(x => x.toUpperCase()).join(', ')})`
              : 'Result Grading — ESPN (no graded sport active)',
          }
        : s
    );


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

    runId = runRecord?.id;


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
    // Fair-share: each sport gets (remaining loop budget / sports left), so a
    // busy MLB slate can no longer consume the entire window and starve the
    // sports behind it. A sport with no work returns instantly and hands its
    // unused share back to the ones still queued.
    const PER_SPORT_LOOP_BUDGET_MS = 90_000;
    const LOOP_START = Date.now();
    const loopRemainingMs = () => Math.max(0, PER_SPORT_LOOP_BUDGET_MS - (Date.now() - LOOP_START));
    let sportsLeft = sportsToRun.length;
    for (const sport of sportsToRun) {
      const sportBudgetMs = Math.max(10_000, Math.floor(loopRemainingMs() / Math.max(1, sportsLeft)));
      const sportStart = Date.now();
      const sportRemainingMs = () => Math.max(0, sportBudgetMs - (Date.now() - sportStart));
      sportsLeft -= 1;
      for (const step of perSportSteps) {
        const stepStart = Date.now();


        // Sport-support gate (declarative, per-step)
        if (step.sports && !step.sports.includes(sport)) {
          await recordStep(step, {
            sport,
            status: 'skipped',
            duration_ms: 0,
            note: `Skipped: ${step.fn} supports [${step.sports.join(', ')}] only${step.sportsNote ? ` — ${step.sportsNote}` : ''}, not ${sport}`,
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
            // Cap raised 25 -> 40 per sport: with up to 4 sports in the
            // allowlist the old cap under-served busy MLB slates while the
            // shared run budget (not the cap) is now the real limiter.
            const MAX_PROPS_PER_RUN = Number(prop_fanout_limit ?? 60);
            // If the moneyline step is also scheduled in this run, reserve 30%
            // of the sport's fair share for it. On step-filtered runs that
            // exclude moneyline (e.g. the prop-fanout catch-up cron), props
            // get the full 100% of the share instead of idling 30%.
            const moneylineScheduled = perSportSteps.some(s => s.fn === 'sbo-run-predictions');
            const propShare = moneylineScheduled ? 0.7 : 1.0;
            const TIME_BUDGET_MS = Math.max(8_000, Math.floor(sportRemainingMs() * propShare));
            const PROP_CONCURRENCY = 3;


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

            const capped = queue.slice(0, MAX_PROPS_PER_RUN);
            if (queue.length > MAX_PROPS_PER_RUN) stopReason = `cap ${MAX_PROPS_PER_RUN} reached`;
            for (let i = 0; i < capped.length; i += PROP_CONCURRENCY) {
              if (Date.now() - stepStart > TIME_BUDGET_MS) {
                stopReason = `time budget ${Math.round(TIME_BUDGET_MS / 1000)}s reached`;
                break;
              }
              const batch = capped.slice(i, i + PROP_CONCURRENCY);
              invoked += batch.length;
              await Promise.all(batch.map(async (prop: any) => {
                try {
                  const { data: res, error: invErr } = await supabase.functions.invoke('sbo-run-predictions', {
                    body: { prop_id: prop.id, prediction_type: 'player_prop' },
                  });
                  if (invErr || res?.insert_error) { failedProps += 1; return; }
                  if (res?.saved === true && res?.prediction_id) saved += 1;
                  else if (res?.skipped === true || res?.source === 'cache') skipped += 1;
                  else failedProps += 1;
                } catch (propErr: any) {
                  console.error(`[${sport}] prop ${prop.id} failed:`, propErr?.message);
                  failedProps += 1;
                }
              }));
              await new Promise(r => setTimeout(r, 150));
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
            // RE-ENABLED 2026-08-01. The 2026-07-22 disable existed because
            // moneyline had no `predicted_outcome` derivation. It now does:
            // sbo-run-predictions derives the side from de-vigged market
            // consensus. We deliberately DO NOT pass `predicted_outcome` —
            // the de-vig path must be the only source of the side.
            // Guardrails mirror the prop fanout: hard cap, wall-clock budget,
            // and idempotency via the function's own same-day cache check,
            // which makes the step resumable across the 13:00 / 23:00 runs.
            const MAX_GAMES_PER_RUN = 30;
            const TIME_BUDGET_MS = Math.max(8_000, sportRemainingMs());
            const CONCURRENCY = 3;

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

            const queue = (games ?? []).slice(0, MAX_GAMES_PER_RUN);
            const gamesQueried = (games ?? []).length;
            let saved = 0, skipped = 0, failedGames = 0, invoked = 0;
            let stopReason: string | null = null;

            for (let i = 0; i < queue.length; i += CONCURRENCY) {
              if (Date.now() - stepStart > TIME_BUDGET_MS) {
                stopReason = `time budget ${TIME_BUDGET_MS / 1000}s reached`;
                break;
              }
              const batch = queue.slice(i, i + CONCURRENCY);
              invoked += batch.length;

              await Promise.all(batch.map(async (game: any) => {
                try {
                  const { data: res, error: invErr } = await supabase.functions.invoke('sbo-run-predictions', {
                    body: { game_id: game.id, prediction_type: 'moneyline' },
                  });
                  if (invErr) { failedGames += 1; return; }
                  if (res?.insert_error) { failedGames += 1; return; }
                  if (res?.saved === true && res?.prediction_id) saved += 1;
                  else if (res?.skipped === true || res?.source === 'cache') skipped += 1;
                  else failedGames += 1;
                } catch (gameErr: any) {
                  console.error(`[${sport}] game ${game.id} moneyline failed:`, gameErr?.message);
                  failedGames += 1;
                }
              }));

              await new Promise(r => setTimeout(r, 400));
            }

            if (!stopReason && gamesQueried > MAX_GAMES_PER_RUN) {
              stopReason = `cap ${MAX_GAMES_PER_RUN} reached`;
            }
            const remaining = Math.max(gamesQueried - invoked, 0);

            await recordStep(step, {
              sport,
              status: failedGames > 0 && saved === 0 && invoked > 0 ? 'warning' : 'success',
              records: saved,
              duration_ms: Date.now() - stepStart,
              note: `${gamesQueried} games · ${invoked} invoked · ${saved} saved · ${skipped} skipped · ${failedGames} failed · ${remaining} remaining${stopReason ? ` — stopped: ${stopReason}` : ''}${gamesQueried === 0 ? ' — no games for this sport today' : ''}`,
            });
            continue;
          }


          // Standard per-sport step — pass sport_key through
          const { data, error } = await supabase.functions.invoke(step.fn, {
            body: { date, sport_key: sport },
          });

          if (error && step.required) throw error;

          const records = extractRecords(data);
          const upstreamErrors = Array.isArray(data?.errors) ? data.errors : [];

          // BUG-01: a required feed that returns zero rows for an IN-SEASON
          // sport is a pipeline failure, not a quiet success. Previously this
          // recorded 'success' and the run reported HTTP 200 while writing
          // nothing, which is how the props table went stale unnoticed.
          let zeroFeed = false;
          if (step.required && records === 0 && isInSeason(sport, date)) {
            zeroFeed = true;
            const detail = upstreamErrors.length
              ? upstreamErrors.map((e: any) => `${e?.stage ?? 'error'}: ${e?.detail ?? e}`).join('; ')
              : 'upstream returned no rows and reported no error';
            blockers.push({ sport, fn: step.fn, detail });
          }

          await recordStep(step, {
            sport,
            status: error || zeroFeed ? (zeroFeed ? 'error' : 'warning') : 'success',
            records,
            duration_ms: Date.now() - stepStart,
            error: zeroFeed
              ? `ZERO ROWS for in-season ${sport.toUpperCase()} on ${date} — ${blockers[blockers.length - 1].detail}`
              : undefined,
          });

          await new Promise(r => setTimeout(r, 500));
        } catch (e: any) {
          console.error(`[${sport}] Step ${step.fn} failed:`, e.message);
          if (step.required && isInSeason(sport, date)) {
            blockers.push({ sport, fn: step.fn, detail: e?.message ?? 'step threw' });
          }
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

    // ---------- Postgame ----------
    // Steps WITHOUT a `sports` list run once globally (unchanged semantics).
    // Steps WITH one (e.g. sbo-ingest-player-stats, gated on GRADED_SPORT_KEYS)
    // fan out over the graded sports actually running, passing `sport` — without
    // this they silently ran once on their own default sport only.
    for (const step of postgameSteps) {
      const targets = step.sports
        ? sportsToRun.filter(s => step.sports!.includes(s))
        : [null];

      for (const target of targets) {
        const stepStart = Date.now();
        try {
          const { data, error } = await supabase.functions.invoke(step.fn, {
            body: target ? { date, sport: target } : { date },
          });
          if (error && step.required) throw error;
          const records = data?.records_synced || data?.games_processed || data?.inserted || data?.props || 0;
          await recordStep(step, {
            sport: target ?? 'global',
            status: error ? 'warning' : 'success',
            records,
            duration_ms: Date.now() - stepStart,
          });
        } catch (e: any) {
          await recordStep(step, {
            sport: target ?? 'global',
            status: 'error',
            duration_ms: Date.now() - stepStart,
            error: e.message,
          });
        }
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    const totalStepsPlanned = (perSportSteps.length * sportsToRun.length) + globalSteps.length + postgameSteps.length;
    const realStepsPlanned = totalStepsPlanned - skippedCount;
    const errorCount = failed.length;
    // BUG-01: any in-season required feed that produced zero rows downgrades
    // the run to 'failed' regardless of how many other steps succeeded. A run
    // that syncs nothing for a live sport is not a success.
    const status = blockers.length > 0 ? 'failed'
      : errorCount === 0 ? 'completed'
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
      ...(blockers.length ? { zero_row_blockers: blockers } : {}),
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
    finalized = true;

    if (blockers.length > 0) {
      const msg = blockers
        .map(b => `${b.sport.toUpperCase()}/${b.fn}: ${b.detail}`)
        .join(' | ');
      console.error(`[sbo-day-engine] PIPELINE BLOCKED — ${msg}`);
    }

    return new Response(JSON.stringify({
      success: blockers.length === 0,
      run_id: runId,
      status,
      sports_run: sportsToRun,
      sports_skipped_unsupported: sportsSkippedUnsupported,
      ...(blockers.length
        ? {
            error: `Pipeline blocked: ${blockers.length} required feed(s) returned zero rows for in-season sport(s) on ${date}`,
            zero_row_blockers: blockers,
          }
        : {}),
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
    }), {
      status: blockers.length > 0 ? 500 : 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    fatalError = e instanceof Error ? e.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: fatalError }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } finally {
    // Always close the run row. If the happy-path update already ran
    // (finalized === true) this is a no-op. Otherwise persist whatever
    // partial progress was captured before the error/abort.
    if (!finalized && runId && supabaseRef) {
      try {
        const duration = Math.round((Date.now() - startTime) / 1000);
        const partialStatus = completed.length > 0 ? 'partial' : 'failed';
        await supabaseRef
          .from('sbo_day_engine_runs')
          .update({
            steps_completed: {
              steps: completed,
              steps_skipped: skippedCount,
              aborted: true,
            },
            steps_failed: [
              ...failed,
              { fn: 'run', error: fatalError ?? 'Run aborted before completion', aborted: true },
            ],
            total_records_synced: totalRecords,
            total_api_calls: totalCalls,
            estimated_cost_cents: totalCostCents,
            duration_seconds: duration,
            status: partialStatus,
            completed_at: new Date().toISOString(),
          })
          .eq('id', runId);
      } catch (_) {
        // Never let cleanup failure mask the original response.
      }
    }
  }
});

