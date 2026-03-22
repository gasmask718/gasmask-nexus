import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { player_name, team, game_date, prop_type, opponent } = await req.json();

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
