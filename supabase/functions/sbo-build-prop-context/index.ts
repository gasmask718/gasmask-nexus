import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const PROP_FIELD_MAP: Record<string, string> = {
  points: 'points', pts: 'points',
  assists: 'assists', ast: 'assists',
  rebounds: 'rebounds', reb: 'rebounds',
  threes: 'threes', '3pm': 'threes', 'three pointers made': 'threes',
  steals: 'steals', stl: 'steals',
  blocks: 'blocks', blk: 'blocks',
  turnovers: 'turnovers', tov: 'turnovers',
  'pts+reb+ast': 'pra', pra: 'pra',
  'pts+reb': 'pts_reb', 'pts+ast': 'pts_ast', 'reb+ast': 'reb_ast',
};

const SEASON_AVG_MAP: Record<string, string> = {
  points: 'points_avg', assists: 'assists_avg', rebounds: 'rebounds_avg',
  threes: 'threes_avg', steals: 'steals_avg', blocks: 'blocks_avg',
  turnovers: 'turnovers_avg',
};

function getStatFromLog(log: any, field: string): number {
  if (field === 'pra') return (log.points || 0) + (log.rebounds || 0) + (log.assists || 0);
  if (field === 'pts_reb') return (log.points || 0) + (log.rebounds || 0);
  if (field === 'pts_ast') return (log.points || 0) + (log.assists || 0);
  if (field === 'reb_ast') return (log.rebounds || 0) + (log.assists || 0);
  return log[field] || 0;
}

function calcAvg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function calcVariance(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json().catch(() => ({}));
    const gameDate = body.game_date || new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    // Get all props for today
    const { data: props, error: propsError } = await supabase
      .from('sbo_player_props')
      .select('id, player_name, team, prop_type, line, game_date, game_id')
      .eq('game_date', gameDate);

    if (propsError) throw new Error(`Failed to fetch props: ${propsError.message}`);
    if (!props || props.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No props found for today', enriched: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`Building stat context for ${props.length} props on ${gameDate}`);

    // Batch fetch all unique players' game logs
    const uniquePlayers = [...new Set(props.map(p => p.player_name))];
    
    // Fetch game logs for all players (last 15 games each)
    const allGameLogs: Record<string, any[]> = {};
    for (let i = 0; i < uniquePlayers.length; i += 10) {
      const batch = uniquePlayers.slice(i, i + 10);
      for (const playerName of batch) {
        const { data: logs } = await supabase
          .from('sbo_player_game_logs')
          .select('*')
          .ilike('player_name', `%${playerName}%`)
          .order('game_date', { ascending: false })
          .limit(15);
        allGameLogs[playerName] = logs || [];
      }
    }

    // Fetch all season stats
    const { data: allSeasonStats } = await supabase
      .from('sbo_player_season_stats')
      .select('*')
      .order('season', { ascending: false });

    const seasonStatsMap = new Map<string, any>();
    for (const s of (allSeasonStats || [])) {
      const key = s.player_name.toLowerCase();
      if (!seasonStatsMap.has(key)) seasonStatsMap.set(key, s);
    }

    // Fetch all team stats
    const { data: allTeamStats } = await supabase
      .from('sbo_team_stats')
      .select('*')
      .order('season', { ascending: false });

    const teamStatsMap = new Map<string, any>();
    for (const t of (allTeamStats || [])) {
      const key = t.team_name.toLowerCase();
      if (!teamStatsMap.has(key)) teamStatsMap.set(key, t);
    }

    // Fetch games to get opponent info
    const gameIds = [...new Set(props.filter(p => p.game_id).map(p => p.game_id))];
    const gamesMap = new Map<string, any>();
    if (gameIds.length > 0) {
      const { data: games } = await supabase
        .from('sbo_games')
        .select('id, home_team, away_team')
        .in('id', gameIds);
      for (const g of (games || [])) gamesMap.set(g.id, g);
    }

    // Fetch injuries
    const { data: injuries } = await supabase
      .from('sbo_injuries')
      .select('player_name, status, injury_type')
      .eq('is_active', true);
    const injuryMap = new Map<string, any>();
    for (const inj of (injuries || [])) {
      injuryMap.set(inj.player_name.toLowerCase(), inj);
    }

    // Fetch projections
    const { data: projections } = await supabase
      .from('sbo_player_projections')
      .select('*')
      .eq('game_date', gameDate);
    const projMap = new Map<string, any>();
    for (const proj of (projections || [])) {
      projMap.set(proj.player_name.toLowerCase(), proj);
    }

    // Build context for each prop
    const contexts: any[] = [];
    let enriched = 0;
    let partial = 0;

    for (const prop of props) {
      const propTypeNorm = (prop.prop_type || 'points').toLowerCase().replace(/[_\s]+/g, ' ').trim();
      const statField = PROP_FIELD_MAP[propTypeNorm] || 'points';
      const playerKey = prop.player_name.toLowerCase();
      
      const gameLogs = allGameLogs[prop.player_name] || [];
      const seasonStats = seasonStatsMap.get(playerKey);
      const injury = injuryMap.get(playerKey);
      const projection = projMap.get(playerKey);

      // Determine opponent
      let opponentTeam: string | null = null;
      if (prop.game_id && gamesMap.has(prop.game_id)) {
        const game = gamesMap.get(prop.game_id);
        opponentTeam = game.home_team === prop.team ? game.away_team : game.home_team;
      }

      // Compute stat values from game logs
      const allValues = gameLogs.map((g: any) => getStatFromLog(g, statField));
      const last5Values = allValues.slice(0, 5);
      const last10Values = allValues.slice(0, 10);

      // vs opponent
      const vsOpponentLogs = opponentTeam
        ? gameLogs.filter((g: any) => g.opponent && g.opponent.toLowerCase().includes(opponentTeam!.toLowerCase().split(' ').pop()!))
        : [];
      const vsOpponentValues = vsOpponentLogs.map((g: any) => getStatFromLog(g, statField));

      // Season avg from season stats table
      const seasonAvgField = SEASON_AVG_MAP[statField];
      let seasonAvg: number | null = seasonAvgField && seasonStats ? seasonStats[seasonAvgField] : null;
      // For combo stats, compute from individual season avgs
      if (!seasonAvg && seasonStats) {
        if (statField === 'pra') seasonAvg = (seasonStats.points_avg || 0) + (seasonStats.rebounds_avg || 0) + (seasonStats.assists_avg || 0);
        if (statField === 'pts_reb') seasonAvg = (seasonStats.points_avg || 0) + (seasonStats.rebounds_avg || 0);
        if (statField === 'pts_ast') seasonAvg = (seasonStats.points_avg || 0) + (seasonStats.assists_avg || 0);
        if (statField === 'reb_ast') seasonAvg = (seasonStats.rebounds_avg || 0) + (seasonStats.assists_avg || 0);
      }

      // Opponent defensive stats
      const oppStats = opponentTeam ? teamStatsMap.get(opponentTeam.toLowerCase()) : null;
      // Find by partial match if exact fails
      let oppDefRating: number | null = oppStats?.defensive_rating || null;
      let oppPpgAllowed: number | null = oppStats?.opponent_points_per_game || null;
      let teamPace: number | null = null;

      // Get player's team pace
      const playerTeamStats = teamStatsMap.get((prop.team || '').toLowerCase());
      teamPace = playerTeamStats?.pace || null;

      // Projection value
      let projectionValue: number | null = null;
      if (projection) {
        if (statField === 'points') projectionValue = projection.projected_points;
        else if (statField === 'assists') projectionValue = projection.projected_assists;
        else if (statField === 'rebounds') projectionValue = projection.projected_rebounds;
      }

      const last5Avg = calcAvg(last5Values);
      const last10Avg = calcAvg(last10Values);
      const vsOppAvg = calcAvg(vsOpponentValues);
      const variance = calcVariance(allValues);

      // Edge vs line
      const bestEstimate = last5Avg || last10Avg || seasonAvg;
      const edgeVsLine = bestEstimate != null ? bestEstimate - prop.line : null;

      // Data quality
      const hasSeasonAvg = seasonAvg != null;
      const hasRecent = last5Values.length >= 3;
      const hasMatchup = vsOpponentValues.length > 0;
      const dataQuality = hasSeasonAvg && hasRecent && hasMatchup ? 'full'
        : hasSeasonAvg && hasRecent ? 'good'
        : hasSeasonAvg || hasRecent ? 'partial'
        : 'minimal';

      if (dataQuality === 'full' || dataQuality === 'good') enriched++;
      else partial++;

      contexts.push({
        prop_id: prop.id,
        player_name: prop.player_name,
        stat_type: prop.prop_type,
        line_value: prop.line,
        season_avg: seasonAvg,
        last_5_avg: last5Avg,
        last_10_avg: last10Avg,
        vs_opponent_avg: vsOppAvg,
        vs_opponent_games: vsOpponentValues.length,
        opponent_team: opponentTeam,
        opponent_def_rating: oppDefRating,
        opponent_ppg_allowed: oppPpgAllowed,
        team_pace: teamPace,
        minutes_avg: seasonStats?.minutes_per_game || null,
        usage_rate: seasonStats?.usage_rate || null,
        variance_score: variance,
        injury_status: injury ? `${injury.status} - ${injury.injury_type}` : null,
        projection_value: projectionValue,
        edge_vs_line: edgeVsLine,
        data_quality: dataQuality,
        last_5_values: last5Values,
        last_10_values: last10Values,
        vs_opponent_values: vsOpponentValues,
        game_date: gameDate,
        updated_at: new Date().toISOString(),
      });
    }

    // Upsert all contexts
    if (contexts.length > 0) {
      for (let i = 0; i < contexts.length; i += 50) {
        const batch = contexts.slice(i, i + 50);
        const { error: upsertError } = await supabase
          .from('sbo_prop_stat_context')
          .upsert(batch, { onConflict: 'prop_id' });
        if (upsertError) console.error(`Batch upsert error:`, upsertError.message);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total_props: props.length,
      enriched,
      partial,
      game_date: gameDate,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('Error:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
