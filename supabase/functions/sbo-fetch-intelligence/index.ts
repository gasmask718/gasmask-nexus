import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

const NAME_TO_ABBREV = new Map<string, string>();
for (const [abbr, name] of Object.entries(TEAM_ABBREV_MAP)) {
  NAME_TO_ABBREV.set(name, abbr);
  const parts = name.split(' ');
  NAME_TO_ABBREV.set(parts[parts.length - 1], abbr);
}

function findTeamData(teamFullName: string, dataMap: Map<string, any>): any | null {
  if (!teamFullName) return null;
  const name = teamFullName.toLowerCase().trim();
  const lastWord = name.split(' ').pop() || '';

  for (const [key, data] of dataMap) {
    // key might be abbreviation or full name
    const fullName = (TEAM_ABBREV_MAP[key] || key || '').toLowerCase();
    if (!fullName) continue;

    if (fullName === name) return data;
    if (lastWord.length > 3 && fullName.endsWith(lastWord)) return data;

    const ourWords = name.split(' ').filter(w => w.length > 3);
    const theirWords = fullName.split(' ').filter(w => w.length > 3);
    for (const word of ourWords) {
      if (theirWords.includes(word)) return data;
    }
  }
  return null;
}

// Try multiple season strings
async function fetchWithSeasonFallback(urlTemplate: string, apiKey: string): Promise<any[]> {
  for (const season of ['2026', '2025']) {
    try {
      const url = urlTemplate.replace('{SEASON}', season) + `?key=${apiKey}`;
      const res = await fetch(url);
      console.log(`Season ${season}: HTTP ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          console.log(`✅ Season ${season} works — ${data.length} items`);
          return data;
        }
      }
    } catch (e: any) {
      console.error(`Season ${season} error:`, e.message);
    }
  }
  return [];
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
    let processedCount = 0;

    // Fetch team season stats — TOTALS not per-game
    const teamStats = await fetchWithSeasonFallback(
      `${BASE}/stats/json/TeamSeasonStats/{SEASON}`, SPORTSDATAIO_KEY
    );
    if (teamStats.length > 0) {
      const sample = teamStats[0];
      console.log('TeamStats sample fields:', Object.keys(sample).filter(k => 
        ['Points', 'Games', 'Team', 'Name', 'Possessions', 'FieldGoalsAttemptedPerGame', 'PointsPerGame'].includes(k)
      ).join(', '));
      console.log('Sample Points:', sample.Points, 'Games:', sample.Games, 'PPG:', sample.Points && sample.Games ? (sample.Points / sample.Games).toFixed(1) : 'N/A');
    }

    // Fetch standings — has PointsPerGameFor/Against already calculated
    const standings = await fetchWithSeasonFallback(
      `${BASE}/scores/json/Standings/{SEASON}`, SPORTSDATAIO_KEY
    );

    // Fetch today's schedule for context
    let schedule: any[] = [];
    try {
      const schedRes = await fetch(`${BASE}/scores/json/GamesByDate/${today}?key=${SPORTSDATAIO_KEY}`);
      if (schedRes.ok) schedule = await schedRes.json();
    } catch { /* continue */ }

    // B2B detection
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    let yesterdayGames: any[] = [];
    try {
      const ydRes = await fetch(`${BASE}/scores/json/GamesByDate/${yesterday}?key=${SPORTSDATAIO_KEY}`);
      if (ydRes.ok) yesterdayGames = await ydRes.json();
    } catch { /* continue */ }

    const yesterdayTeams = new Set(
      yesterdayGames.flatMap((g: any) => [g.HomeTeam, g.AwayTeam])
    );

    // Build lookup maps by abbreviation (Key field)
    const teamStatsMap = new Map(teamStats.map((t: any) => [t.Team, t]));
    const standingsMap = new Map(standings.map((s: any) => [s.Key || s.Team, s]));

    // Update sbo_team_stats with REAL calculated per-game data
    for (const ts of teamStats) {
      const fullName = TEAM_ABBREV_MAP[ts.Team];
      if (!fullName) continue;
      
      const gamesPlayed = ts.Games || 82;
      const ppg = ts.Points ? +(ts.Points / gamesPlayed).toFixed(1) : 0;
      const oppPpg = ts.OpponentStat?.Points ? +(ts.OpponentStat.Points / gamesPlayed).toFixed(1) : 0;

      // Also get from standings for more accurate data
      const standing = standingsMap.get(ts.Team);
      const standPpg = standing?.PointsPerGameFor || ppg;
      const standOppPpg = standing?.PointsPerGameAgainst || oppPpg;

      await supabase
        .from('sbo_team_stats')
        .update({
          points_per_game: standPpg || ppg,
          opponent_points_per_game: standOppPpg || oppPpg,
          offensive_rating: standPpg || ppg,
          defensive_rating: standOppPpg || oppPpg,
          wins: standing?.Wins || ts.Wins || 0,
          losses: standing?.Losses || ts.Losses || 0,
          home_wins: standing?.HomeWins || 0,
          home_losses: standing?.HomeLosses || 0,
          away_wins: standing?.AwayWins || 0,
          away_losses: standing?.AwayLosses || 0,
          updated_at: new Date().toISOString(),
        })
        .ilike('team_name', `%${fullName.split(' ').pop()}%`);
    }

    console.log(`Updated sbo_team_stats for ${teamStats.length} teams`);

    // Build intelligence for each game
    for (const game of games) {
      const homeTeam = game.home_team;
      const awayTeam = game.away_team;

      const homeStats = findTeamData(homeTeam, teamStatsMap);
      const awayStats = findTeamData(awayTeam, teamStatsMap);
      const homeStanding = findTeamData(homeTeam, standingsMap);
      const awayStanding = findTeamData(awayTeam, standingsMap);

      const homeAbbr = NAME_TO_ABBREV.get(homeTeam) || homeTeam;
      const awayAbbr = NAME_TO_ABBREV.get(awayTeam) || awayTeam;
      const b2bHome = yesterdayTeams.has(homeAbbr);
      const b2bAway = yesterdayTeams.has(awayAbbr);

      // Calculate per-game stats from totals
      const homeGames = homeStats?.Games || 82;
      const awayGames = awayStats?.Games || 82;
      const homePPG = homeStanding?.PointsPerGameFor || (homeStats?.Points ? +(homeStats.Points / homeGames).toFixed(1) : null);
      const homeOppPPG = homeStanding?.PointsPerGameAgainst || (homeStats?.OpponentStat?.Points ? +(homeStats.OpponentStat.Points / homeGames).toFixed(1) : null);
      const awayPPG = awayStanding?.PointsPerGameFor || (awayStats?.Points ? +(awayStats.Points / awayGames).toFixed(1) : null);
      const awayOppPPG = awayStanding?.PointsPerGameAgainst || (awayStats?.OpponentStat?.Points ? +(awayStats.OpponentStat.Points / awayGames).toFixed(1) : null);
      const homePace = homeStats?.Possessions || (homeStats?.FieldGoalsAttempted ? +(homeStats.FieldGoalsAttempted / homeGames * 1.1).toFixed(1) : null);
      const awayPace = awayStats?.Possessions || (awayStats?.FieldGoalsAttempted ? +(awayStats.FieldGoalsAttempted / awayGames * 1.1).toFixed(1) : null);

      const intel = {
        game_id: String(game.id),
        injury_report: [],
        rest_days_home: b2bHome ? 0 : 1,
        rest_days_away: b2bAway ? 0 : 1,
        back_to_back_home: b2bHome,
        back_to_back_away: b2bAway,
        home_record_home: homeStanding ? `${homeStanding.HomeWins || 0}-${homeStanding.HomeLosses || 0}` : null,
        away_record_away: awayStanding ? `${awayStanding.AwayWins || 0}-${awayStanding.AwayLosses || 0}` : null,
        ats_record_home: null,
        ats_record_away: null,
        last_5_home: homeStanding ? { wins: homeStanding.LastTenWins, losses: homeStanding.LastTenLosses, streak: homeStanding.StreakDescription } : null,
        last_5_away: awayStanding ? { wins: awayStanding.LastTenWins, losses: awayStanding.LastTenLosses, streak: awayStanding.StreakDescription } : null,
        head_to_head: null,
        pace_home: homePace,
        pace_away: awayPace,
        offensive_rating_home: homePPG,
        defensive_rating_home: homeOppPPG,
        offensive_rating_away: awayPPG,
        defensive_rating_away: awayOppPPG,
      };

      console.log(`Intel for ${homeTeam}: PPG=${homePPG}, OppPPG=${homeOppPPG}, Record=${intel.home_record_home}`);
      console.log(`Intel for ${awayTeam}: PPG=${awayPPG}, OppPPG=${awayOppPPG}, Record=${intel.away_record_away}`);

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
      message: `Intelligence gathered for ${processedCount} games with real SportsDataIO stats`,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('Intelligence fetch error:', e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
