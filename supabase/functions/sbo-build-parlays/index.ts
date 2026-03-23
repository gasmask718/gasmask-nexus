import { createClient } from 'npm:@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function toDecimal(american: number): number {
  if (!american) return 1.91;
  return american > 0 ? 1 + american / 100 : 1 + 100 / Math.abs(american);
}

function toAmerican(decimal: number): string {
  if (decimal >= 2) return '+' + Math.round((decimal - 1) * 100);
  return '-' + Math.round(100 / (decimal - 1));
}

function calcParlay(legs: any[]): { decimal: number; american: string; winProb: number; ev: number } {
  const decimal = legs.reduce((acc, l) => acc * toDecimal(l.odds), 1);
  const american = toAmerican(decimal);
  const winProb = legs.reduce((acc, l) => acc * (l.confidence / 100), 1) * 100;
  const ev = ((winProb / 100) * (decimal - 1) - (1 - winProb / 100)) * 100;
  return { decimal, american, winProb, ev };
}

async function getAIAnalysis(legSummary: string, parlayInfo: any, apiKey: string): Promise<any> {
  const fallback = {
    verdict: parlayInfo.ev > 5 ? 'STRONG BET' : parlayInfo.ev > 0 ? 'MODERATE BET' : parlayInfo.ev > -10 ? 'RISKY' : 'PASS',
    weakest_leg: '',
    correlation_risk: 'low',
    analysis: `${parlayInfo.legCount}-leg parlay with ${parlayInfo.winProb.toFixed(1)}% win probability`,
    confidence_score: Math.round(parlayInfo.winProb),
  };

  try {
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: 'You are an NBA betting analyst. Return ONLY valid JSON, no markdown.'
          },
          {
            role: 'user',
            content: `Analyze this ${parlayInfo.legCount}-leg NBA parlay:\n\nLEGS: ${legSummary}\n\nCOMBINED ODDS: ${parlayInfo.american}\nWIN PROBABILITY: ${parlayInfo.winProb.toFixed(1)}%\nEV: ${parlayInfo.ev.toFixed(1)}%\nSTAKE: $${parlayInfo.stake}\nPOTENTIAL PAYOUT: $${parlayInfo.payout}\n\nReturn JSON: {"verdict":"STRONG BET"|"MODERATE BET"|"RISKY"|"PASS","weakest_leg":"leg label","correlation_risk":"none"|"low"|"medium"|"high","analysis":"one sharp sentence","confidence_score":0-100}`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'analyze_parlay',
              description: 'Analyze a parlay bet',
              parameters: {
                type: 'object',
                properties: {
                  verdict: { type: 'string', enum: ['STRONG BET', 'MODERATE BET', 'RISKY', 'PASS'] },
                  weakest_leg: { type: 'string' },
                  correlation_risk: { type: 'string', enum: ['none', 'low', 'medium', 'high'] },
                  analysis: { type: 'string' },
                  confidence_score: { type: 'number' },
                },
                required: ['verdict', 'analysis', 'confidence_score'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'analyze_parlay' } },
      }),
    });

    if (!res.ok) {
      console.warn('AI analysis returned', res.status);
      return fallback;
    }

    const data = await res.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      return JSON.parse(toolCall.function.arguments);
    }

    // Try content as JSON fallback
    const content = data.choices?.[0]?.message?.content || '';
    const match = content.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);

    return fallback;
  } catch (e: any) {
    console.warn('AI analysis error:', e.message);
    return fallback;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { stake = 50, min_confidence = 60, variations = 5 } = await req.json().catch(() => ({}));

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    // Pull today's predictions
    const { data: predictions } = await supabase
      .from('sbo_predictions')
      .select(`
        *,
        sbo_games(id, home_team, away_team, game_date),
        sbo_player_props(player_name, team, prop_type, line, over_odds, under_odds, recommendation)
      `)
      .gte('final_confidence', min_confidence)
      .gte('created_at', `${today}T00:00:00-04:00`)
      .order('final_confidence', { ascending: false })
      .limit(40);

    if (!predictions?.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'No predictions available. Run predictions first.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build leg pool
    const legPool: any[] = [];

    for (const pred of predictions) {
      if (pred.prediction_type === 'moneyline' && pred.sbo_games) {
        const game = pred.sbo_games;
        const odds = pred.sbo_odds || [];
        const dkOdds = (Array.isArray(odds) ? odds : [odds]).find((o: any) =>
          o?.sportsbook === 'draftkings' && o?.market_type === 'moneyline'
        ) || (Array.isArray(odds) ? odds[0] : odds);

        const pickedTeam = pred.predicted_outcome === 'home' ? game.home_team : game.away_team;
        const oddsVal = pred.predicted_outcome === 'home' ? dkOdds?.home_odds : dkOdds?.away_odds;
        if (!oddsVal) continue;

        legPool.push({
          id: pred.id, type: 'game',
          label: `${pickedTeam} ML`,
          matchup: `${game.away_team} @ ${game.home_team}`,
          pick: pickedTeam, odds: oddsVal,
          confidence: pred.final_confidence,
          game_id: game.id,
          tier: pred.confidence_tier,
        });
      }

      if (pred.prediction_type === 'player_prop' && pred.sbo_player_props) {
        const prop = pred.sbo_player_props;
        const rec = prop.recommendation || pred.predicted_outcome;
        const oddsVal = rec?.toLowerCase() === 'over' ? prop.over_odds : prop.under_odds;
        if (!oddsVal) continue;

        legPool.push({
          id: pred.id, type: 'prop',
          label: `${prop.player_name} ${rec?.toUpperCase()} ${prop.line} ${prop.prop_type}`,
          matchup: `${prop.player_name} (${prop.team})`,
          pick: rec?.toUpperCase(), odds: oddsVal,
          confidence: pred.final_confidence,
          game_id: pred.game_id,
          tier: pred.confidence_tier,
        });
      }
    }

    console.log(`Leg pool size: ${legPool.length}`);

    if (legPool.length < 3) {
      return new Response(
        JSON.stringify({ success: false, error: `Only ${legPool.length} qualifying legs. Need at least 3.` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    legPool.sort((a, b) => b.confidence - a.confidence);

    const LEG_COUNTS = [3, 6, 10, 15, 20];
    const allParlays: any[] = [];

    for (const legCount of LEG_COUNTS) {
      if (legPool.length < legCount) continue;

      for (let variation = 1; variation <= variations; variation++) {
        let selectedLegs: any[] = [];

        if (variation === 1) {
          selectedLegs = legPool.slice(0, legCount);
        } else if (variation === 2) {
          const games = legPool.filter(l => l.type === 'game');
          const props = legPool.filter(l => l.type === 'prop');
          const gc = Math.min(Math.ceil(legCount / 2), games.length);
          selectedLegs = [...games.slice(0, gc), ...props.slice(0, legCount - gc)].slice(0, legCount);
        } else if (variation === 3) {
          const props = legPool.filter(l => l.type === 'prop');
          const games = legPool.filter(l => l.type === 'game');
          const pc = Math.min(Math.ceil(legCount * 0.7), props.length);
          selectedLegs = [...props.slice(0, pc), ...games.slice(0, legCount - pc)].slice(0, legCount);
        } else if (variation === 4) {
          const heavyFavs = legPool.filter(l => l.odds < 0 && l.odds <= -130).sort((a, b) => a.odds - b.odds);
          const rest = legPool.filter(l => !heavyFavs.includes(l));
          selectedLegs = [...heavyFavs.slice(0, legCount), ...rest.slice(0, Math.max(0, legCount - heavyFavs.length))].slice(0, legCount);
        } else {
          const pool = legPool.slice(0, Math.ceil(legPool.length * 0.6));
          selectedLegs = [...pool].sort(() => Math.random() - 0.5).slice(0, legCount);
        }

        // De-correlate: max 2 legs per game
        const deCorrelated: any[] = [];
        for (const leg of selectedLegs) {
          const gid = String(leg.game_id || '');
          if (deCorrelated.filter(l => String(l.game_id) === gid).length < 2) {
            deCorrelated.push(leg);
          }
        }
        // Fill if short
        if (deCorrelated.length < legCount) {
          const usedIds = new Set(deCorrelated.map(l => l.id));
          for (const leg of legPool) {
            if (deCorrelated.length >= legCount) break;
            if (usedIds.has(leg.id)) continue;
            const gid = String(leg.game_id || '');
            if (deCorrelated.filter(l => String(l.game_id) === gid).length < 2) {
              deCorrelated.push(leg);
              usedIds.add(leg.id);
            }
          }
        }

        const finalLegs = deCorrelated.slice(0, legCount);
        if (finalLegs.length < Math.min(legCount, 3)) continue;

        const { decimal, american, winProb, ev } = calcParlay(finalLegs);
        const totalPayout = Math.round(stake * decimal * 100) / 100;
        const profit = Math.round((totalPayout - stake) * 100) / 100;

        const legSummary = finalLegs.map(l =>
          `${l.label} (${l.odds > 0 ? '+' : ''}${l.odds}) conf:${l.confidence}%`
        ).join(' | ');

        const aiResult = await getAIAnalysis(legSummary, {
          legCount: finalLegs.length, american, winProb, ev, stake, payout: totalPayout,
        }, LOVABLE_API_KEY);

        const parlayName = `${finalLegs.length}-Leg V${variation} — ${aiResult.verdict}`;

        const { data: savedParlay } = await supabase
          .from('sbo_parlay_builder')
          .insert({
            parlay_name: parlayName,
            leg_count: finalLegs.length,
            variation_number: variation,
            legs: finalLegs,
            combined_odds_decimal: Math.round(decimal * 100) / 100,
            combined_odds_american: american,
            win_probability: Math.round(winProb * 10) / 10,
            ev_percentage: Math.round(ev * 10) / 10,
            stake,
            potential_payout: totalPayout,
            profit_if_win: profit,
            ai_analysis: aiResult.analysis,
            ai_verdict: aiResult.verdict,
            confidence_score: aiResult.confidence_score,
            correlation_risk: aiResult.correlation_risk || 'low',
            result: 'pending',
          })
          .select()
          .single();

        allParlays.push({ ...savedParlay, legs: finalLegs });
        console.log(`Built ${parlayName}: ${american} | ${winProb.toFixed(1)}% | $${profit}`);

        await new Promise(r => setTimeout(r, 200));
      }
    }

    const verdictOrder: Record<string, number> = { 'STRONG BET': 0, 'MODERATE BET': 1, 'RISKY': 2, 'PASS': 3 };
    allParlays.sort((a, b) => {
      const va = verdictOrder[a.ai_verdict] ?? 3;
      const vb = verdictOrder[b.ai_verdict] ?? 3;
      return va !== vb ? va - vb : (b.ev_percentage || 0) - (a.ev_percentage || 0);
    });

    return new Response(
      JSON.stringify({
        success: true,
        total_parlays_built: allParlays.length,
        leg_pool_size: legPool.length,
        stake,
        parlays: allParlays,
        summary: {
          strong_bets: allParlays.filter(p => p.ai_verdict === 'STRONG BET').length,
          moderate_bets: allParlays.filter(p => p.ai_verdict === 'MODERATE BET').length,
          risky: allParlays.filter(p => p.ai_verdict === 'RISKY').length,
          best_parlay: allParlays[0]?.parlay_name,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('Parlay builder error:', e);
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
