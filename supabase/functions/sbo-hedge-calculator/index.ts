import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function toDecimal(american: string): number {
  const n = parseInt(american);
  if (isNaN(n)) return 2;
  return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const {
      pregame_pick,
      pregame_odds,
      pregame_stake,
      current_score_home,
      current_score_away,
      current_live_odds,
      quarter,
      clock,
      game_id,
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const pregameDecimal = toDecimal(pregame_odds);
    const pregamePayout = pregame_stake * pregameDecimal;

    // Calculate hedge for each available book/line
    const hedgeResults = (current_live_odds || []).map((book: any) => {
      const hedgeDecimal = toDecimal(book.odds);
      const hedgeStake = pregamePayout / hedgeDecimal;
      const hedgePayout = hedgeStake * hedgeDecimal;
      const guaranteedProfit = Math.min(
        pregamePayout - pregame_stake - hedgeStake,
        hedgePayout - pregame_stake
      );
      const totalStaked = pregame_stake + hedgeStake;
      const profitPct = totalStaked > 0 ? (guaranteedProfit / totalStaked) * 100 : 0;

      return {
        book: book.name,
        hedge_pick: book.pick,
        hedge_odds: book.odds,
        hedge_stake: Math.round(hedgeStake * 100) / 100,
        hedge_payout: Math.round(hedgePayout * 100) / 100,
        guaranteed_profit: Math.round(guaranteedProfit * 100) / 100,
        profit_percentage: Math.round(profitPct * 100) / 100,
        total_staked: Math.round(totalStaked * 100) / 100,
      };
    });

    hedgeResults.sort((a: any, b: any) => b.guaranteed_profit - a.guaranteed_profit);
    const bestHedge = hedgeResults[0];

    if (!bestHedge) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No live odds provided to calculate hedge',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // AI analysis via Lovable AI Gateway
    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an elite hedge betting analyst for Dynasty OS SBO Engine. You specialize in identifying optimal hedge timing and execution to guarantee profit. Be precise, mathematical, and direct. Return ONLY valid JSON.`,
          },
          {
            role: 'user',
            content: `Analyze this hedge opportunity:

PRE-GAME BET: ${pregame_pick} at ${pregame_odds} for $${pregame_stake}
Potential payout: $${pregamePayout.toFixed(2)}

CURRENT GAME STATE: Q${quarter || '?'} ${clock || '?'} | Score: ${current_score_home || 0} - ${current_score_away || 0}

BEST HEDGE AVAILABLE:
Bet $${bestHedge.hedge_stake} on ${bestHedge.hedge_pick} at ${bestHedge.hedge_odds} on ${bestHedge.book}
Guaranteed profit: $${bestHedge.guaranteed_profit} (${bestHedge.profit_percentage}%)

ALL HEDGE OPTIONS: ${JSON.stringify(hedgeResults)}

Return JSON: {
  "action": "HEDGE_NOW" | "WAIT" | "PARTIAL_HEDGE",
  "timing": "string explaining when to hedge",
  "middle_opportunity": "string or null",
  "no_hedge_risk": "what happens if you don't hedge",
  "reasoning": "2-3 sentence explanation",
  "urgent": true/false
}`,
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'hedge_analysis',
              description: 'Return hedge timing analysis',
              parameters: {
                type: 'object',
                properties: {
                  action: { type: 'string', enum: ['HEDGE_NOW', 'WAIT', 'PARTIAL_HEDGE'] },
                  timing: { type: 'string' },
                  middle_opportunity: { type: 'string' },
                  no_hedge_risk: { type: 'string' },
                  reasoning: { type: 'string' },
                  urgent: { type: 'boolean' },
                },
                required: ['action', 'timing', 'no_hedge_risk', 'reasoning', 'urgent'],
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'hedge_analysis' } },
      }),
    });

    let aiAnalysis = { action: 'WAIT', timing: 'Monitor game flow', no_hedge_risk: 'Full stake at risk', reasoning: 'Insufficient data for recommendation', urgent: false, middle_opportunity: null };

    if (aiRes.ok) {
      const aiData = await aiRes.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        try {
          aiAnalysis = JSON.parse(toolCall.function.arguments);
        } catch { /* use default */ }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      best_hedge: bestHedge,
      all_options: hedgeResults,
      ai_recommendation: aiAnalysis,
      pregame_payout: pregamePayout,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('Hedge calculator error:', e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
