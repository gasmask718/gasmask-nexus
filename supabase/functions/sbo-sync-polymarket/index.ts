import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Polymarket public API — no key needed
    const response = await fetch(
      'https://gamma-api.polymarket.com/markets?' +
      new URLSearchParams({
        category: 'sports',
        tag_slug: 'nba',
        limit: '100',
        order: 'volume24hr',
        ascending: 'false',
        active: 'true',
      }),
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Polymarket API error: ${response.status}`);
    }

    const markets = await response.json();
    let synced = 0;
    let matched = 0;

    const today = new Date().toISOString().split('T')[0];
    const { data: todayGames } = await supabase
      .from('sbo_games')
      .select('id, home_team, away_team, game_date')
      .gte('game_date', today + 'T00:00:00')
      .lte('game_date', today + 'T23:59:59');

    for (const market of markets) {
      const question = market.question?.toLowerCase() || '';
      if (!question.includes('nba') &&
          !question.includes('win') &&
          !question.includes('beats')) continue;

      let gameId: string | null = null;
      let homeTeamPrice: number | null = null;
      let awayTeamPrice: number | null = null;

      for (const game of todayGames || []) {
        const homeTeamLower = game.home_team.toLowerCase();
        const awayTeamLower = game.away_team.toLowerCase();
        const mentionsHome = question.includes(homeTeamLower.split(' ').pop() || '');
        const mentionsAway = question.includes(awayTeamLower.split(' ').pop() || '');

        if (mentionsHome || mentionsAway) {
          gameId = game.id;
          const tokens = market.tokens || [];
          for (const token of tokens) {
            const outcome = token.outcome?.toLowerCase() || '';
            if (outcome.includes(homeTeamLower.split(' ').pop() || '')) {
              homeTeamPrice = parseFloat(token.price || '0.5');
            } else if (outcome.includes(awayTeamLower.split(' ').pop() || '')) {
              awayTeamPrice = parseFloat(token.price || '0.5');
            }
          }
          if (gameId) matched++;
          break;
        }
      }

      const tokens = market.tokens || [];
      const yesToken = tokens.find((t: any) => t.outcome?.toLowerCase() === 'yes');
      const noToken = tokens.find((t: any) => t.outcome?.toLowerCase() === 'no');

      await supabase.from('sbo_polymarket').upsert({
        market_id: market.conditionId || market.id,
        question: market.question,
        category: 'nba',
        game_id: gameId,
        outcome_yes_price: yesToken ? parseFloat(yesToken.price) : null,
        outcome_no_price: noToken ? parseFloat(noToken.price) : null,
        home_team_price: homeTeamPrice,
        away_team_price: awayTeamPrice,
        volume_usd: parseFloat(market.volumeNum || '0'),
        liquidity_usd: parseFloat(market.liquidityNum || '0'),
        status: market.active ? 'open' : 'closed',
        end_date: market.endDate || null,
        raw_data: market,
        fetched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'market_id' });

      synced++;
    }

    await supabase.from('sbo_sync_log').insert({
      feed_name: 'polymarket',
      last_synced_at: new Date().toISOString(),
      records_synced: synced,
      status: 'success',
    });

    await supabase.from('sbo_api_costs').insert({
      run_date: today,
      feed_name: 'sbo-sync-polymarket',
      api_provider: 'polymarket',
      endpoint_called: 'gamma-api.polymarket.com/markets',
      records_returned: synced,
      estimated_cost_cents: 0,
      api_calls_made: 1,
      response_status: 'success',
    });

    return new Response(JSON.stringify({
      success: true,
      markets_synced: synced,
      games_matched: matched,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('Polymarket sync error:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
