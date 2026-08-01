import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// ═══════════════════════════════════════════════════════════════
// GENERALIZED GRADING — every sport routes through getGradingConfig().
// There are no per-sport branches in this file anymore: the ESPN path,
// team aliases, box-score parser and prop→field map all come from
// GRADING_CONFIGS. MLB is unchanged by construction — it already ran
// through MLB_GRADING via the espnMlb shim, so it is literally the same
// functions, reached through the registry instead of a named import.
//
// The one vendor-specific path that remains (NBA / SportsDataIO) is
// declared as DATA in LEGACY_SCORE_SOURCES. A sport with no entry there
// cannot reach it.
// ═══════════════════════════════════════════════════════════════
import {
  GRADED_SPORT_KEYS,
  getGradingConfig,
  getLegacyScoreSource,
  LEGACY_SCORE_SOURCES,
  fetchEspnFinals,
  fetchEspnSummary,
  teamMatches,
  findPlayerStats as findEspnPlayerStats,
  type SportGradingConfig,
} from '../_shared/espnGrading.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ═══════════════════════════════════════
// LEGACY NBA / SportsDataIO HELPERS
// Reachable ONLY for sports present in LEGACY_SCORE_SOURCES.
// Left byte-for-byte as they were.
// ═══════════════════════════════════════
const TEAM_KEYWORDS: Record<string, string[]> = {
  'ATL': ['hawks', 'atlanta'], 'BOS': ['celtics', 'boston'], 'BKN': ['nets', 'brooklyn'],
  'CHA': ['hornets', 'charlotte'], 'CHI': ['bulls', 'chicago'], 'CLE': ['cavaliers', 'cleveland'],
  'DAL': ['mavericks', 'dallas'], 'DEN': ['nuggets', 'denver'], 'DET': ['pistons', 'detroit'],
  'GS': ['warriors', 'golden state'], 'GSW': ['warriors', 'golden state'],
  'HOU': ['rockets', 'houston'], 'IND': ['pacers', 'indiana'],
  'LAC': ['clippers', 'los angeles clippers'], 'LAL': ['lakers', 'los angeles lakers'],
  'MEM': ['grizzlies', 'memphis'], 'MIA': ['heat', 'miami'], 'MIL': ['bucks', 'milwaukee'],
  'MIN': ['timberwolves', 'minnesota'], 'NO': ['pelicans', 'new orleans'],
  'NOP': ['pelicans', 'new orleans'], 'NY': ['knicks', 'new york'], 'NYK': ['knicks', 'new york'],
  'OKC': ['thunder', 'oklahoma'], 'ORL': ['magic', 'orlando'],
  'PHI': ['76ers', 'philadelphia', 'sixers'], 'PHO': ['suns', 'phoenix'], 'PHX': ['suns', 'phoenix'],
  'POR': ['trail blazers', 'portland', 'blazers'], 'SA': ['spurs', 'san antonio'],
  'SAS': ['spurs', 'san antonio'], 'SAC': ['kings', 'sacramento'], 'TOR': ['raptors', 'toronto'],
  'UTA': ['jazz', 'utah'], 'UTAH': ['jazz', 'utah'], 'WAS': ['wizards', 'washington'],
};

function teamMatchesAbbrev(teamName: string, abbrev: string): boolean {
  const lower = teamName.toLowerCase();
  const keywords = TEAM_KEYWORDS[abbrev] || TEAM_KEYWORDS[abbrev.toUpperCase()];
  if (!keywords) return false;
  return keywords.some(kw => lower.includes(kw));
}

/** SportsDataIO NBA prop_type → stat. Legacy path only. */
function getSdioPropValue(ps: any, propType: string): number | null {
  const pt = (propType || '').toLowerCase().trim().replace(/[\s_-]/g, '');

  if (['points', 'pts', 'playerpoints', 'point', 'pointsscored'].includes(pt)) return ps.Points ?? null;
  if (['rebounds', 'reb', 'playerrebounds', 'totalrebounds', 'rebound'].includes(pt)) return ps.Rebounds ?? null;
  if (['assists', 'ast', 'playerassists', 'assist'].includes(pt)) return ps.Assists ?? null;
  if (['threes', 'threepointers', '3pt', 'threesmade', '3ptmade', 'playerthrees', 'threepointfieldgoalsmade', '3pmade', 'threepointersmade'].includes(pt)) return ps.ThreePointersMade ?? null;
  if (['blocks', 'blk', 'playerblocks', 'blockedshots', 'blockshots', 'blks', 'block'].includes(pt)) return ps.BlockedShots ?? null;
  if (['steals', 'stl', 'playersteals', 'stls', 'steal'].includes(pt)) return ps.Steals ?? null;
  if (['turnovers', 'tov', 'playerturnovers', 'to', 'turnover'].includes(pt)) return ps.Turnovers ?? null;
  if (['pra', 'ptsrebast', 'pointsreboundsassists', 'pts+reb+ast', 'ptsrebasst'].includes(pt))
    return (ps.Points ?? 0) + (ps.Rebounds ?? 0) + (ps.Assists ?? 0);
  if (['ptsreb', 'pointsrebounds', 'pts+reb', 'pr'].includes(pt))
    return (ps.Points ?? 0) + (ps.Rebounds ?? 0);
  if (['ptsast', 'pointsassists', 'pts+ast', 'pa'].includes(pt))
    return (ps.Points ?? 0) + (ps.Assists ?? 0);
  if (['rebast', 'reboundsassists', 'reb+ast', 'ra'].includes(pt))
    return (ps.Rebounds ?? 0) + (ps.Assists ?? 0);
  if (['blksstls', 'blocksteals', 'blks+stls', 'blockssteals', 'stealsblocks', 'stlblk', 'blkstl'].includes(pt))
    return (ps.BlockedShots ?? 0) + (ps.Steals ?? 0);
  if (['fantasypoints', 'fantasy', 'fp', 'dkfp'].includes(pt)) return ps.FantasyPoints ?? null;
  if (['minutes', 'min', 'mins'].includes(pt)) return ps.Minutes ?? null;
  if (['freethrowsmade', 'ftm', 'freethrows'].includes(pt)) return ps.FreeThrowsMade ?? null;
  if (['offensiverebounds', 'oreb'].includes(pt)) return ps.OffensiveRebounds ?? null;
  if (['defensiverebounds', 'dreb'].includes(pt)) return ps.DefensiveRebounds ?? null;
  if (['personalfouls', 'fouls', 'pf'].includes(pt)) return ps.PersonalFouls ?? null;

  console.warn('UNMAPPED PROP TYPE:', propType, '→ cleaned:', pt);
  return null;
}

/** Fuzzy matcher for SportsDataIO stat rows (`.Name`). Legacy path only. */
function findSdioPlayerStats(allStats: any[], playerName: string): any | null {
  if (!playerName || !allStats.length) return null;
  const target = playerName.toLowerCase().trim();
  const targetParts = target.split(' ').filter(Boolean);
  const targetFirst = targetParts[0] || '';
  const targetLast = targetParts[targetParts.length - 1] || '';

  const suffixes = ['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv'];
  const targetClean = targetParts.filter(p => !suffixes.includes(p)).join(' ');
  const targetLastClean = targetClean.split(' ').pop() || targetLast;

  let match = allStats.find(ps => (ps.Name || '').toLowerCase().trim() === target);
  if (match) return match;

  match = allStats.find(ps => {
    const name = (ps.Name || '').toLowerCase().trim();
    const parts = name.split(' ').filter((p: string) => !suffixes.includes(p));
    return parts.join(' ') === targetClean;
  });
  if (match) return match;

  match = allStats.find(ps => {
    const name = (ps.Name || '').toLowerCase().trim();
    const parts = name.split(' ').filter((p: string) => !suffixes.includes(p));
    const first = parts[0] || '';
    const last = parts[parts.length - 1] || '';
    return last === targetLastClean && first[0] === targetFirst[0];
  });
  if (match) return match;

  const lastMatches = allStats.filter(ps => {
    const parts = (ps.Name || '').toLowerCase().split(' ').filter((p: string) => !suffixes.includes(p));
    return (parts[parts.length - 1] || '') === targetLastClean;
  });
  if (lastMatches.length === 1) return lastMatches[0];

  console.log(`No stats found for: "${playerName}"`);
  return null;
}

// ═══════════════════════════════════════
// PREDICTION TIEBREAK — deterministic, documented
// ═══════════════════════════════════════
// A prop can carry more than one row in sbo_predictions (re-runs of the
// day engine, model revisions, opposing over/under calls). Previously the
// code took prop.sbo_predictions[0] straight off an UNORDERED PostgREST
// embed, so which pick graded the prop was whatever order Postgres
// happened to return — a coin flip on props with opposing picks.
//
// RULE (explicit, applies everywhere): MOST RECENT PREDICTION WINS.
//   1. Newest created_at wins — the latest model output supersedes
//      earlier ones; it is the pick the product surfaced last.
//   2. Ties on created_at (same-batch inserts) break on the larger id
//      (lexicographic on uuid text) — arbitrary but STABLE and repeatable.
// Rejected alternative: "prefer the row with a non-null verdict". That is
// self-referential — the verdict is written BY this grader, so it would
// make grading depend on prior grading runs and re-runs would not be
// reproducible. created_at is external to the grader, so it is stable.
function pickPrediction(prop: any): any | null {
  const preds = prop?.sbo_predictions;
  if (!Array.isArray(preds) || preds.length === 0) return null;
  if (preds.length === 1) return preds[0];
  return [...preds].sort((a, b) => {
    const ta = a?.created_at ? Date.parse(a.created_at) : 0;
    const tb = b?.created_at ? Date.parse(b.created_at) : 0;
    if (tb !== ta) return tb - ta;
    return String(b?.id ?? '').localeCompare(String(a?.id ?? ''));
  })[0];
}


// ═══════════════════════════════════════
// WRITE GATE — report_only support
// ═══════════════════════════════════════
// Every mutation goes through this. In report_only mode nothing is sent
// to the database; the intended write is recorded instead. Reads are
// always real, and control flow is IDENTICAL in both modes, so a dry run
// exercises the same matching / parsing / verdict code a live run would.
function makeWriter(
  supabase: any,
  reportOnly: boolean,
  sampleLimit = 50,
  sampleTables: string[] | null = null,
) {
  const counts: Record<string, number> = {};
  const samples: any[] = [];
  const record = (table: string, op: string, key: any, fields: any) => {
    const k = `${table}.${op}`;
    counts[k] = (counts[k] ?? 0) + 1;
    if (samples.length < sampleLimit && (!sampleTables || sampleTables.includes(table))) {
      samples.push({ table, op, key, fields });
    }
  };

  return {
    counts,
    samples,
    reportOnly,
    async updateBy(table: string, col: string, val: any, fields: any) {
      record(table, 'update', { [col]: val }, fields);
      if (reportOnly) return { error: null };
      return await supabase.from(table).update(fields).eq(col, val);
    },
    async upsert(table: string, row: any, opts: any) {
      record(table, 'upsert', { prediction_id: row?.prediction_id ?? null }, row);
      if (reportOnly) return { error: null };
      return await supabase.from(table).upsert(row, opts);
    },
    async insert(table: string, row: any) {
      record(table, 'insert', {}, row);
      if (reportOnly) return { error: null };
      return await supabase.from(table).insert(row);
    },
  };
}

type Counters = ReturnType<typeof newCounters>;

function newCounters() {
  return {
    days_checked: 0,
    espn_events: 0,
    espn_finals: 0,
    games_matched: 0,
    games_updated: 0,
    unmatched_finals: 0,
    props_seen: 0,
    props_graded: 0,
    props_correct: 0,
    props_incorrect: 0,
    props_push: 0,
    // Prop resolved against a real box score but no AI prediction was
    // attached, so there is no pick to score. NOT a push.
    props_resolved_no_pick: 0,
    props_pending_no_stats: 0,
    props_pending_unmapped: 0,
    game_id_backfilled: 0,
    backfill_orphans_scanned: 0,
    backfill_props_resolved: 0,
    backfill_update_errors: 0,
    errors: [] as string[],
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const body = await req.json().catch(() => ({}));
    const {
      game_id,
      prediction_id,
      force_yesterday,
      force_rerun = false,
      specific_date = null,
      report_only = false,
    } = body;

    // `mlb_days_back` kept as a backward-compatible alias for existing
    // callers/crons. New callers should send `days_back`.
    const daysBack = Math.max(0, Number(body.days_back ?? body.mlb_days_back ?? 1));

    // Which sports this run touches. Defaults to everything we can grade
    // (free-ESPN sports) plus every sport with a declared legacy source —
    // i.e. exactly the set the pre-refactor code handled.
    const ALL_SPORTS = [...new Set([...GRADED_SPORT_KEYS, ...Object.keys(LEGACY_SCORE_SOURCES)])];
    const requested: string[] | null = Array.isArray(body.sports) && body.sports.length
      ? body.sports.map((s: string) => String(s).toLowerCase())
      : null;
    const activeSports = requested ? ALL_SPORTS.filter(s => requested.includes(s)) : ALL_SPORTS;

    // Dry-run reporting affordances. `sample_limit` / `sample_tables` only
    // affect what the response echoes back; they never affect grading.
    const W = makeWriter(
      supabase,
      !!report_only,
      Math.min(Number(body.sample_limit ?? 50), 5000),
      Array.isArray(body.sample_tables) && body.sample_tables.length ? body.sample_tables : null,
    );


    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayET = yesterday.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const todayET = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    const etOffset = (() => {
      try {
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York', timeZoneName: 'shortOffset'
        }).formatToParts(now);
        const tz = parts.find(p => p.type === 'timeZoneName')?.value || '';
        return tz.includes('-4') ? '-04:00' : '-05:00';
      } catch { return '-05:00'; }
    })();

    let scoresUpdated = 0;

    // Per-sport counters replace the old single `mlb` object.
    const bySport: Record<string, Counters> = {};
    for (const s of activeSports) bySport[s] = newCounters();

    // sbo_games.id → ESPN eventId, per sport, for the prop resolver below.
    const eventMaps: Record<string, Map<string, string>> = {};
    for (const s of activeSports) eventMaps[s] = new Map<string, string>();

    const dateWindow = (dateStr: string) => ({
      start: `${dateStr}T00:00:00${etOffset}`,
      end: `${dateStr}T23:59:59${etOffset}`,
    });

    const datesBack = (): string[] => {
      if (specific_date) return [specific_date];
      const out: string[] = [];
      for (let i = daysBack; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        out.push(d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }));
      }
      return out;
    };

    // ═══════════════════════════════════════
    // PHASE 1 — LEGACY VENDOR SCORES (config-declared sports only)
    // ═══════════════════════════════════════
    const fetchLegacyScores = async (sportKey: string, dateStr: string): Promise<number> => {
      const src = getLegacyScoreSource(sportKey);
      if (!src) return 0;
      const apiKey = Deno.env.get(src.apiKeyEnv);
      if (!apiKey) return 0;

      const c = bySport[sportKey];
      let updated = 0;
      try {
        const res = await fetch(src.scoresUrl(dateStr, apiKey));
        if (!res.ok) { console.warn(`${src.provider} ${res.status} for ${dateStr}`); return 0; }
        const apiGames = await res.json();
        console.log(`${src.provider}: ${apiGames.length} ${sportKey} games for ${dateStr}`);

        const { start, end } = dateWindow(dateStr);

        // SCOPED: was unscoped, which allowed a team-abbrev collision to
        // match another sport's game on the same date.
        const { data: ourGames } = await supabase
          .from('sbo_games')
          .select('id, home_team, away_team, external_id')
          .eq('sport_key', sportKey)
          .gte('game_date', start)
          .lte('game_date', end);

        if (!ourGames?.length) return 0;

        for (const ag of apiGames) {
          if (ag.HomeTeamScore === null || ag.AwayTeamScore === null) continue;
          if (!['Final', 'F/OT', 'F/2OT', 'F/3OT', 'F'].includes(ag.Status)) continue;
          if (ag.HomeTeamScore < src.minScore || ag.AwayTeamScore < src.minScore) continue;

          const matched = ourGames.find((g: any) =>
            teamMatchesAbbrev(g.home_team, ag.HomeTeam) &&
            teamMatchesAbbrev(g.away_team, ag.AwayTeam)
          );

          if (matched) {
            const { error } = await W.updateBy('sbo_games', 'id', matched.id, {
              home_score: ag.HomeTeamScore,
              away_score: ag.AwayTeamScore,
              status: 'closed',
              winner: ag.HomeTeamScore > ag.AwayTeamScore ? matched.home_team : matched.away_team,
            });
            if (!error) {
              updated++; c.games_updated++; c.games_matched++;
              console.log(`Score: ${matched.home_team} ${ag.HomeTeamScore}-${ag.AwayTeamScore}`);
            }
          }
        }
      } catch (e: any) { console.warn(`Score fetch failed for ${dateStr}:`, e.message); }
      return updated;
    };

    for (const sportKey of activeSports) {
      if (!getLegacyScoreSource(sportKey)) continue;
      bySport[sportKey].days_checked += force_yesterday ? 3 : 2;
      if (force_yesterday) scoresUpdated += await fetchLegacyScores(sportKey, yesterdayET);
      scoresUpdated += await fetchLegacyScores(sportKey, yesterdayET);
      scoresUpdated += await fetchLegacyScores(sportKey, todayET);
    }

    // ═══════════════════════════════════════
    // PHASE 1B — SCORES VIA FREE ESPN SCOREBOARD (all graded sports)
    // ═══════════════════════════════════════
    const fetchEspnScores = async (
      config: SportGradingConfig<any>,
      dateStr: string,
    ): Promise<number> => {
      const sportKey = config.sportKey;
      const c = bySport[sportKey];
      c.days_checked++;
      let updated = 0;

      const sb = await fetchEspnFinals(config, dateStr);
      if (!sb.ok) {
        const msg = sb.error || `ESPN scoreboard failed for ${dateStr}`;
        c.errors.push(msg);
        console.error(msg);
        return 0;
      }
      c.espn_events += sb.totalEvents;
      c.espn_finals += sb.finals.length;

      const { start, end } = dateWindow(dateStr);

      const { data: ourGames } = await supabase
        .from('sbo_games')
        .select('id, home_team, away_team, status')
        .eq('sport_key', sportKey)
        .gte('game_date', start)
        .lte('game_date', end);

      const pending = (ourGames || []).filter(
        (g: any) => !['closed', 'completed', 'final'].includes(String(g.status))
      ).length;

      // Explicit error, NOT a clean zero: if we hold pending games for a day
      // and ESPN reports no completed events, that is a feed problem.
      if (sb.finals.length === 0 && pending > 0) {
        const msg = `ESPN returned 0 completed ${sportKey.toUpperCase()} events for ${dateStr} while ${pending} pending games are on our board — treating as feed error, not a clean zero`;
        c.errors.push(msg);
        console.error(msg);
        return 0;
      }

      if (!ourGames?.length) return 0;

      for (const f of sb.finals) {
        const matched = ourGames.find((g: any) =>
          teamMatches(config, g.home_team, f.homeName) &&
          teamMatches(config, g.away_team, f.awayName)
        );
        if (!matched) { c.unmatched_finals++; continue; }

        c.games_matched++;
        eventMaps[sportKey].set(matched.id, f.eventId);

        const { error } = await W.updateBy('sbo_games', 'id', matched.id, {
          home_score: f.homeScore,
          away_score: f.awayScore,
          status: 'closed',
          winner: f.homeScore > f.awayScore ? matched.home_team : matched.away_team,
        });

        if (!error) {
          updated++;
          c.games_updated++;
          console.log(`${sportKey.toUpperCase()} score: ${matched.away_team} ${f.awayScore} @ ${matched.home_team} ${f.homeScore}`);
        }
      }
      return updated;
    };

    const espnDates = datesBack();
    for (const sportKey of activeSports) {
      const config = getGradingConfig(sportKey);
      if (!config) continue;
      for (const d of espnDates) {
        scoresUpdated += await fetchEspnScores(config, d);
      }
    }

    // ═══════════════════════════════════════
    // PHASE 2 — VERIFY MONEYLINE PREDICTIONS
    // ═══════════════════════════════════════
    let gamesToVerify: any[] = [];
    if (game_id) {
      const { data } = await supabase.from('sbo_games').select('*').eq('id', game_id).single();
      if (data) gamesToVerify = [data];
    } else {
      // SCOPED: was unscoped across every sport_key in the table.
      const { data } = await supabase.from('sbo_games').select('*')
        .in('sport_key', activeSports)
        .in('status', ['closed', 'completed', 'final'])
        .not('home_score', 'is', null).not('away_score', 'is', null);
      gamesToVerify = data || [];
    }

    let verified = 0, correct = 0, incorrect = 0, pushes = 0;

    for (const game of gamesToVerify) {
      let predQuery = supabase.from('sbo_predictions').select('*').eq('game_id', game.id);
      if (!force_rerun) predQuery = predQuery.eq('verified', false);
      if (prediction_id) predQuery = predQuery.eq('id', prediction_id);

      const { data: predictions } = await predQuery;
      if (!predictions?.length) continue;

      const homeScore = game.home_score;
      const awayScore = game.away_score;
      if (homeScore === null || awayScore === null) continue;

      for (const pred of predictions) {
        let verdict: string;
        if (pred.prediction_type === 'moneyline') {
          const actualWinner = homeScore > awayScore ? 'home' : 'away';
          verdict = pred.predicted_outcome === actualWinner ? 'correct' : 'incorrect';
        } else continue;

        const actualWinnerTeam = homeScore > awayScore ? game.home_team : game.away_team;
        const winScore = Math.max(homeScore, awayScore);
        const loseScore = Math.min(homeScore, awayScore);
        const verdictNote = `${actualWinnerTeam} won ${winScore}-${loseScore}. Predicted: ${pred.predicted_outcome === 'home' ? game.home_team : game.away_team}. ${verdict === 'correct' ? '✅ CORRECT' : '❌ INCORRECT'}`;

        await W.upsert('sbo_results_verification', {
          prediction_id: pred.id, game_id: game.id, pick_type: 'game',
          our_pick: pred.predicted_outcome, our_confidence: pred.final_confidence,
          final_score_home: homeScore, final_score_away: awayScore,
          actual_result: `${game.home_team} ${homeScore} - ${game.away_team} ${awayScore}`,
          actual_winner: homeScore > awayScore ? 'home' : 'away',
          was_correct: verdict === 'correct', verdict, verdict_note: verdictNote,
          profit_loss: verdict === 'correct' ? 100 : -100,
          verified_at: new Date().toISOString(),
        }, { onConflict: 'prediction_id' });

        await W.updateBy('sbo_predictions', 'id', pred.id, {
          verified: true, verdict, was_correct: verdict === 'correct',
          actual_outcome: verdict, final_score_home: homeScore, final_score_away: awayScore,
          verified_at: new Date().toISOString(),
        });

        await W.updateBy('sbo_saved_picks', 'source_id', pred.id, {
          result: verdict === 'correct' ? 'won' : 'lost',
        });

        verified++;
        if (verdict === 'correct') correct++;
        else incorrect++;
      }
    }

    // ═══════════════════════════════════════
    // PHASE 3 — LEGACY VENDOR PROP GRADING
    // (config-declared sports only — this is the gap that made WNBA unsafe)
    // ═══════════════════════════════════════
    let propsVerified = 0, propsCorrect = 0, propsIncorrect = 0, propsPush = 0;
    let propsPending = 0;

    for (const sportKey of activeSports) {
      const src = getLegacyScoreSource(sportKey);
      if (!src) continue;
      const apiKey = Deno.env.get(src.apiKeyEnv);
      if (!apiKey) continue;

      const c = bySport[sportKey];
      const datesToCheck = specific_date ? [specific_date] : [yesterdayET, todayET];

      // Bulk player stats for this sport's vendor.
      let allPlayerStats: any[] = [];
      for (const dateStr of datesToCheck) {
        try {
          console.log(`Fetching bulk ${sportKey} player stats for ${dateStr}`);
          const res = await fetch(src.playerStatsUrl(dateStr, apiKey));
          if (res.ok) {
            const stats = await res.json();
            allPlayerStats = [...allPlayerStats, ...stats];
            console.log(`Got ${stats.length} player stat lines for ${dateStr}`);
          } else {
            console.warn(`playerStats ${res.status} for ${dateStr}`);
          }
        } catch (e: any) {
          console.warn(`Stats fetch failed for ${dateStr}:`, e.message);
        }
      }
      console.log(`Total ${sportKey} player stat lines: ${allPlayerStats.length}`);

      for (const targetDate of datesToCheck) {
        // SCOPED: this query previously had NO sport filter, so it pulled
        // every sport's props for the date and graded them with this
        // vendor's stat map. That is the WNBA/NBA contamination path.
        let propsQuery = supabase
          .from('sbo_player_props')
          .select(`
            *,
            sbo_predictions(
              id, created_at, predicted_outcome, final_confidence, verdict, verified
            )
          `)
          .eq('sport_key', sportKey)
          .eq('game_date', targetDate);

        if (!force_rerun) {
          propsQuery = propsQuery.or('verdict.is.null,verified.is.null,verified.eq.false');
        }

        const { data: propsToVerify } = await propsQuery;
        console.log(`${sportKey} props to verify for ${targetDate}: ${propsToVerify?.length || 0}`);

        if (!propsToVerify?.length) continue;

        for (const prop of propsToVerify) {
          try {
            const playerStat = findSdioPlayerStats(allPlayerStats, prop.player_name);
            if (!playerStat) { c.props_pending_no_stats++; propsPending++; continue; }

            const actualValue = getSdioPropValue(playerStat, prop.prop_type);
            if (actualValue === null) { c.props_pending_unmapped++; propsPending++; continue; }

            const line = parseFloat(String(prop.line));
            const actualNum = parseFloat(String(actualValue));

            if (isNaN(line) || isNaN(actualNum)) {
              console.warn(`Invalid line/actual for ${prop.player_name}: line=${prop.line} actual=${actualValue}`);
              c.props_pending_unmapped++;
              propsPending++;
              continue;
            }

            c.props_seen++;

            const epsilon = 0.001;
            const chosenPred = pickPrediction(prop);
            const aiPick = chosenPred?.predicted_outcome?.toLowerCase() || null;

            let predictionVerdict: string;
            if (Math.abs(actualNum - line) < epsilon) {
              predictionVerdict = 'push';
            } else if (actualNum > line + epsilon) {
              predictionVerdict = aiPick === 'over' ? 'correct' : (aiPick === 'under' ? 'incorrect' : 'over');
            } else {
              predictionVerdict = aiPick === 'under' ? 'correct' : (aiPick === 'over' ? 'incorrect' : 'under');
            }

            console.log(
              `VERIFY: ${prop.player_name} ${prop.prop_type} line=${line} actual=${actualNum} pick=${aiPick} → ${predictionVerdict}`
            );

            const propVerdictNote = `${prop.player_name} had ${actualNum} ${prop.prop_type} (line: ${line}). Pick: ${(aiPick || 'N/A').toUpperCase()}. ${predictionVerdict === 'correct' ? '✅ CORRECT' : predictionVerdict === 'push' ? '➖ PUSH' : '❌ INCORRECT'}`;

            await W.updateBy('sbo_player_props', 'id', prop.id, {
              actual_value: actualNum,
              verdict: predictionVerdict,
              verified: true,
              verified_at: new Date().toISOString(),
            });

            if (chosenPred?.id) {
              await W.updateBy('sbo_predictions', 'id', chosenPred.id, {
                verified: true, verdict: predictionVerdict,
                was_correct: predictionVerdict === 'correct',
                actual_outcome: predictionVerdict,
                verified_at: new Date().toISOString(),
              });

              await W.upsert('sbo_results_verification', {
                prediction_id: chosenPred.id,
                game_id: prop.game_id || null,
                pick_type: 'prop',
                our_pick: aiPick || 'unknown',
                our_confidence: chosenPred.final_confidence || null,
                actual_result: `${prop.player_name} ${prop.prop_type}: ${actualNum} (line was ${line})`,
                actual_value: actualNum,
                was_correct: predictionVerdict === 'correct',
                verdict: predictionVerdict,
                verdict_note: propVerdictNote,
                profit_loss: predictionVerdict === 'correct' ? 100 : predictionVerdict === 'push' ? 0 : -100,
                verified_at: new Date().toISOString(),
              }, { onConflict: 'prediction_id' });

              await W.updateBy('sbo_saved_picks', 'source_id', chosenPred.id, {
                result: predictionVerdict === 'correct' ? 'won' : predictionVerdict === 'push' ? 'push' : 'lost',
              });
            }

            c.props_graded++;
            propsVerified++;
            if (predictionVerdict === 'correct') { c.props_correct++; propsCorrect++; }
            else if (predictionVerdict === 'incorrect') { c.props_incorrect++; propsIncorrect++; }
            else if (predictionVerdict === 'push') { c.props_push++; propsPush++; }
            else { c.props_resolved_no_pick++; }

          } catch (e: any) {
            console.error(`Prop verify failed for ${prop.player_name}:`, e.message);
          }
        }
      }
    }

    // ═══════════════════════════════════════
    // PHASE 3B — PLAYER PROPS VIA FREE ESPN /summary (all graded sports)
    // ═══════════════════════════════════════

    // 3B.0 — backfill game_id on orphaned player_prop predictions.
    // Intentionally sport-agnostic: it only copies game_id from the prop
    // row it already points at, so it cannot cross sports.
    {
      const backfill = { scanned: 0, resolved: 0, updated: 0, errors: 0, msgs: [] as string[] };
      const orphans: any[] = [];
      for (let from = 0; ; from += 1000) {
        const { data: page, error: pageErr } = await supabase
          .from('sbo_predictions')
          .select('id, prop_id')
          .eq('prediction_type', 'player_prop')
          .is('game_id', null)
          .not('prop_id', 'is', null)
          .range(from, from + 999);
        if (pageErr) { backfill.msgs.push(`orphan scan failed: ${pageErr.message}`); break; }
        if (!page?.length) break;
        orphans.push(...page);
        if (page.length < 1000) break;
      }

      backfill.scanned = orphans.length;

      if (orphans.length) {
        const propIds = [...new Set(orphans.map((o: any) => o.prop_id))];

        // Chunk the .in() lookup — a single 1400-id filter overflows the
        // request URL and silently returns null.
        const gameByProp = new Map<string, string>();
        const CHUNK = 150;
        for (let i = 0; i < propIds.length; i += CHUNK) {
          const slice = propIds.slice(i, i + CHUNK);
          const { data: propRows, error: propErr } = await supabase
            .from('sbo_player_props')
            .select('id, game_id')
            .in('id', slice);
          if (propErr) {
            backfill.msgs.push(`prop lookup chunk ${i}-${i + slice.length} failed: ${propErr.message}`);
            continue;
          }
          for (const r of propRows || []) {
            if (r.game_id) gameByProp.set(r.id, r.game_id);
          }
        }
        backfill.resolved = gameByProp.size;

        for (const o of orphans) {
          const gid = gameByProp.get(o.prop_id);
          if (!gid) continue;
          const { error } = await W.updateBy('sbo_predictions', 'id', o.id, { game_id: gid });
          if (error) {
            backfill.errors++;
            if (backfill.msgs.length < 5) backfill.msgs.push(`backfill update failed: ${error.message}`);
          } else {
            backfill.updated++;
          }
        }
        console.log(`game_id backfill: ${backfill.updated}/${orphans.length} orphaned prop predictions linked`);
      }

      // Attribute to MLB's counters to preserve the existing response shape
      // (this scan has always been reported under `mlb`), falling back to
      // the first active sport when MLB is not in this run.
      const attrib = bySport['mlb'] ?? bySport[activeSports[0]];
      if (attrib) {
        attrib.backfill_orphans_scanned = backfill.scanned;
        attrib.backfill_props_resolved = backfill.resolved;
        attrib.game_id_backfilled = backfill.updated;
        attrib.backfill_update_errors = backfill.errors;
        attrib.errors.push(...backfill.msgs);
      }
    }

    // 3B.1 — grade props for every game we just closed out, per sport.
    for (const sportKey of activeSports) {
      const config = getGradingConfig(sportKey);
      if (!config) continue;
      const c = bySport[sportKey];

      for (const [gameId, eventId] of eventMaps[sportKey]) {
        let propsQuery = supabase
          .from('sbo_player_props')
          .select(`*, sbo_predictions(id, created_at, predicted_outcome, final_confidence, verdict, verified)`)
          .eq('sport_key', sportKey)
          .eq('game_id', gameId);
        if (!force_rerun) propsQuery = propsQuery.or('verified.is.null,verified.eq.false');

        const { data: sportProps } = await propsQuery;
        if (!sportProps?.length) continue;

        const summary = await fetchEspnSummary(config, eventId);
        if (!summary) {
          const msg = `ESPN summary unavailable for event ${eventId} — ${sportProps.length} ${sportKey.toUpperCase()} props left pending`;
          c.errors.push(msg);
          console.error(msg);
          propsPending += sportProps.length;
          continue;
        }

        const statLines = config.buildStatLines(summary);

        for (const prop of sportProps) {
          try {
            c.props_seen++;

            const ps = findEspnPlayerStats(statLines, prop.player_name);
            if (!ps) { c.props_pending_no_stats++; propsPending++; continue; }

            const actualValue = config.getPropValue(ps, prop.prop_type);
            if (actualValue === null) { c.props_pending_unmapped++; propsPending++; continue; }

            const line = parseFloat(String(prop.line));
            const actualNum = parseFloat(String(actualValue));
            if (isNaN(line) || isNaN(actualNum)) { c.props_pending_unmapped++; propsPending++; continue; }

            const epsilon = 0.001;
            const chosenPred = pickPrediction(prop);
            const aiPick = chosenPred?.predicted_outcome?.toLowerCase() || null;

            let predictionVerdict: string;
            if (Math.abs(actualNum - line) < epsilon) {
              predictionVerdict = 'push';
            } else if (actualNum > line + epsilon) {
              predictionVerdict = aiPick === 'over' ? 'correct' : (aiPick === 'under' ? 'incorrect' : 'over');
            } else {
              predictionVerdict = aiPick === 'under' ? 'correct' : (aiPick === 'over' ? 'incorrect' : 'under');
            }

            const propVerdictNote = `${prop.player_name} had ${actualNum} ${prop.prop_type} (line: ${line}). Pick: ${(aiPick || 'N/A').toUpperCase()}. ${predictionVerdict === 'correct' ? '✅ CORRECT' : predictionVerdict === 'push' ? '➖ PUSH' : '❌ INCORRECT'} [source: ESPN]`;

            console.log(`VERIFY ${sportKey.toUpperCase()}: ${prop.player_name} ${prop.prop_type} line=${line} actual=${actualNum} pick=${aiPick} → ${predictionVerdict}`);

            await W.updateBy('sbo_player_props', 'id', prop.id, {
              actual_value: actualNum,
              verdict: predictionVerdict,
              verified: true,
              verified_at: new Date().toISOString(),
            });

            if (chosenPred?.id) {
              const predId = chosenPred.id;
              await W.updateBy('sbo_predictions', 'id', predId, {
                verified: true, verdict: predictionVerdict,
                was_correct: predictionVerdict === 'correct',
                actual_outcome: predictionVerdict,
                verified_at: new Date().toISOString(),
              });

              await W.upsert('sbo_results_verification', {
                prediction_id: predId,
                game_id: prop.game_id || null,
                pick_type: 'prop',
                our_pick: aiPick || 'unknown',
                our_confidence: chosenPred.final_confidence || null,
                actual_result: `${prop.player_name} ${prop.prop_type}: ${actualNum} (line was ${line})`,
                actual_value: actualNum,
                was_correct: predictionVerdict === 'correct',
                verdict: predictionVerdict,
                verdict_note: propVerdictNote,
                profit_loss: predictionVerdict === 'correct' ? 100 : predictionVerdict === 'push' ? 0 : -100,
                verified_at: new Date().toISOString(),
              }, { onConflict: 'prediction_id' });

              await W.updateBy('sbo_saved_picks', 'source_id', predId, {
                result: predictionVerdict === 'correct' ? 'won' : predictionVerdict === 'push' ? 'push' : 'lost',
              });
            }

            c.props_graded++;
            propsVerified++;
            if (predictionVerdict === 'correct') { c.props_correct++; propsCorrect++; }
            else if (predictionVerdict === 'incorrect') { c.props_incorrect++; propsIncorrect++; }
            else if (predictionVerdict === 'push') { c.props_push++; propsPush++; }
            // 'over' / 'under' means the box score resolved but no AI pick was
            // attached — outcome recorded, nothing to score. Must not inflate
            // the push bucket or it corrupts accuracy reporting.
            else { c.props_resolved_no_pick++; }
          } catch (e: any) {
            console.error(`${sportKey} prop verify failed for ${prop.player_name}:`, e.message);
          }
        }
      }
    }

    verified += propsVerified;
    correct += propsCorrect;
    incorrect += propsIncorrect;
    pushes += propsPush;

    const propAccuracy = (propsCorrect + propsIncorrect) > 0
      ? Math.round((propsCorrect / (propsCorrect + propsIncorrect)) * 100)
      : 0;
    const accuracy = (correct + incorrect) > 0
      ? parseFloat(((correct / (correct + incorrect)) * 100).toFixed(1))
      : 0;

    console.log(`Games: ${correct - propsCorrect}W-${incorrect - propsIncorrect}L | Props: ${propsCorrect}W-${propsIncorrect}L (${propAccuracy}%) | Pending: ${propsPending}`);

    if (verified > 0) {
      await W.insert('sbo_run_log', {
        run_type: 'auto-verify',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        games_predicted: verified,
        status: 'completed',
      });
    }

    return new Response(JSON.stringify({
      verified, correct, incorrect, pushes, scores_updated: scoresUpdated, accuracy,
      // Surfaced for sbo-day-engine's required-step / warning-on-zero logic.
      records_synced: verified + scoresUpdated,
      props_verified: propsVerified, props_correct: propsCorrect, props_incorrect: propsIncorrect,
      props_accuracy: propAccuracy, props_pending: propsPending,
      overall_correct: correct, overall_incorrect: incorrect,
      overall_accuracy: accuracy,
      sports: activeSports,
      by_sport: bySport,
      // Backward-compatible alias — existing dashboards/log parsers read `mlb`.
      mlb: bySport['mlb'] ?? null,
      dry_run: !!report_only,
      would_write: report_only ? W.counts : undefined,
      sample_writes: report_only ? W.samples : undefined,
      message: verified === 0 && scoresUpdated === 0 ? 'No unverified games or props with final scores found' : undefined,
    }), {

      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Verify results error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
