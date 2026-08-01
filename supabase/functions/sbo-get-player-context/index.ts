import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getGradingConfig, type SportGradingConfig } from '../_shared/espnGrading.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ═══════════════════════════════════════════════════════════════
// STATS-BRAIN BRANCH (Stage 2c: MLB, Stage 3: WNBA)
// Real stats brain off sbo_player_game_stats / sbo_player_season_splits,
// driven entirely by the sport's grading config so the brain and the
// grader can never disagree. Legacy NBA path below is untouched.
// ═══════════════════════════════════════════════════════════════

function avg(vals: number[]): number | null {
  if (!vals.length) return null;
  return Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3));
}

function teamMatchesHint(team: string | null, hint: string): boolean {
  if (!team || !hint) return false;
  const t = team.toLowerCase();
  const h = hint.toLowerCase();
  if (h.includes(t) || t.includes(h)) return true;
  // last word of team name (e.g. "Dodgers") appearing in the matchup string
  const last = t.split(/\s+/).pop() || '';
  return last.length > 3 && h.includes(last);
}

async function handleStatsBrain(req_body: any, supabase: any, config: SportGradingConfig<any>) {
  const SPORT = config.sportKey;
  const SPORT_LABEL = SPORT.toUpperCase();
  const { player_name, player_id, team, prop_type, opponent, game_date } = req_body;
  const teamHint = [team, opponent].filter(Boolean).join(' ');

  // ── 1. Resolve player identity ────────────────────────────────
  let resolution: 'player_id' | 'name_team' | 'name_unique' | 'ambiguous' | 'no_match' = 'no_match';
  let split: any = null;

  if (player_id) {
    const { data } = await supabase
      .from('sbo_player_season_splits')
      .select('*')
      .eq('sport', SPORT)
      .eq('player_key', String(player_id))
      .maybeSingle();
    if (data) { split = data; resolution = 'player_id'; }
  }

  let candidates: any[] = [];
  if (!split && player_name) {
    const { data } = await supabase
      .from('sbo_player_season_splits')
      .select('*')
      .eq('sport', SPORT)
      .ilike('player_name', player_name.trim());
    candidates = data || [];
    if (candidates.length === 1) {
      split = candidates[0];
      resolution = 'name_unique';
    } else if (candidates.length > 1) {
      const narrowed = candidates.filter((c) => teamMatchesHint(c.team, teamHint));
      if (narrowed.length === 1) {
        split = narrowed[0];
        resolution = 'name_team';
      } else {
        resolution = 'ambiguous';
      }
    }
  }

  if (!split) {
    // Never guess. Ambiguous or unmatched → odds_only.
    console.log(`${SPORT_LABEL} context unresolved:`, { player_name, player_id, teamHint, resolution, candidates: candidates.length });
    return {
      success: true,
      sport: SPORT,
      data_quality: 'odds_only',
      resolution,
      context_text: `PLAYER: ${player_name} (${team || 'unknown team'})
No verified ${SPORT_LABEL} stat history could be resolved for this player (${resolution}). No statistical basis — treat as odds-only and cap confidence.`,
      raw: { season_split: null, recent_values: [], games_with_stat: 0 },
    };
  }

  // ── 2. Game log ───────────────────────────────────────────────
  const { data: games } = await supabase
    .from('sbo_player_game_stats')
    .select('game_date, opponent, is_home, stat_line')
    .eq('sport', SPORT)
    .eq('player_key', split.player_key)
    .order('game_date', { ascending: false })
    .limit(200);

  const rows = games || [];
  const getVal = (statLine: any) => config.getPropValue(statLine as any, prop_type || '');

  const allValues = rows.map((g: any) => getVal(g.stat_line)).filter((v: any) => v !== null && v !== undefined) as number[];
  const recentValues = rows.slice(0, 10).map((g: any) => getVal(g.stat_line)).filter((v: any) => v !== null) as number[];
  const vsOppRows = opponent
    ? rows.filter((g: any) => teamMatchesHint(g.opponent, opponent)).slice(0, 5)
    : [];
  const vsOppValues = vsOppRows.map((g: any) => getVal(g.stat_line)).filter((v: any) => v !== null) as number[];

  // ── 3. data_quality: per-player, per-prop-type sample size ────
  const n = allValues.length;
  const data_quality = n >= 5 ? 'full' : n >= 1 ? 'partial' : 'odds_only';

  const seasonAvgForProp = avg(allValues);
  const l5 = avg(allValues.slice(0, 5));
  const l10 = avg(allValues.slice(0, 10));

  const contextText = `
PLAYER: ${split.player_name} (${split.team}) — ${SPORT_LABEL}
IDENTITY: resolved via ${resolution} (player_key ${split.player_key})
SEASON (${split.season}): ${split.games_played} games played
SEASON AVERAGES (all tracked stats): ${JSON.stringify(split.season_averages ?? {})}
LAST 5 AVERAGES: ${JSON.stringify(split.last_5_averages ?? {})}
LAST 10 AVERAGES: ${JSON.stringify(split.last_10_averages ?? {})}
HOME AVERAGES: ${JSON.stringify(split.home_averages ?? {})}
AWAY AVERAGES: ${JSON.stringify(split.away_averages ?? {})}

PROP TYPE: ${prop_type || 'n/a'}
GAMES WITH THIS STAT RECORDED: ${n}
LAST ${recentValues.length} GAMES (${prop_type}): ${recentValues.join(', ') || 'none'}
SEASON AVERAGE FOR THIS PROP: ${seasonAvgForProp ?? 'N/A'}
L5 AVERAGE: ${l5 ?? 'N/A'} | L10 AVERAGE: ${l10 ?? 'N/A'}

VS ${opponent || 'opponent'} (${vsOppValues.length} games): ${vsOppValues.join(', ') || 'NO GAMES VS THIS OPPONENT YET'}
VS OPPONENT AVERAGE: ${avg(vsOppValues) ?? 'N/A'}

DATA QUALITY: ${data_quality} (n=${n} games with this stat)
${data_quality === 'odds_only' ? 'WARNING: no games with this stat recorded — no statistical basis.' : ''}
${data_quality === 'partial' ? 'CAUTION: small sample (1-4 games) — weight lightly.' : ''}
LAST GAME: ${split.last_game_date || 'unknown'} | REQUESTED GAME DATE: ${game_date || 'n/a'}
  `.trim();

  return {
    success: true,
    sport: SPORT,
    data_quality,
    resolution,
    context_text: contextText,
    raw: {
      season_split: split,
      player_key: split.player_key,
      games_with_stat: n,
      recent_values: recentValues,
      recent_avg: l10,
      l5_avg: l5,
      season_avg: seasonAvgForProp,
      vs_opp_values: vsOppValues,
      vs_opp_avg: avg(vsOppValues),
    },
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { player_name, team, game_date, prop_type, opponent } = body;
    const sport = String(body.sport || 'nba').toLowerCase();

    const supabaseMulti = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Sports with a real stats brain dispatch off their grading config.
    // Everything else falls through to the legacy NBA path below.
    const gradingConfig = getGradingConfig(sport);
    if (gradingConfig) {
      const result = await handleStatsBrain(body, supabaseMulti, gradingConfig);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ═══ NBA path below — unchanged ═══
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Season averages
    const { data: seasonStats } = await supabase
      .from('sbo_player_season_stats')
      .select('*')
      .ilike('player_name', `%${player_name}%`)
      .order('season', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 2. Last 10 game logs
    const { data: gameLogs } = await supabase
      .from('sbo_player_game_logs')
      .select('*')
      .ilike('player_name', `%${player_name}%`)
      .order('game_date', { ascending: false })
      .limit(10);

    // 3. vs this opponent this season
    const { data: vsOpponent } = await supabase
      .from('sbo_player_game_logs')
      .select('*')
      .ilike('player_name', `%${player_name}%`)
      .ilike('opponent', `%${opponent}%`)
      .order('game_date', { ascending: false })
      .limit(5);

    // 4. Injury status
    const { data: injury } = await supabase
      .from('sbo_injuries')
      .select('*')
      .ilike('player_name', `%${player_name}%`)
      .eq('is_active', true)
      .maybeSingle();

    // 5. Tonight's projection
    const { data: projection } = await supabase
      .from('sbo_player_projections')
      .select('*')
      .ilike('player_name', `%${player_name}%`)
      .eq('game_date', game_date)
      .maybeSingle();

    // 6. Opponent defensive stats
    const { data: oppDefense } = await supabase
      .from('sbo_team_stats')
      .select('*')
      .ilike('team_name', `%${opponent}%`)
      .order('season', { ascending: false })
      .limit(1)
      .maybeSingle();

    const propFieldMap: Record<string, string> = {
      points: 'points',
      assists: 'assists',
      rebounds: 'rebounds',
      threes: 'threes',
      steals: 'steals',
      blocks: 'blocks',
      turnovers: 'turnovers',
    };

    const propField = prop_type ? propFieldMap[prop_type] : null;

    const recentValues = gameLogs?.map(g => (g as any)[propField || 'points'] || 0) || [];
    const recentAvg = recentValues.length > 0
      ? (recentValues.reduce((a: number, b: number) => a + b, 0) / recentValues.length).toFixed(1)
      : null;

    const vsOppValues = vsOpponent?.map(g => (g as any)[propField || 'points'] || 0) || [];
    const vsOppAvg = vsOppValues.length > 0
      ? (vsOppValues.reduce((a: number, b: number) => a + b, 0) / vsOppValues.length).toFixed(1)
      : null;

    const contextText = `
PLAYER: ${player_name} (${team})
SEASON AVERAGES: ${seasonStats?.points_avg || 'N/A'} pts, ${seasonStats?.assists_avg || 'N/A'} ast, ${seasonStats?.rebounds_avg || 'N/A'} reb, ${seasonStats?.threes_avg || 'N/A'} 3pm in ${seasonStats?.games_played || 0} games
MINUTES/GAME: ${seasonStats?.minutes_per_game || 'N/A'}
USAGE RATE: ${seasonStats?.usage_rate || 'N/A'}%

LAST ${recentValues.length} GAMES (${prop_type || 'points'}): ${recentValues.join(', ')}
${prop_type ? `RECENT ${prop_type.toUpperCase()} AVERAGE: ${recentAvg}` : ''}

VS ${opponent} THIS SEASON (${vsOppValues.length} games): ${vsOppValues.join(', ')}
${vsOppValues.length > 0 ? `VS OPPONENT AVERAGE: ${vsOppAvg}` : 'NO GAMES VS THIS OPPONENT YET'}

INJURY STATUS: ${injury ? `${injury.status} — ${injury.injury_type} (${injury.notes || 'no notes'})` : 'Active, no injury reported'}

TONIGHT'S PROJECTION: ${projection ? `${projection.projected_points} pts, ${projection.projected_assists} ast, ${projection.projected_rebounds} reb in ${projection.projected_minutes} min` : 'No projection available'}

OPPONENT (${opponent}) DEFENSE:
- Opponent PPG allowed: ${oppDefense?.opponent_points_per_game || 'N/A'}
- Defensive rating: ${oppDefense?.defensive_rating || 'N/A'}
- Win/Loss: ${oppDefense?.wins || 0}-${oppDefense?.losses || 0}
    `.trim();

    return new Response(JSON.stringify({
      success: true,
      context_text: contextText,
      raw: {
        season_stats: seasonStats,
        last_10_games: gameLogs,
        vs_opponent: vsOpponent,
        injury,
        projection,
        opponent_defense: oppDefense,
        recent_avg: recentAvg,
        vs_opp_avg: vsOppAvg,
        recent_values: recentValues,
      },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
