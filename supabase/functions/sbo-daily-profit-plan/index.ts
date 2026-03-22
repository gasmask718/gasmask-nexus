import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { target_profit, bankroll } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const today = new Date().toISOString().split('T')[0];

    // Pull tonight's games with predictions
    const { data: games } = await supabase
      .from('sbo_games')
      .select('*')
      .gte('commence_time', `${today}T00:00:00`)
      .lte('commence_time', `${today}T23:59:59`);

    const { data: predictions } = await supabase
      .from('sbo_predictions')
      .select('*')
      .gte('created_at', `${today}T00:00:00`);

    const { data: userBooks } = await supabase
      .from('sbo_user_books')
      .select('*')
      .eq('is_active', true);

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
            content: `You are an elite sports betting strategist for Dynasty OS SBO Engine. Build a DAILY PROFIT PLAN that maximizes guaranteed profit using pre-game bets, live hedges, and arbitrage. Think like a professional sharp — capital preservation first. Return ONLY valid JSON via the tool call.`,
          },
          {
            role: 'user',
            content: `Build a daily profit plan.

BANKROLL: $${bankroll || 500}
TARGET PROFIT: $${target_profit || 50}

TONIGHT'S GAMES (${games?.length || 0}):
${JSON.stringify(games?.slice(0, 10) || [])}

PREDICTIONS:
${JSON.stringify(predictions?.slice(0, 10) || [])}

USER'S ACTIVE BOOKS:
${JSON.stringify(userBooks || [{ book_name: 'DraftKings' }, { book_name: 'FanDuel' }, { book_name: 'BetMGM' }])}

Build the plan with:
1. pregame_bets: array of { pick, odds, stake, book, reason, hedge_setup }
2. hedge_triggers: array of { game, trigger_condition, hedge_pick, hedge_book, hedge_stake, guaranteed_profit }
3. arbitrage: array of { game, side_a: { pick, book, odds, stake }, side_b: { pick, book, odds, stake }, guaranteed_profit }
4. daily_summary: { guaranteed_profit_floor, projected_profit_ceiling, total_capital_required, risk_rating, books_needed }`,
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'build_profit_plan',
              description: 'Return structured daily profit plan',
              parameters: {
                type: 'object',
                properties: {
                  pregame_bets: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        pick: { type: 'string' },
                        odds: { type: 'string' },
                        stake: { type: 'number' },
                        book: { type: 'string' },
                        reason: { type: 'string' },
                        hedge_setup: { type: 'string' },
                      },
                    },
                  },
                  hedge_triggers: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        game: { type: 'string' },
                        trigger_condition: { type: 'string' },
                        hedge_pick: { type: 'string' },
                        hedge_book: { type: 'string' },
                        hedge_stake: { type: 'number' },
                        guaranteed_profit: { type: 'number' },
                      },
                    },
                  },
                  arbitrage: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        game: { type: 'string' },
                        side_a_pick: { type: 'string' },
                        side_a_book: { type: 'string' },
                        side_a_odds: { type: 'string' },
                        side_a_stake: { type: 'number' },
                        side_b_pick: { type: 'string' },
                        side_b_book: { type: 'string' },
                        side_b_odds: { type: 'string' },
                        side_b_stake: { type: 'number' },
                        guaranteed_profit: { type: 'number' },
                      },
                    },
                  },
                  daily_summary: {
                    type: 'object',
                    properties: {
                      guaranteed_profit_floor: { type: 'number' },
                      projected_profit_ceiling: { type: 'number' },
                      total_capital_required: { type: 'number' },
                      risk_rating: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
                      books_needed: { type: 'array', items: { type: 'string' } },
                    },
                  },
                },
                required: ['pregame_bets', 'hedge_triggers', 'daily_summary'],
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'build_profit_plan' } },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('AI error:', aiRes.status, errText);
      throw new Error(`AI gateway error: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error('No plan returned from AI');

    const plan = JSON.parse(toolCall.function.arguments);

    // Save plan
    const { data: saved, error: saveErr } = await supabase.from('sbo_daily_profit_plan').insert({
      plan_date: today,
      target_profit: target_profit || 50,
      guaranteed_profit: plan.daily_summary?.guaranteed_profit_floor || 0,
      projected_profit: plan.daily_summary?.projected_profit_ceiling || 0,
      total_capital_required: plan.daily_summary?.total_capital_required || 0,
      total_stakes: plan.pregame_bets?.reduce((s: number, b: any) => s + (b.stake || 0), 0) || 0,
      bets: plan.pregame_bets || [],
      hedges: plan.hedge_triggers || [],
      books_needed: plan.daily_summary?.books_needed || [],
      status: 'planned',
    }).select().single();

    if (saveErr) console.error('Save error:', saveErr);

    return new Response(JSON.stringify({ success: true, plan, saved }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('Profit plan error:', e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
