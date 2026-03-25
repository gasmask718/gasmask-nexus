import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// The Odds API player prop market keys
const PROP_MARKETS = [
  'player_points',
  'player_rebounds',
  'player_assists',
  'player_threes',
  'player_blocks',
  'player_steals',
  'player_turnovers',
  'player_points_rebounds_assists',
  'player_points_rebounds',
  'player_points_assists',
  'player_rebounds_assists',
];

// Map Odds API market keys to SBO prop_type
const MARKET_TO_PROP_TYPE: Record<string, string> = {
  player_points: 'points',
  player_rebounds: 'rebounds',
  player_assists: 'assists',
  player_threes: 'threes',
  player_blocks: 'blocks',
  player_steals: 'steals',
  player_turnovers: 'turnovers',
  player_points_rebounds_assists: 'pts_reb_ast',
  player_points_rebounds: 'pts_reb',
  player_points_assists: 'pts_ast',
  player_rebounds_assists: 'reb_ast',
};

// Bookmaker keys to our source labels
const BOOKMAKER_SOURCE: Record<string, string> = {
  bovada: 'bovada',
  betonlineag: 'bovada',
  draftkings: 'draftkings',
  fanduel: 'fanduel',
  betmgm: 'betmgm',
  williamhill_us: 'caesars',
  pointsbetus: 'pointsbet',
  betrivers: 'betrivers',
  mybookieag: 'mybookie',
  betus: 'betus',
};

// Team name normalization for matching
const TEAM_ABBREV_MAP: Record<string, string[]> = {
  'ATL': ['Atlanta Hawks', 'Hawks'],
  'BOS': ['Boston Celtics', 'Celtics'],
  'BKN': ['Brooklyn Nets', 'Nets'],
  'CHA': ['Charlotte Hornets', 'Hornets'],
  'CHI': ['Chicago Bulls', 'Bulls'],
  'CLE': ['Cleveland Cavaliers', 'Cavaliers', 'Cavs'],
  'DAL': ['Dallas Mavericks', 'Mavericks', 'Mavs'],
  'DEN': ['Denver Nuggets', 'Nuggets'],
  'DET': ['Detroit Pistons', 'Pistons'],
  'GSW': ['Golden State Warriors', 'Warriors'],
  'HOU': ['Houston Rockets', 'Rockets'],
  'IND': ['Indiana Pacers', 'Pacers'],
  'LAC': ['Los Angeles Clippers', 'LA Clippers', 'Clippers'],
  'LAL': ['Los Angeles Lakers', 'LA Lakers', 'Lakers'],
  'MEM': ['Memphis Grizzlies', 'Grizzlies'],
  'MIA': ['Miami Heat', 'Heat'],
  'MIL': ['Milwaukee Bucks', 'Bucks'],
  'MIN': ['Minnesota Timberwolves', 'Timberwolves', 'Wolves'],
  'NOP': ['New Orleans Pelicans', 'Pelicans'],
  'NYK': ['New York Knicks', 'Knicks'],
  'OKC': ['Oklahoma City Thunder', 'Thunder'],
  'ORL': ['Orlando Magic', 'Magic'],
  'PHI': ['Philadelphia 76ers', '76ers', 'Sixers'],
  'PHX': ['Phoenix Suns', 'Suns'],
  'POR': ['Portland Trail Blazers', 'Trail Blazers', 'Blazers'],
  'SAC': ['Sacramento Kings', 'Kings'],
  'SAS': ['San Antonio Spurs', 'Spurs'],
  'TOR': ['Toronto Raptors', 'Raptors'],
  'UTA': ['Utah Jazz', 'Jazz'],
  'WAS': ['Washington Wizards', 'Wizards'],
};

function findTeamAbbrev(teamName: string): string | null {
  const lower = teamName.toLowerCase();
  for (const [abbrev, names] of Object.entries(TEAM_ABBREV_MAP)) {
    if (names.some(n => lower.includes(n.toLowerCase()) || n.toLowerCase().includes(lower))) {
      return abbrev;
    }
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
    const marketsToFetch = body.markets || PROP_MARKETS;

    const todayEST = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    console.log(`📊 Ingesting book props for ${sport} on ${todayEST}`);

    // Get today's games for matching
    const { data: todayGames } = await supabase
      .from('sbo_games')
      .select('id, home_team, away_team, game_date')
      .gte('game_date', todayEST + 'T00:00:00')
      .lte('game_date', todayEST + 'T23:59:59');

    let totalInserted = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    const bookStats: Record<string, { inserted: number; updated: number }> = {};
    const errors: string[] = [];

    // Fetch events first to get event IDs
    const eventsUrl = `https://api.the-odds-api.com/v4/sports/${sport}/events?apiKey=${ODDS_API_KEY}&dateFormat=iso`;
    const eventsRes = await fetch(eventsUrl);
    if (!eventsRes.ok) throw new Error(`Events API error: ${eventsRes.status}`);
    const events = await eventsRes.json();
    console.log(`Found ${events.length} events`);

    // Process each event for player props
    for (const event of events) {
      const eventDate = event.commence_time?.split('T')[0];
      if (eventDate !== todayEST) continue;

      // Batch fetch all prop markets for this event
      const marketsParam = marketsToFetch.join(',');
      const propsUrl = `https://api.the-odds-api.com/v4/sports/${sport}/events/${event.id}/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=${marketsParam}&bookmakers=${targetBooks}&oddsFormat=american`;

      try {
        const propsRes = await fetch(propsUrl);
        if (!propsRes.ok) {
          errors.push(`Event ${event.id}: HTTP ${propsRes.status}`);
          continue;
        }

        const propsData = await propsRes.json();
        const bookmakers = propsData.bookmakers || [];

        // Match event to SBO game
        const matchingGame = todayGames?.find(g => {
          const homeMatch = g.home_team?.toLowerCase().includes(event.home_team?.split(' ').pop()?.toLowerCase()) ||
            event.home_team?.toLowerCase().includes(g.home_team?.split(' ').pop()?.toLowerCase());
          const awayMatch = g.away_team?.toLowerCase().includes(event.away_team?.split(' ').pop()?.toLowerCase()) ||
            event.away_team?.toLowerCase().includes(g.away_team?.split(' ').pop()?.toLowerCase());
          return homeMatch && awayMatch;
        });

        for (const bookmaker of bookmakers) {
          const sourceLabel = BOOKMAKER_SOURCE[bookmaker.key] || bookmaker.key;

          if (!bookStats[sourceLabel]) {
            bookStats[sourceLabel] = { inserted: 0, updated: 0 };
          }

          for (const market of bookmaker.markets || []) {
            const propType = MARKET_TO_PROP_TYPE[market.key];
            if (!propType) continue;

            // Group outcomes by description (player name) to get over/under pairs
            const playerOutcomes: Record<string, { over?: any; under?: any; line?: number }> = {};

            for (const outcome of market.outcomes || []) {
              const playerName = outcome.description;
              if (!playerName) continue;

              if (!playerOutcomes[playerName]) {
                playerOutcomes[playerName] = {};
              }

              if (outcome.name === 'Over') {
                playerOutcomes[playerName].over = outcome;
                playerOutcomes[playerName].line = outcome.point;
              } else if (outcome.name === 'Under') {
                playerOutcomes[playerName].under = outcome;
                if (!playerOutcomes[playerName].line) {
                  playerOutcomes[playerName].line = outcome.point;
                }
              }
            }

            // Insert/update each player prop
            for (const [playerName, data] of Object.entries(playerOutcomes)) {
              if (!data.line) continue;

              // Determine team from event context
              const team = findTeamAbbrev(event.home_team) || findTeamAbbrev(event.away_team) || '';

              // Check if prop already exists for this source
              const { data: existing } = await supabase
                .from('sbo_player_props')
                .select('id, line, over_odds, under_odds')
                .eq('player_name', playerName)
                .eq('prop_type', propType)
                .eq('source', sourceLabel)
                .eq('game_date', todayEST)
                .maybeSingle();

              if (existing) {
                // Update if line or odds changed
                if (existing.line !== data.line ||
                    existing.over_odds !== (data.over?.price || null) ||
                    existing.under_odds !== (data.under?.price || null)) {
                  await supabase.from('sbo_player_props').update({
                    line: data.line,
                    over_odds: data.over?.price || null,
                    under_odds: data.under?.price || null,
                    updated_at: new Date().toISOString(),
                  }).eq('id', existing.id);
                  totalUpdated++;
                  bookStats[sourceLabel].updated++;
                } else {
                  totalSkipped++;
                }
              } else {
                await supabase.from('sbo_player_props').insert({
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
                totalInserted++;
                bookStats[sourceLabel].inserted++;
              }
            }
          }
        }

        // Rate limit: small delay between events
        await new Promise(r => setTimeout(r, 200));

      } catch (eventErr) {
        errors.push(`Event ${event.id}: ${eventErr instanceof Error ? eventErr.message : 'Unknown'}`);
      }
    }

    // Log sync
    await supabase.from('sbo_sync_log').insert({
      feed_name: 'book_props_ingestion',
      last_synced_at: new Date().toISOString(),
      records_synced: totalInserted + totalUpdated,
      status: errors.length > 0 ? 'partial' : 'success',
      error_message: errors.length > 0 ? errors.slice(0, 5).join('; ') : null,
    });

    console.log(`✅ Done: ${totalInserted} inserted, ${totalUpdated} updated, ${totalSkipped} skipped`);

    return new Response(JSON.stringify({
      success: true,
      date: todayEST,
      inserted: totalInserted,
      updated: totalUpdated,
      skipped: totalSkipped,
      book_stats: bookStats,
      errors: errors.slice(0, 10),
      events_checked: events.filter((e: any) => e.commence_time?.startsWith(todayEST)).length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('❌ sbo-ingest-book-props error:', e);

    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      await supabase.from('sbo_sync_log').insert({
        feed_name: 'book_props_ingestion',
        status: 'error',
        error_message: e instanceof Error ? e.message : 'Unknown error',
        last_synced_at: new Date().toISOString(),
      });
    } catch (_) { /* ignore logging failure */ }

    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
