import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function callClaude(system: string, user: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || '';
}

async function runStatsBrain(ctx: any): Promise<{ score: number; reasoning: string }> {
  const system = `You are a professional NBA statistical analyst. You are given REAL current season data for tonight's game. Analyze the actual numbers provided — do not use general knowledge, use only the data given. Give a confidence score 0-100 based purely on the statistics.

Respond ONLY with valid JSON: {"score": 0-100, "reasoning": "2-3 sentences referencing the actual stats provided"}`;

  let statsContext = '';

  // Fetch real player context from our database
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    if (ctx.prediction_type === 'player_prop' && ctx.player_name) {
      const { data } = await supabase.functions.invoke('sbo-get-player-context', {
        body: {
          player_name: ctx.player_name,
          team: ctx.team,
          game_date: ctx.game_date?.split('T')[0] || new Date().toISOString().split('T')[0],
          prop_type: ctx.prop_type,
          opponent: ctx.home_team === ctx.team ? ctx.away_team : ctx.home_team,
        },
      });
      if (data?.context_text) {
        statsContext = data.context_text;
      }
    } else if (ctx.prediction_type === 'moneyline') {
      const { data: homeTeam } = await supabase
        .from('sbo_team_stats')
        .select('*')
        .ilike('team_name', `%${ctx.home_team}%`)
        .maybeSingle();

      const { data: awayTeam } = await supabase
        .from('sbo_team_stats')
        .select('*')
        .ilike('team_name', `%${ctx.away_team}%`)
        .maybeSingle();

      const { data: homeInjuries } = await supabase
        .from('sbo_injuries')
        .select('player_name, status, injury_type')
        .ilike('team', `%${ctx.home_team?.slice(0, 3)}%`)
        .eq('is_active', true)
        .in('status', ['Out', 'Questionable', 'Doubtful']);

      const { data: awayInjuries } = await supabase
        .from('sbo_injuries')
        .select('player_name, status, injury_type')
        .ilike('team', `%${ctx.away_team?.slice(0, 3)}%`)
        .eq('is_active', true)
        .in('status', ['Out', 'Questionable', 'Doubtful']);

      statsContext = `
GAME: ${ctx.away_team} @ ${ctx.home_team}

${ctx.home_team} STATS:
- Record: ${homeTeam?.wins || '?'}-${homeTeam?.losses || '?'}
- Points per game: ${homeTeam?.points_per_game || 'N/A'}
- Opponent PPG allowed: ${homeTeam?.opponent_points_per_game || 'N/A'}
- Defensive rating: ${homeTeam?.defensive_rating || 'N/A'}
- Home record: ${homeTeam?.home_wins || '?'}-${homeTeam?.home_losses || '?'}
- Key injuries: ${homeInjuries?.map((i: any) => `${i.player_name} (${i.status})`).join(', ') || 'None reported'}

${ctx.away_team} STATS:
- Record: ${awayTeam?.wins || '?'}-${awayTeam?.losses || '?'}
- Points per game: ${awayTeam?.points_per_game || 'N/A'}
- Opponent PPG allowed: ${awayTeam?.opponent_points_per_game || 'N/A'}
- Defensive rating: ${awayTeam?.defensive_rating || 'N/A'}
- Away record: ${awayTeam?.away_wins || '?'}-${awayTeam?.away_losses || '?'}
- Key injuries: ${awayInjuries?.map((i: any) => `${i.player_name} (${i.status})`).join(', ') || 'None reported'}
      `.trim();
    }
  } catch (e) {
    console.error('Stats context fetch error:', e);
    statsContext = 'Live stats unavailable — using general knowledge';
  }

  const user = ctx.prediction_type === 'moneyline'
    ? `${statsContext}

Predict: ${ctx.predicted_outcome === 'home' ? ctx.home_team : ctx.away_team} to WIN
Home odds: ${ctx.home_odds} | Away odds: ${ctx.away_odds}
Statistical confidence 0-100.`
    : `${statsContext}

Prop: ${ctx.prop_type} ${ctx.predicted_outcome?.toUpperCase()} ${ctx.line}
Over: ${ctx.over_odds} | Under: ${ctx.under_odds}
Statistical confidence 0-100 that ${ctx.player_name} goes ${ctx.predicted_outcome?.toUpperCase()} ${ctx.line} ${ctx.prop_type}.`;

  const raw = await callClaude(system, user);
  try {
    const p = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}');
    return {
      score: Math.min(100, Math.max(0, p.score || 50)),
      reasoning: p.reasoning || 'Statistical analysis complete',
    };
  } catch {
    return { score: 50, reasoning: 'Statistical analysis inconclusive' };
  }
}

async function runMarketBrain(ctx: any) {
  const system = `You are a professional sports betting market analyst. Read betting lines as signals: sharp money, line movement, implied probabilities, consensus across books. Respond ONLY with valid JSON: {"score": 0-100, "reasoning": "2-3 sentences max"}`;
  const impliedProb = ctx.home_odds
    ? ctx.home_odds < 0 ? Math.abs(ctx.home_odds) / (Math.abs(ctx.home_odds) + 100) * 100 : 100 / (ctx.home_odds + 100) * 100
    : 50;
  const user = ctx.prediction_type === 'moneyline'
    ? `${ctx.away_team} @ ${ctx.home_team}. DK odds: Home ${ctx.home_odds} / Away ${ctx.away_odds}. Implied prob of predicted winner: ${impliedProb.toFixed(1)}%. Market confidence 0-100 that ${ctx.predicted_outcome === 'home' ? ctx.home_team : ctx.away_team} wins.`
    : `${ctx.player_name} ${ctx.prop_type} ${ctx.predicted_outcome?.toUpperCase()} ${ctx.line}. Over: ${ctx.over_odds}, Under: ${ctx.under_odds}. Market confidence 0-100.`;
  const raw = await callClaude(system, user);
  try {
    const p = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}');
    return { score: Math.min(100, Math.max(0, p.score || 50)), reasoning: p.reasoning || 'Market analysis complete' };
  } catch { return { score: 50, reasoning: 'Market analysis inconclusive' }; }
}

async function runContextBrain(ctx: any) {
  const system = `You are an NBA insider analyst. Assess qualitative factors: injuries, load management, motivation, revenge games, travel fatigue, coaching matchups, contract years, back-to-backs. Respond ONLY with valid JSON: {"score": 0-100, "reasoning": "2-3 sentences max"}`;
  const user = ctx.prediction_type === 'moneyline'
    ? `${ctx.away_team} @ ${ctx.home_team} on ${ctx.game_date}. Predict: ${ctx.predicted_outcome === 'home' ? ctx.home_team : ctx.away_team} wins. Contextual/situational confidence 0-100.`
    : `${ctx.player_name} (${ctx.team}) — ${ctx.prop_type} ${ctx.predicted_outcome?.toUpperCase()} ${ctx.line}. Game: ${ctx.away_team} @ ${ctx.home_team}. Context confidence 0-100.`;
  const raw = await callClaude(system, user);
  try {
    const p = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}');
    return { score: Math.min(100, Math.max(0, p.score || 50)), reasoning: p.reasoning || 'Context analysis complete' };
  } catch { return { score: 50, reasoning: 'Context analysis inconclusive' }; }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const { game_id, prop_id, prediction_type, predicted_outcome } = await req.json();
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    let ctx: any = { prediction_type, predicted_outcome };

    if (game_id) {
      const { data: game } = await supabase.from('sbo_games').select('*').eq('id', game_id).single();
      const { data: odds } = await supabase.from('sbo_odds').select('*').eq('game_id', game_id).eq('market_type', 'moneyline').eq('sportsbook', 'draftkings').order('fetched_at', { ascending: false }).limit(1);
      ctx = { ...ctx, ...game, home_odds: odds?.[0]?.home_odds, away_odds: odds?.[0]?.away_odds };
    }

    if (prop_id) {
      const { data: prop } = await supabase.from('sbo_player_props').select('*, sbo_games(*)').eq('id', prop_id).single();
      ctx = { ...ctx, ...prop, home_team: (prop as any).sbo_games?.home_team, away_team: (prop as any).sbo_games?.away_team, game_date: (prop as any).sbo_games?.game_date };
    }

    const [stats, market, context] = await Promise.all([
      runStatsBrain(ctx),
      runMarketBrain(ctx),
      runContextBrain(ctx),
    ]);

    const finalScore = Math.round(stats.score * 0.40 + market.score * 0.35 + context.score * 0.25);
    const tier = finalScore >= 85 ? 'elite' : finalScore >= 70 ? 'strong' : finalScore >= 55 ? 'moderate' : 'weak';

    const { data: prediction } = await supabase.from('sbo_predictions').insert({
      game_id: game_id || null,
      prop_id: prop_id || null,
      prediction_type,
      predicted_outcome,
      stats_brain_score: stats.score,
      stats_brain_reasoning: stats.reasoning,
      market_brain_score: market.score,
      market_brain_reasoning: market.reasoning,
      context_brain_score: context.score,
      context_brain_reasoning: context.reasoning,
      final_confidence: finalScore,
      confidence_tier: tier,
    }).select().single();

    await supabase.from('ai_instinct_log').insert({
      action_type: 'sbo_prediction_generated',
      reasoning: `${prediction_type} — ${predicted_outcome} — ${finalScore}% confidence (${tier})`,
      input_data: { game_id, prop_id, prediction_type },
      decision_path: { stats: stats.score, market: market.score, context: context.score, final: finalScore, tier },
    });

    return new Response(JSON.stringify({
      success: true,
      prediction_id: prediction?.id,
      final_confidence: finalScore,
      confidence_tier: tier,
      brains: { stats, market, context },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
