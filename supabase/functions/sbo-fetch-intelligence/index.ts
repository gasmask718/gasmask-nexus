import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map SportsDataIO abbreviations to full team names used in sbo_games
const TEAM_ABBREV_MAP: Record<string, string> = {
  ATL: 'Atlanta Hawks', BOS: 'Boston Celtics', BKN: 'Brooklyn Nets',
  CHA: 'Charlotte Hornets', CHI: 'Chicago Bulls', CLE: 'Cleveland Cavaliers',
  DAL: 'Dallas Mavericks', DEN: 'Denver Nuggets', DET: 'Detroit Pistons',
  GS: 'Golden State Warriors', GSW: 'Golden State Warriors',
  HOU: 'Houston Rockets', IND: 'Indiana Pacers',
  LAC: 'Los Angeles Clippers', LAL: 'Los Angeles Lakers',
  MEM: 'Memphis Grizzlies', MIA: 'Miami Heat', MIL: 'Milwaukee Bucks',
  MIN: 'Minnesota Timberwolves', NO: 'New Orleans Pelicans', NOP: 'New Orleans Pelicans',
  NY: 'New York Knicks', NYK: 'New York Knicks',
  OKC: 'Oklahoma City Thunder', ORL: 'Orlando Magic',
  PHI: 'Philadelphia 76ers', PHX: 'Phoenix Suns',
  POR: 'Portland Trail Blazers', SA: 'San Antonio Spurs', SAS: 'San Antonio Spurs',
  SAC: 'Sacramento Kings', TOR: 'Toronto Raptors',
  UTA: 'Utah Jazz', WAS: 'Washington Wizards',
};

// Reverse map: full name → abbreviation(s)
const NAME_TO_ABBREV = new Map<string, string>();
for (const [abbr, name] of Object.entries(TEAM_ABBREV_MAP)) {
  NAME_TO_ABBREV.set(name, abbr);
  // Also map by city or last word for fuzzy matching
  const parts = name.split(' ');
  NAME_TO_ABBREV.set(parts[parts.length - 1], abbr);
}

function findTeamStats(teamFullName: string, statsMap: Map<string, any>): any | null {
  if (!teamFullName) return null;

  const name = teamFullName.toLowerCase().trim();

  // Try every entry in the map
  for (const [abbr, stats] of statsMap) {
    const fullName = (TEAM_ABBREV_MAP[abbr] || '').toLowerCase();

    // Exact full name match
    if (fullName === name) return stats;

    // Last word match (Celtics, Lakers, Warriors etc)
    const lastWord = name.split(' ').pop() || '';
    if (fullName.endsWith(lastWord) && lastWord.length > 3) return stats;

    // Abbreviation in team name
    if (name.includes(abbr.toLowerCase())) return stats;

    // Any word in full name matches any word in our name
    const ourWords = name.split(' ').filter(w => w.length > 3);
    const theirWords = fullName.split(' ').filter(w => w.length > 3);
    for (const word of ourWords) {
      if (theirWords.includes(word)) return stats;
    }
  }

  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SPORTSDATAIO_KEY = Deno.env.get('SPORTSDATAIO_API_KEY');
    if (!SPORTSDATAIO_KEY) throw new Error('SPORTSDATAIO_API_KEY not configured');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const { data: games } = await supabase
      .from('sbo_games')
      .select('*')
      .gte('game_date', `${today}T00:00:00`)
      .lte('game_date', `${today}T23:59:59`);

    if (!games?.length) {
      return new Response(JSON.stringify({ success: true, message: 'No games today', count: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if intelligence already fetched for today's games
    const gameIds = games.map((g: any) => String(g.id)).filter(Boolean);
    const { count: intelCount } = await supabase
      .from('sbo_game_intelligence')
      .select('*', { count: 'exact', head: true })
      .in('game_id', gameIds);

    if (intelCount && intelCount >= games.length) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Intelligence already fetched for all games today',
        games_analyzed: intelCount,
        source: 'cache',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const BASE = 'https://api.sportsdata.io/v3/nba';
    const SEASON = '2025';
    let processedCount = 0;

    // Fetch team season stats — primary source for ORtg/DRtg
    let teamStats: any[] = [];
    try {
      const tsRes = await fetch(`${BASE}/stats/json/TeamSeasonStats/${SEASON}?key=${SPORTSDATAIO_KEY}`);
      console.log('TeamSeasonStats status:', tsRes.status);
      if (tsRes.ok) {
        teamStats = await tsRes.json();
        console.log('TeamSeasonStats count:', teamStats.length, 'Sample:', teamStats[0]?.Team, teamStats[0]?.PointsPerGame);
      } else {
        console.error('TeamSeasonStats failed:', tsRes.status, await tsRes.text().catch(() => ''));
      }
    } catch (e) { console.error('TeamSeasonStats error:', e); }

    // Fetch standings for records, streaks, last 10
    let standings: any[] = [];
    try {
      const standRes = await fetch(`${BASE}/scores/json/Standings/${SEASON}?key=${SPORTSDATAIO_KEY}`);
      console.log('Standings status:', standRes.status);
      if (standRes.ok) {
        standings = await standRes.json();
        console.log('Standings count:', standings.length);
      }
    } catch (e) { console.error('Standings error:', e); }

    // Fetch today's schedule
    let schedule: any[] = [];
    try {
      const schedRes = await fetch(`${BASE}/scores/json/GamesByDate/${today}?key=${SPORTSDATAIO_KEY}`);
      console.log('Schedule status:', schedRes.status);
      if (schedRes.ok) schedule = await schedRes.json();
    } catch { /* continue */ }

    // Fetch yesterday's games for B2B detection
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    let yesterdayGames: any[] = [];
    try {
      const ydRes = await fetch(`${BASE}/scores/json/GamesByDate/${yesterday}?key=${SPORTSDATAIO_KEY}`);
      if (ydRes.ok) yesterdayGames = await ydRes.json();
    } catch { /* continue */ }

    // Fetch injuries
    let injuries: any[] = [];
    try {
      const injRes = await fetch(`${BASE}/scores/json/PlayerInjuries?key=${SPORTSDATAIO_KEY}`);
      console.log('Injuries status:', injRes.status);
      if (injRes.ok) injuries = await injRes.json();
    } catch { /* continue */ }

    const yesterdayTeams = new Set(
      yesterdayGames.flatMap((g: any) => [g.HomeTeam, g.AwayTeam])
    );

    // Build lookup maps by abbreviation
    const teamStatsMap = new Map(teamStats.map((t: any) => [t.Team, t]));
    const standingsMap = new Map(standings.map((s: any) => [s.Team, s]));

    // Also update sbo_team_stats with real data from SportsDataIO
    for (const ts of teamStats) {
      const fullName = TEAM_ABBREV_MAP[ts.Team];
      if (!fullName) continue;
      await supabase
        .from('sbo_team_stats')
        .update({
          points_per_game: ts.PointsPerGame || 0,
          opponent_points_per_game: ts.OpponentPointsPerGame || 0,
          offensive_rating: ts.PointsPerGame || 0,
          defensive_rating: ts.OpponentPointsPerGame || 0,
          wins: ts.Wins || 0,
          losses: ts.Losses || 0,
          updated_at: new Date().toISOString(),
        })
        .ilike('team_name', `%${fullName.split(' ').pop()}%`);
    }

    // Build intelligence for each game
    for (const game of games) {
      const homeTeam = game.home_team;
      const awayTeam = game.away_team;

      const homeStats = findTeamStats(homeTeam, teamStatsMap);
      const awayStats = findTeamStats(awayTeam, teamStatsMap);
      const homeStanding = findTeamStats(homeTeam, standingsMap);
      const awayStanding = findTeamStats(awayTeam, standingsMap);

      // Get abbreviations for B2B check
      const homeAbbr = NAME_TO_ABBREV.get(homeTeam) || homeTeam;
      const awayAbbr = NAME_TO_ABBREV.get(awayTeam) || awayTeam;
      const b2bHome = yesterdayTeams.has(homeAbbr);
      const b2bAway = yesterdayTeams.has(awayAbbr);

      // Filter injuries for these teams
      const homeInjuries = injuries.filter((i: any) =>
        i.Team === homeAbbr || TEAM_ABBREV_MAP[i.Team] === homeTeam
      ).map((i: any) => ({
        player: i.Name || i.PlayerID,
        status: i.Status,
        injury: i.BodyPart || i.Type,
      }));

      const awayInjuries = injuries.filter((i: any) =>
        i.Team === awayAbbr || TEAM_ABBREV_MAP[i.Team] === awayTeam
      ).map((i: any) => ({
        player: i.Name || i.PlayerID,
        status: i.Status,
        injury: i.BodyPart || i.Type,
      }));

      const intel = {
        game_id: String(game.id),
        injury_report: [...homeInjuries, ...awayInjuries],
        rest_days_home: b2bHome ? 0 : 1,
        rest_days_away: b2bAway ? 0 : 1,
        back_to_back_home: b2bHome,
        back_to_back_away: b2bAway,
        home_record_home: homeStanding ? `${homeStanding.HomeWins || 0}-${homeStanding.HomeLosses || 0}` : null,
        away_record_away: awayStanding ? `${awayStanding.AwayWins || 0}-${awayStanding.AwayLosses || 0}` : null,
        ats_record_home: null,
        ats_record_away: null,
        last_5_home: homeStanding ? { wins: homeStanding.LastTenWins, losses: homeStanding.LastTenLosses, streak: homeStanding.Streak } : null,
        last_5_away: awayStanding ? { wins: awayStanding.LastTenWins, losses: awayStanding.LastTenLosses, streak: awayStanding.Streak } : null,
        head_to_head: null,
        pace_home: homeStats?.Possessions || (homeStats?.FieldGoalsAttemptedPerGame ? homeStats.FieldGoalsAttemptedPerGame * 1.1 : null),
        pace_away: awayStats?.Possessions || (awayStats?.FieldGoalsAttemptedPerGame ? awayStats.FieldGoalsAttemptedPerGame * 1.1 : null),
        offensive_rating_home: homeStats?.PointsPerGame || null,
        defensive_rating_home: homeStats?.OpponentPointsPerGame || null,
        offensive_rating_away: awayStats?.PointsPerGame || null,
        defensive_rating_away: awayStats?.OpponentPointsPerGame || null,
      };

      console.log(`Intel for ${homeTeam} vs ${awayTeam}: ORtg=${intel.offensive_rating_home}, DRtg=${intel.defensive_rating_home}`);

      // Upsert by game_id
      const { data: existing } = await supabase
        .from('sbo_game_intelligence')
        .select('id')
        .eq('game_id', String(game.id))
        .maybeSingle();

      if (existing) {
        await supabase.from('sbo_game_intelligence').update(intel).eq('id', existing.id);
      } else {
        await supabase.from('sbo_game_intelligence').insert(intel);
      }
      processedCount++;
    }

    return new Response(JSON.stringify({
      success: true,
      games_analyzed: processedCount,
      team_stats_updated: teamStats.length,
      standings_loaded: standings.length,
      injuries_loaded: injuries.length,
      message: `Intelligence gathered for ${processedCount} games`,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('Intelligence fetch error:', e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
