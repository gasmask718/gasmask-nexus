import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const { legs, stake, simulation_count = 10000 } = await req.json();
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const predIds = legs.map((l: any) => l.prediction_id);
    const { data: predictions } = await supabase.from('sbo_predictions').select('*').in('id', predIds);

    const legDetails = legs.map((leg: any) => {
      const pred = predictions?.find((p: any) => p.id === leg.prediction_id);
      const confidence = leg.confidence_override || pred?.final_confidence || 50;
      const winProb = confidence / 100;
      const odds = leg.odds || -110;
      const decimalOdds = odds > 0 ? (odds / 100) + 1 : (100 / Math.abs(odds)) + 1;
      const impliedProb = odds < 0 ? Math.abs(odds) / (Math.abs(odds) + 100) : 100 / (odds + 100);
      return {
        prediction_id: leg.prediction_id,
        predicted_outcome: pred?.predicted_outcome,
        confidence,
        win_probability: winProb,
        odds,
        decimal_odds: decimalOdds,
        implied_probability: impliedProb,
        edge: parseFloat((winProb - impliedProb).toFixed(4)),
      };
    });

    const combinedWinProb = legDetails.reduce((p: number, l: any) => p * l.win_probability, 1);
    const parlayMultiplier = legDetails.reduce((m: number, l: any) => m * l.decimal_odds, 1);
    const potentialPayout = parseFloat((stake * parlayMultiplier).toFixed(2));
    const potentialProfit = parseFloat((potentialPayout - stake).toFixed(2));
    const expectedValue = parseFloat(((combinedWinProb * potentialProfit) - ((1 - combinedWinProb) * stake)).toFixed(2));
    const kellyFraction = combinedWinProb - (1 - combinedWinProb) / (parlayMultiplier - 1);
    const kellySuggested = kellyFraction > 0 ? parseFloat((kellyFraction * 0.25 * stake * 10).toFixed(2)) : 0;

    let wins = 0;
    for (let i = 0; i < simulation_count; i++) {
      if (legDetails.every((l: any) => Math.random() < l.win_probability)) wins++;
    }

    const simulatedWinRate = wins / simulation_count;
    const confPct = combinedWinProb * 100;
    const tier = confPct >= 40 ? 'strong_parlay' : confPct >= 25 ? 'moderate_parlay' : confPct >= 15 ? 'risky_parlay' : 'long_shot';

    const { data: sim } = await supabase.from('sbo_simulations').insert({
      stake,
      potential_payout: potentialPayout,
      win_probability: combinedWinProb,
      expected_value: expectedValue,
      simulation_count,
      simulated_wins: wins,
      simulated_losses: simulation_count - wins,
      kelly_stake: kellySuggested,
      legs_detail: legDetails,
    }).select().single();

    return new Response(JSON.stringify({
      success: true,
      simulation_id: sim?.id,
      summary: {
        legs: legDetails.length,
        stake,
        potential_payout: potentialPayout,
        potential_profit: potentialProfit,
        combined_win_probability: parseFloat((combinedWinProb * 100).toFixed(1)),
        expected_value: expectedValue,
        kelly_suggested_stake: kellySuggested,
        parlay_tier: tier,
        parlay_multiplier: parseFloat(parlayMultiplier.toFixed(2)),
      },
      monte_carlo: {
        simulations: simulation_count,
        simulated_wins: wins,
        simulated_losses: simulation_count - wins,
        simulated_win_rate: parseFloat((simulatedWinRate * 100).toFixed(1)),
      },
      legs: legDetails,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
