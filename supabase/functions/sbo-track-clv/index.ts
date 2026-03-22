import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function toDecimal(american: string | number): number {
  const n = typeof american === 'string' ? parseInt(american) : american;
  if (isNaN(n)) return 2;
  return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
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

    // Get untracked predictions
    const { data: predictions } = await supabase
      .from('sbo_predictions')
      .select('*')
      .eq('clv_tracked', false)
      .not('predicted_outcome', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!predictions?.length) {
      return new Response(JSON.stringify({ success: true, tracked: 0, message: 'No untracked predictions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch current odds for all NBA games
    const oddsRes = await fetch(
      `https://api.the-odds-api.com/v4/sports/basketball_nba/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h&oddsFormat=american`
    );

    let currentOdds: any[] = [];
    if (oddsRes.ok) currentOdds = await oddsRes.json();

    let tracked = 0;
    let totalCLV = 0;

    for (const pred of predictions) {
      // Find current odds for this game
      const game = currentOdds.find((g: any) => g.id === pred.game_id);
      if (!game?.bookmakers?.length) continue;

      // Get consensus closing line (average across books)
      const allOdds: { home: number[]; away: number[] } = { home: [], away: [] };
      for (const bk of game.bookmakers) {
        const h2h = bk.markets?.find((m: any) => m.key === 'h2h');
        if (!h2h?.outcomes) continue;
        for (const o of h2h.outcomes) {
          if (o.name === game.home_team) allOdds.home.push(o.price);
          if (o.name === game.away_team) allOdds.away.push(o.price);
        }
      }

      if (!allOdds.home.length || !allOdds.away.length) continue;

      const avgHome = allOdds.home.reduce((a, b) => a + b, 0) / allOdds.home.length;
      const avgAway = allOdds.away.reduce((a, b) => a + b, 0) / allOdds.away.length;

      // Determine which side we picked
      const isHomePick = pred.predicted_outcome === 'home';
      const ourOdds = pred.prediction_odds || (isHomePick ? -150 : 150);
      const closingOdds = isHomePick ? Math.round(avgHome) : Math.round(avgAway);

      // CLV calc: compare decimal odds
      const ourDec = toDecimal(ourOdds);
      const closeDec = toDecimal(closingOdds);
      const clvPct = ((ourDec - closeDec) / closeDec) * 100;
      const clvValue = ourDec - closeDec;

      await supabase.from('sbo_clv_tracker').insert({
        prediction_id: pred.id,
        game_id: pred.game_id,
        our_pick: pred.predicted_outcome,
        odds_when_predicted: String(ourOdds),
        closing_odds: String(closingOdds),
        clv_value: Math.round(clvValue * 1000) / 1000,
        clv_percentage: Math.round(clvPct * 100) / 100,
        verdict: clvPct > 0 ? 'beat_close' : 'missed_close',
      });

      await supabase.from('sbo_predictions').update({ clv_tracked: true }).eq('id', pred.id);
      tracked++;
      totalCLV += clvPct;
    }

    const avgCLV = tracked > 0 ? totalCLV / tracked : 0;

    // Update bettor profile with CLV
    const { data: profile } = await supabase
      .from('sbo_bettor_profile')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (profile) {
      await supabase.from('sbo_bettor_profile').update({ avg_clv: Math.round(avgCLV * 100) / 100 }).eq('id', profile.id);
    }

    return new Response(JSON.stringify({
      success: true,
      tracked,
      avg_clv: Math.round(avgCLV * 100) / 100,
      message: `${tracked} predictions CLV-tracked. Avg CLV: ${avgCLV.toFixed(2)}%`,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('CLV tracking error:', e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
