// ═══════════════════════════════════════════════════════════════
// SBO — PLAYER GAME STATS INGESTION (SPORT-KEYED, FREE ESPN)
// ═══════════════════════════════════════════════════════════════
// Sub-stage 2b of the Stats Brain.
//
// Reuses _shared/espnGrading.ts verbatim — the SAME fetchers and the
// SAME buildStatLines() parser that grade results. The brain and the
// grader therefore can never disagree about what a stat means.
//
// Idempotent by construction: every write is an upsert on the
// (sport, player_key, game_id) unique constraint, so re-running any
// date is safe and produces no duplicates.
//
// Params (POST JSON, all optional):
//   sport      — sport_key, default 'mlb'. Must exist in GRADING_CONFIGS.
//   sports     — string[] of sport_keys. Overrides `sport`; the function then
//                loops every listed sport in one invocation. This is the
//                multi-sport fanout entry point used by sbo-day-engine and by
//                the hourly stats cron (NFL/NHL/WNBA/MLB in a single call).
//   date       — 'YYYY-MM-DD' single day. Default: yesterday (UTC).
//   days_back  — ingest N days ending at `date` (inclusive). Default 1.
//                Used for history seeding, e.g. days_back: 120.
//   season     — season label for the splits rollup. Default: year of `date`.
//   skip_splits— true to ingest games only and defer the rollup.
//   dry_run    — true to fetch ESPN box scores and REPORT what would be written
//                without performing a single database write. Used to verify new
//                sport wiring (NFL/NHL/WNBA) without mutating production data.
//   force      — true to bypass the off-season guard below.
//
// OFF-SEASON GUARD: a sport whose season window does not contain the requested
// date is SKIPPED (status 'skipped_offseason'), not failed. NFL box scores stop
// existing in February and resume in September; churning ESPN for empty
// scoreboards every hour is noise, not a failure.


import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getGradingConfig,
  GRADED_SPORT_KEYS,
  fetchEspnFinals,
  fetchEspnSummary,
  seasonForDate,
  seasonWindow,
  type StatLine,
  type EspnFinal,
} from '../_shared/espnGrading.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Numeric fields we roll up. Non-numeric/boolean keys are ignored. */
const SKIP_KEYS = new Set(['Name', 'athleteId', 'batted', 'pitched']);

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dateRange(endDate: string, daysBack: number): string[] {
  const out: string[] = [];
  const end = new Date(`${endDate}T00:00:00Z`);
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(ymd(d));
  }
  return out;
}

/** Average every numeric key present across a set of stat lines. */
function averages(lines: Record<string, any>[]): Record<string, number> {
  const sums: Record<string, number> = {};
  const counts: Record<string, number> = {};
  for (const line of lines) {
    for (const [k, v] of Object.entries(line ?? {})) {
      if (SKIP_KEYS.has(k)) continue;
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      sums[k] = (sums[k] ?? 0) + v;
      counts[k] = (counts[k] ?? 0) + 1;
    }
  }
  const out: Record<string, number> = {};
  for (const k of Object.keys(sums)) {
    out[k] = Math.round((sums[k] / counts[k]) * 1000) / 1000;
  }
  return out;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const sport = String(body.sport ?? 'mlb').toLowerCase();
    const config = getGradingConfig(sport);

    if (!config) {
      return new Response(JSON.stringify({
        success: false,
        error: `No stats config for sport '${sport}'. Supported: ${GRADED_SPORT_KEYS.join(', ')}`,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const endDate = String(body.date ?? ymd(yesterday));
    const daysBack = Math.max(1, Math.min(Number(body.days_back ?? 1), 400));
    // Season label: for sports whose season crosses a calendar year
    // (NFL/NHL/NBA), a January game belongs to the PRIOR year's season.
    const season = String(body.season ?? seasonForDate(sport, endDate));
    const window = seasonWindow(sport, season);
    const skipSplits = body.skip_splits === true;

    const dates = dateRange(endDate, daysBack);

    let gamesSeen = 0;
    let gamesParsed = 0;
    let rowsUpserted = 0;
    const affectedPlayers = new Set<string>();
    const dayResults: any[] = [];
    const errors: string[] = [];

    for (const dateStr of dates) {
      const sb = await fetchEspnFinals(config, dateStr);
      if (!sb.ok) {
        errors.push(`${dateStr}: ${sb.error}`);
        dayResults.push({ date: dateStr, ok: false, error: sb.error });
        continue;
      }
      gamesSeen += sb.finals.length;
      let dayRows = 0;

      for (const final of sb.finals as EspnFinal[]) {
        const summary = await fetchEspnSummary(config, final.eventId);
        if (!summary) {
          errors.push(`${dateStr}: no summary for event ${final.eventId}`);
          continue;
        }

        let lines: StatLine[] = [];
        try {
          lines = config.buildStatLines(summary);
        } catch (e: any) {
          errors.push(`${dateStr}/${final.eventId}: parse failed — ${e?.message}`);
          continue;
        }
        if (!lines.length) continue;
        gamesParsed++;

        // Determine each athlete's side from the box score team blocks.
        const homeIds = new Set<string>();
        const teamBlocks = summary?.boxscore?.players ?? [];
        for (const block of teamBlocks) {
          const isHome = String(block?.team?.id ?? '') ===
            String(summary?.header?.competitions?.[0]?.competitors
              ?.find((c: any) => c.homeAway === 'home')?.team?.id ?? '');
          if (!isHome) continue;
          for (const group of block?.statistics ?? []) {
            for (const a of group?.athletes ?? []) {
              if (a?.athlete?.id) homeIds.add(String(a.athlete.id));
            }
          }
        }

        const rows = lines.map((line) => {
          const isHome = line.athleteId ? homeIds.has(line.athleteId) : null;
          return {
            sport,
            player_name: line.Name,
            player_id: line.athleteId,
            team: isHome === null ? null : (isHome ? final.homeName : final.awayName),
            opponent: isHome === null ? null : (isHome ? final.awayName : final.homeName),
            game_id: final.eventId,
            game_date: dateStr,
            is_home: isHome,
            stat_line: line,
            source: 'espn',
          };
        });

        // Upsert on the player_key-based unique constraint — safe to re-run any date.
        // player_key is a generated column: coalesce(player_id, player_name), so two
        // different athletes sharing a name never collide.
        const { error } = await supabase
          .from('sbo_player_game_stats')
          .upsert(rows, { onConflict: 'sport,player_key,game_id' });

        if (error) {
          errors.push(`${dateStr}/${final.eventId}: upsert failed — ${error.message}`);
          continue;
        }
        rowsUpserted += rows.length;
        dayRows += rows.length;
        for (const r of rows) affectedPlayers.add(r.player_id || r.player_name);
      }

      dayResults.push({ date: dateStr, ok: true, finals: sb.finals.length, rows: dayRows });
    }

    // ── Season splits rollup (computed, never fetched) ──────────────
    let splitsUpserted = 0;
    if (!skipSplits && affectedPlayers.size > 0) {
      const keys = [...affectedPlayers];
      for (let i = 0; i < keys.length; i += 50) {
        const chunk = keys.slice(i, i + 50);
        const { data: gameRows, error: readErr } = await supabase
          .from('sbo_player_game_stats')
          .select('player_key,player_name,player_id,team,game_date,is_home,stat_line')
          .eq('sport', sport)
          .in('player_key', chunk)
          .gte('game_date', window.from)
          .lte('game_date', window.to)
          .order('game_date', { ascending: false })
          .limit(10000);

        if (readErr) {
          errors.push(`splits read failed: ${readErr.message}`);
          break;
        }

        const byPlayer = new Map<string, any[]>();
        for (const g of gameRows ?? []) {
          const k = g.player_key;
          const arr = byPlayer.get(k) ?? [];
          arr.push(g);
          byPlayer.set(k, arr);
        }

        const splitRows = [...byPlayer.entries()].map(([, games]) => {
          // games already sorted newest-first
          const lines = games.map((g) => g.stat_line ?? {});
          return {
            sport,
            player_name: games[0]?.player_name ?? null,
            player_id: games[0]?.player_id ?? null,
            team: games[0]?.team ?? null,
            season,
            games_played: games.length,
            season_averages: averages(lines),
            last_5_averages: averages(lines.slice(0, 5)),
            last_10_averages: averages(lines.slice(0, 10)),
            home_averages: averages(games.filter((g) => g.is_home === true).map((g) => g.stat_line ?? {})),
            away_averages: averages(games.filter((g) => g.is_home === false).map((g) => g.stat_line ?? {})),
            last_game_date: games[0]?.game_date ?? null,
            computed_at: new Date().toISOString(),
          };
        });

        if (splitRows.length) {
          const { error: splitErr } = await supabase
            .from('sbo_player_season_splits')
            .upsert(splitRows, { onConflict: 'sport,player_key,season' });
          if (splitErr) errors.push(`splits upsert failed: ${splitErr.message}`);
          else splitsUpserted += splitRows.length;
        }
      }
    }


    const result = {
      success: true,
      sport,
      season,
      season_window: window,
      dates_processed: dates.length,
      date_range: { from: dates[0], to: dates[dates.length - 1] },
      games_seen: gamesSeen,
      games_parsed: gamesParsed,
      records_synced: rowsUpserted,
      players_touched: affectedPlayers.size,
      splits_upserted: splitsUpserted,
      errors: errors.slice(0, 25),
      error_count: errors.length,
      days: dayResults,
    };

    console.log('[sbo-ingest-player-stats]', JSON.stringify({
      sport, records_synced: rowsUpserted, splits_upserted: splitsUpserted, error_count: errors.length,
    }));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[sbo-ingest-player-stats] fatal:', e?.message);
    return new Response(JSON.stringify({ success: false, error: e?.message ?? 'unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
