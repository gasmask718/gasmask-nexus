import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const PROP_MARKETS = [
  'player_points', 'player_rebounds', 'player_assists', 'player_threes',
  'player_blocks', 'player_steals', 'player_turnovers',
  'player_points_rebounds_assists', 'player_points_rebounds',
  'player_points_assists', 'player_rebounds_assists',
];

const MARKET_TO_PROP_TYPE: Record<string, string> = {
  player_points: 'points', player_rebounds: 'rebounds', player_assists: 'assists',
  player_threes: 'threes', player_blocks: 'blocks', player_steals: 'steals',
  player_turnovers: 'turnovers', player_points_rebounds_assists: 'pts_reb_ast',
  player_points_rebounds: 'pts_reb', player_points_assists: 'pts_ast',
  player_rebounds_assists: 'reb_ast',
};

const BOOKMAKER_SOURCE: Record<string, string> = {
  bovada: 'bovada', betonlineag: 'bovada', draftkings: 'draftkings',
  fanduel: 'fanduel', betmgm: 'betmgm', williamhill_us: 'caesars',
  pointsbetus: 'pointsbet', betrivers: 'betrivers',
  mybookieag: 'mybookie', betus: 'betus',
};

const TEAM_ABBREV_MAP: Record<string, string[]> = {
  'ATL': ['Atlanta Hawks', 'Hawks'], 'BOS': ['Boston Celtics', 'Celtics'],
  'BKN': ['Brooklyn Nets', 'Nets'], 'CHA': ['Charlotte Hornets', 'Hornets'],
  'CHI': ['Chicago Bulls', 'Bulls'], 'CLE': ['Cleveland Cavaliers', 'Cavaliers', 'Cavs'],
  'DAL': ['Dallas Mavericks', 'Mavericks', 'Mavs'], 'DEN': ['Denver Nuggets', 'Nuggets'],
  'DET': ['Detroit Pistons', 'Pistons'], 'GSW': ['Golden State Warriors', 'Warriors'],
  'HOU': ['Houston Rockets', 'Rockets'], 'IND': ['Indiana Pacers', 'Pacers'],
  'LAC': ['Los Angeles Clippers', 'LA Clippers', 'Clippers'],
  'LAL': ['Los Angeles Lakers', 'LA Lakers', 'Lakers'],
  'MEM': ['Memphis Grizzlies', 'Grizzlies'], 'MIA': ['Miami Heat', 'Heat'],
  'MIL': ['Milwaukee Bucks', 'Bucks'], 'MIN': ['Minnesota Timberwolves', 'Timberwolves', 'Wolves'],
  'NOP': ['New Orleans Pelicans', 'Pelicans'], 'NYK': ['New York Knicks', 'Knicks'],
  'OKC': ['Oklahoma City Thunder', 'Thunder'], 'ORL': ['Orlando Magic', 'Magic'],
  'PHI': ['Philadelphia 76ers', '76ers', 'Sixers'], 'PHX': ['Phoenix Suns', 'Suns'],
  'POR': ['Portland Trail Blazers', 'Trail Blazers', 'Blazers'],
  'SAC': ['Sacramento Kings', 'Kings'], 'SAS': ['San Antonio Spurs', 'Spurs'],
  'TOR': ['Toronto Raptors', 'Raptors'], 'UTA': ['Utah Jazz', 'Jazz'],
  'WAS': ['Washington Wizards', 'Wizards'],
};

function findTeamAbbrev(teamName: string): string | null {
  const lower = teamName.toLowerCase();
  for (const [abbrev, names] of Object.entries(TEAM_ABBREV_MAP)) {
    if (names.some(n => lower.includes(n.toLowerCase()))) return abbrev;
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const ODDS_API_KEY = Deno.env.get('ODDS_API_KEY');
    if (!ODDS_API_KEY) throw new Error('ODDS_API_KEY not configured');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json().catch(() => ({}));
    const sport = body.sport || 'basketball_nba';
    const targetBooks = body.bookmakers || 'bovada,betonlineag,draftkings,fanduel,betmgm';

    const todayEST = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    console.log(`📊 Ingesting book props for ${sport} on ${todayEST}`);

    // Get today's games for matching
    const { data: todayGames } = await supabase
      .from('sbo_games')
      .select('id, home_team, away_team, game_date')
      .gte('game_date', todayEST + 'T00:00:00')
      .lte('game_date', todayEST + 'T23:59:59');

    const errors: string[] = [];
    const allRows: any[] = [];
    const bookStats: Record<string, number> = {};

    // Fetch events
    const eventsRes = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sport}/events?apiKey=${ODDS_API_KEY}&dateFormat=iso`
    );
    if (!eventsRes.ok) throw new Error(`Events API error: ${eventsRes.status}`);
    const events = await eventsRes.json();

    // Filter to today's events only
    const todayEvents = events.filter((e: any) => e.commence_time?.startsWith(todayEST));
    console.log(`Found ${todayEvents.length} today events out of ${events.length} total`);

    // Process events — limit to 6 to stay within timeout
    const eventsToProcess = todayEvents.slice(0, 6);

    for (const event of eventsToProcess) {
      const marketsParam = PROP_MARKETS.slice(0, 4).join(','); // points, rebounds, assists, threes
      const propsUrl = `https://api.the-odds-api.com/v4/sports/${sport}/events/${event.id}/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=${marketsParam}&bookmakers=${targetBooks}&oddsFormat=american`;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const propsRes = await fetch(propsUrl, { signal: controller.signal });
        clearTimeout(timeout);

        if (!propsRes.ok) {
          errors.push(`Event ${event.id}: HTTP ${propsRes.status}`);
          continue;
        }

        const propsData = await propsRes.json();

        // Match to SBO game
        const matchingGame = todayGames?.find(g => {
          const homeMatch = g.home_team?.toLowerCase().includes(event.home_team?.split(' ').pop()?.toLowerCase()) ||
            event.home_team?.toLowerCase().includes(g.home_team?.split(' ').pop()?.toLowerCase());
          const awayMatch = g.away_team?.toLowerCase().includes(event.away_team?.split(' ').pop()?.toLowerCase()) ||
            event.away_team?.toLowerCase().includes(g.away_team?.split(' ').pop()?.toLowerCase());
          return homeMatch && awayMatch;
        });

        for (const bookmaker of propsData.bookmakers || []) {
          const sourceLabel = BOOKMAKER_SOURCE[bookmaker.key] || bookmaker.key;

          for (const market of bookmaker.markets || []) {
            const propType = MARKET_TO_PROP_TYPE[market.key];
            if (!propType) continue;

            // Group by player
            const players: Record<string, { over?: any; under?: any; line?: number }> = {};
            for (const outcome of market.outcomes || []) {
              const name = outcome.description;
              if (!name) continue;
              if (!players[name]) players[name] = {};
              if (outcome.name === 'Over') {
                players[name].over = outcome;
                players[name].line = outcome.point;
              } else if (outcome.name === 'Under') {
                players[name].under = outcome;
                if (!players[name].line) players[name].line = outcome.point;
              }
            }

            for (const [playerName, data] of Object.entries(players)) {
              if (!data.line) continue;
              const team = findTeamAbbrev(event.home_team) || findTeamAbbrev(event.away_team) || '';
              bookStats[sourceLabel] = (bookStats[sourceLabel] || 0) + 1;

              allRows.push({
                game_id: matchingGame?.id || null,
                player_name: playerName,
                team,
                prop_type: propType,
                line: data.line,
                over_odds: data.over?.price || null,
                under_odds: data.under?.price || null,
                source: sourceLabel,
                entered_by: 'api',
                game_date: todayEST,
              });
            }
          }
        }

        await new Promise(r => setTimeout(r, 100));
      } catch (eventErr: any) {
        if (eventErr.name === 'AbortError') {
          errors.push(`Event ${event.id}: timeout`);
        } else {
          errors.push(`Event ${event.id}: ${eventErr.message || 'Unknown'}`);
        }
      }
    }

    console.log(`Collected ${allRows.length} props from ${Object.keys(bookStats).length} books`);

    // Batch upsert — delete today's API props then bulk insert
    let inserted = 0;
    if (allRows.length > 0) {
      // Remove existing API-sourced props for today to avoid duplicates
      await supabase
        .from('sbo_player_props')
        .delete()
        .eq('game_date', todayEST)
        .eq('entered_by', 'api')
        .in('source', [...new Set(allRows.map(r => r.source))]);

      // Batch insert in chunks of 200
      for (let i = 0; i < allRows.length; i += 200) {
        const chunk = allRows.slice(i, i + 200);
        const { error: insertErr } = await supabase.from('sbo_player_props').insert(chunk);
        if (insertErr) {
          errors.push(`Insert batch ${i}: ${insertErr.message}`);
        } else {
          inserted += chunk.length;
        }
      }
    }

    // Log sync
    await supabase.from('sbo_sync_log').insert({
      feed_name: 'book_props_ingestion',
      last_synced_at: new Date().toISOString(),
      records_synced: inserted,
      status: errors.length > 0 ? 'partial' : 'success',
      error_message: errors.length > 0 ? errors.slice(0, 5).join('; ') : null,
    });

    console.log(`✅ Done: ${inserted} inserted`);

    return new Response(JSON.stringify({
      success: true,
      date: todayEST,
      inserted,
      updated: 0,
      skipped: 0,
      book_stats: bookStats,
      errors: errors.slice(0, 10),
      events_checked: eventsToProcess.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('❌ sbo-ingest-book-props error:', e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
