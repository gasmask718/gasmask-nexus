import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SPORTSDATAIO_KEY = Deno.env.get('SPORTSDATAIO_API_KEY');
    if (!SPORTSDATAIO_KEY) throw new Error('SPORTSDATAIO_API_KEY not configured');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const today = new Date().toISOString().split('T')[0];
    const { data: games } = await supabase
      .from('sbo_games')
      .select('*')
      .gte('commence_time', `${today}T00:00:00`)
      .lte('commence_time', `${today}T23:59:59`);

    if (!games?.length) {
      return new Response(JSON.stringify({ success: true, message: 'No games today', count: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const BASE = 'https://api.sportsdata.io/v3/nba';
    let intelCount = 0;

    // Fetch season standings for records
    let standings: any[] = [];
    try {
      const standRes = await fetch(`${BASE}/scores/json/Standings/2025?key=${SPORTSDATAIO_KEY}`);
      if (standRes.ok) standings = await standRes.json();
    } catch { /* continue without standings */ }

    // Fetch injuries
    let injuries: any[] = [];
    try {
      const injRes = await fetch(`${BASE}/scores/json/DfsSlatesByDate/${today}?key=${SPORTSDATAIO_KEY}`);
      // Fallback: try player game projections for injury info
    } catch { /* continue */ }

    // Fetch today's game schedule for rest day calculation
    let schedule: any[] = [];
    try {
      const schedRes = await fetch(`${BASE}/scores/json/GamesByDate/${today}?key=${SPORTSDATAIO_KEY}`);
      if (schedRes.ok) schedule = await schedRes.json();
    } catch { /* continue */ }

    // Fetch yesterday's games for back-to-back detection
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    let yesterdayGames: any[] = [];
    try {
      const ydRes = await fetch(`${BASE}/scores/json/GamesByDate/${yesterday}?key=${SPORTSDATAIO_KEY}`);
      if (ydRes.ok) yesterdayGames = await ydRes.json();
    } catch { /* continue */ }

    const yesterdayTeams = new Set(
      yesterdayGames.flatMap((g: any) => [g.HomeTeam, g.AwayTeam])
    );

    // Fetch team stats for pace/ratings
    let teamStats: any[] = [];
    try {
      const tsRes = await fetch(`${BASE}/stats/json/TeamSeasonStats/2025?key=${SPORTSDATAIO_KEY}`);
      if (tsRes.ok) teamStats = await tsRes.json();
    } catch { /* continue */ }

    const teamStatsMap = new Map(teamStats.map((t: any) => [t.Team, t]));

    for (const game of games) {
      const homeTeam = game.home_team;
      const awayTeam = game.away_team;

      // Find matching schedule entry
      const schedGame = schedule.find((s: any) =>
        s.HomeTeam === homeTeam || s.AwayTeam === awayTeam ||
        s.HomeTeamName?.includes(homeTeam) || s.AwayTeamName?.includes(awayTeam)
      );

      // Back-to-back detection
      const b2bHome = yesterdayTeams.has(homeTeam);
      const b2bAway = yesterdayTeams.has(awayTeam);

      // Team stats
      const homeStats = teamStatsMap.get(homeTeam);
      const awayStats = teamStatsMap.get(awayTeam);

      // Standing records
      const homeStanding = standings.find((s: any) => s.Team === homeTeam || s.Name?.includes(homeTeam));
      const awayStanding = standings.find((s: any) => s.Team === awayTeam || s.Name?.includes(awayTeam));

      const intel = {
        game_id: game.game_id,
        injury_report: schedGame?.InjuredPlayers || [],
        rest_days_home: b2bHome ? 0 : 1,
        rest_days_away: b2bAway ? 0 : 1,
        back_to_back_home: b2bHome,
        back_to_back_away: b2bAway,
        home_record_home: homeStanding ? `${homeStanding.HomeWins || 0}-${homeStanding.HomeLosses || 0}` : null,
        away_record_away: awayStanding ? `${awayStanding.AwayWins || 0}-${awayStanding.AwayLosses || 0}` : null,
        ats_record_home: null, // Would need a dedicated ATS data source
        ats_record_away: null,
        last_5_home: homeStanding ? { wins: homeStanding.LastTenWins, losses: homeStanding.LastTenLosses, streak: homeStanding.Streak } : null,
        last_5_away: awayStanding ? { wins: awayStanding.LastTenWins, losses: awayStanding.LastTenLosses, streak: awayStanding.Streak } : null,
        head_to_head: null, // Would need historical game lookup
        pace_home: homeStats?.Possessions || homeStats?.FieldGoalsAttemptedPerGame * 1.1 || null,
        pace_away: awayStats?.Possessions || awayStats?.FieldGoalsAttemptedPerGame * 1.1 || null,
        offensive_rating_home: homeStats?.PointsPerGame || null,
        defensive_rating_home: homeStats?.OpponentPointsPerGame || null,
        offensive_rating_away: awayStats?.PointsPerGame || null,
        defensive_rating_away: awayStats?.OpponentPointsPerGame || null,
      };

      // Upsert by game_id
      const { data: existing } = await supabase
        .from('sbo_game_intelligence')
        .select('id')
        .eq('game_id', game.game_id)
        .maybeSingle();

      if (existing) {
        await supabase.from('sbo_game_intelligence').update(intel).eq('id', existing.id);
      } else {
        await supabase.from('sbo_game_intelligence').insert(intel);
      }
      intelCount++;
    }

    return new Response(JSON.stringify({
      success: true,
      games_analyzed: intelCount,
      message: `Intelligence gathered for ${intelCount} games`,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('Intelligence fetch error:', e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
