import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function americanToImplied(american: number): number {
  if (american < 0) return Math.abs(american) / (Math.abs(american) + 100) * 100;
  return 100 / (american + 100) * 100;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const today = new Date().toISOString().split('T')[0];
    let comparisonsCreated = 0, valueSpots = 0;

    const { data: todayGames } = await supabase
      .from('sbo_games')
      .select(`id, home_team, away_team, sbo_odds(sportsbook, market_type, home_odds, away_odds, over_odds, under_odds, total_line)`)
      .gte('game_date', today + 'T00:00:00')
      .lte('game_date', today + 'T23:59:59');

    for (const game of todayGames || []) {
      const odds = (game as any).sbo_odds || [];
      const { data: polyMarkets } = await supabase
        .from('sbo_polymarket_markets')
        .select('*')
        .eq('game_id', game.id)
        .eq('is_active', true)
        .order('volume_24h', { ascending: false });

      const bookOdds: Record<string, Record<string, any>> = {};
      for (const odd of odds) {
        if (!bookOdds[odd.sportsbook]) bookOdds[odd.sportsbook] = {};
        bookOdds[odd.sportsbook][odd.market_type] = odd;
      }

      for (const outcome of ['home', 'away'] as const) {
        const polyMarket = polyMarkets?.find(m => m.market_type === 'moneyline');
        const polyProb = outcome === 'home'
          ? polyMarket?.token_home_price ? polyMarket.token_home_price * 100 : null
          : polyMarket?.token_away_price ? polyMarket.token_away_price * 100 : null;
        const finalPolyProb = polyProb ?? (outcome === 'home' && polyMarket?.token_yes_price ? polyMarket.token_yes_price * 100 : null);

        const dkOdds = bookOdds['draftkings']?.['moneyline'];
        const fdOdds = bookOdds['fanduel']?.['moneyline'];
        const bmOdds = bookOdds['betmgm']?.['moneyline'];
        const cOdds = bookOdds['caesars']?.['moneyline'];

        const dkProb = dkOdds ? americanToImplied(outcome === 'home' ? dkOdds.home_odds : dkOdds.away_odds) : null;
        const fdProb = fdOdds ? americanToImplied(outcome === 'home' ? fdOdds.home_odds : fdOdds.away_odds) : null;
        const bmProb = bmOdds ? americanToImplied(outcome === 'home' ? bmOdds.home_odds : bmOdds.away_odds) : null;
        const cProb = cOdds ? americanToImplied(outcome === 'home' ? cOdds.home_odds : cOdds.away_odds) : null;

        const bookProbs = [dkProb, fdProb, bmProb, cProb].filter(p => p !== null) as number[];
        const avgBookProb = bookProbs.length > 0 ? bookProbs.reduce((a, b) => a + b, 0) / bookProbs.length : null;
        if (!finalPolyProb && !avgBookProb) continue;

        const polyVsBooks = finalPolyProb && avgBookProb ? parseFloat((finalPolyProb - avgBookProb).toFixed(2)) : null;
        const maxDivergence = finalPolyProb && avgBookProb ? Math.abs(polyVsBooks || 0) : null;
        const hasValue = maxDivergence !== null && maxDivergence >= 5 && (polyMarket?.volume_24h || 0) > 5000;
        if (hasValue) valueSpots++;

        await supabase.from('sbo_odds_comparison').insert({
          game_id: game.id, comparison_date: today, market_type: 'moneyline', outcome,
          polymarket_prob: finalPolyProb, polymarket_volume: polyMarket?.volume_24h || null,
          draftkings_prob: dkProb, fanduel_prob: fdProb, betmgm_prob: bmProb, caesars_prob: cProb,
          avg_sportsbook_prob: avgBookProb, max_divergence: maxDivergence, polymarket_vs_books: polyVsBooks,
          has_value: hasValue, value_direction: polyVsBooks && polyVsBooks > 0 ? 'polymarket_higher' : 'books_higher',
          edge_pct: maxDivergence,
          notes: hasValue ? `${Math.abs(polyVsBooks || 0).toFixed(1)}% edge — Polymarket ${(polyVsBooks || 0) > 0 ? 'bullish' : 'bearish'} vs sportsbooks` : null,
        });
        comparisonsCreated++;
      }

      // Compare player props
      const propMarkets = polyMarkets?.filter(m => m.market_type === 'player_prop') || [];
      for (const polyProp of propMarkets) {
        if (!polyProp.player_name || !polyProp.prop_line) continue;
        const { data: sboProp } = await supabase
          .from('sbo_player_props')
          .select('id, over_odds, under_odds')
          .ilike('player_name', `%${polyProp.player_name}%`)
          .eq('prop_type', polyProp.prop_type || 'points')
          .gte('created_at', today + 'T00:00:00')
          .maybeSingle();
        if (!sboProp) continue;

        const polyOverProb = polyProp.token_over_price ? polyProp.token_over_price * 100 : polyProp.token_yes_price ? polyProp.token_yes_price * 100 : null;
        const dkOverProb = sboProp.over_odds ? americanToImplied(sboProp.over_odds) : null;
        if (!polyOverProb || !dkOverProb) continue;

        const divergence = Math.abs(polyOverProb - dkOverProb);
        const hasValue = divergence >= 5 && (polyProp.volume_24h || 0) > 1000;
        if (hasValue) valueSpots++;

        await supabase.from('sbo_odds_comparison').insert({
          game_id: game.id, prop_id: sboProp.id, comparison_date: today, market_type: 'player_prop', outcome: 'over',
          polymarket_prob: polyOverProb, polymarket_volume: polyProp.volume_24h, draftkings_prob: dkOverProb,
          max_divergence: divergence, polymarket_vs_books: polyOverProb - dkOverProb,
          has_value: hasValue, value_direction: polyOverProb > dkOverProb ? 'polymarket_higher' : 'books_higher', edge_pct: divergence,
        });
        comparisonsCreated++;
      }
    }

    return new Response(JSON.stringify({ success: true, comparisons_created: comparisonsCreated, value_spots_found: valueSpots }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
