import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const ODDS_API_KEY = Deno.env.get('ODDS_API_KEY')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const response = await fetch(
      `https://api.the-odds-api.com/v4/sports/basketball_nba/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american&bookmakers=draftkings,fanduel,betmgm,caesars`
    );

    if (!response.ok) throw new Error(`Odds API error: ${response.status}`);

    const games = await response.json();
    let gamesProcessed = 0;
    let oddsProcessed = 0;

    for (const game of games) {
      const { data: gameRecord } = await supabase
        .from('sbo_games')
        .upsert({
          external_id: game.id,
          sport: 'basketball_nba',
          home_team: game.home_team,
          away_team: game.away_team,
          game_date: game.commence_time,
          status: 'upcoming',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'external_id' })
        .select()
        .single();

      if (!gameRecord) continue;
      gamesProcessed++;

      for (const bookmaker of game.bookmakers || []) {
        for (const market of bookmaker.markets || []) {
          const oddsData: any = {
            game_id: gameRecord.id,
            sportsbook: bookmaker.key,
            market_type: market.key === 'h2h' ? 'moneyline'
              : market.key === 'spreads' ? 'spreads' : 'totals',
            fetched_at: new Date().toISOString(),
          };

          if (market.key === 'h2h') {
            for (const outcome of market.outcomes) {
              if (outcome.name === game.home_team) oddsData.home_odds = outcome.price;
              if (outcome.name === game.away_team) oddsData.away_odds = outcome.price;
            }
          } else if (market.key === 'spreads') {
            for (const outcome of market.outcomes) {
              if (outcome.name === game.home_team) { oddsData.home_spread = outcome.point; oddsData.home_odds = outcome.price; }
              if (outcome.name === game.away_team) { oddsData.away_spread = outcome.point; oddsData.away_odds = outcome.price; }
            }
          } else if (market.key === 'totals') {
            for (const outcome of market.outcomes) {
              if (outcome.name === 'Over') { oddsData.total_line = outcome.point; oddsData.over_odds = outcome.price; }
              if (outcome.name === 'Under') oddsData.under_odds = outcome.price;
            }
          }

          await supabase.from('sbo_odds').insert(oddsData);
          oddsProcessed++;
        }
      }
    }

    await supabase.from('ai_instinct_log').insert({
      action_type: 'sbo_odds_fetched',
      reasoning: `Fetched ${gamesProcessed} NBA games and ${oddsProcessed} odds records`,
      input_data: { source: 'the_odds_api' },
      decision_path: { games: gamesProcessed, odds: oddsProcessed },
    });

    return new Response(JSON.stringify({ success: true, games_processed: gamesProcessed, odds_processed: oddsProcessed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
