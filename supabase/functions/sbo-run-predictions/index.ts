import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Use Lovable AI gateway instead of direct Anthropic (fixes IPv6 connection reset)
async function callAI(system: string, user: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.error('LOVABLE_API_KEY not configured');
    return '{"score": 50, "reasoning": "AI service not configured"}';
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
  } catch (e) {
    clearTimeout(timeout);
    console.error('AI call failed, retrying once:', e);
    // Retry once after 2s
    await new Promise(r => setTimeout(r, 2000));
    try {
      const res2 = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
      const data2 = await res2.json();
      return data2.choices?.[0]?.message?.content?.trim() || '';
    } catch (e2) {
      console.error('AI retry also failed:', e2);
      return '{"score": 50, "reasoning": "AI analysis unavailable — using fallback"}';
    }
  }
}

async function runStatsBrain(ctx: any, supabase: any): Promise<{ score: number; reasoning: string; data_quality: string; ai_recommendation?: string; player_avg?: string; edge?: string }> {
  let statsContext = '';
  let dataQuality = 'odds_only';

  try {
    if (ctx.prediction_type === 'player_prop' && ctx.player_name) {
      const { data } = await supabase.functions.invoke('sbo-get-player-context', {
        body: {
          player_name: ctx.player_name,
          team: ctx.team,
          game_date: ctx.game_date?.split('T')[0] || new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }),
          prop_type: ctx.prop_type,
          opponent: ctx.home_team === ctx.team ? ctx.away_team : ctx.home_team,
        },
      });
      if (data?.context_text) {
        statsContext = data.context_text;
        dataQuality = 'full';
      }
    } else if (ctx.prediction_type === 'moneyline') {
      console.log('Looking up intel for game_id:', ctx.game_id, 'type:', typeof ctx.game_id);
      const { data: intel, error: intelError } = await supabase
        .from('sbo_game_intelligence')
        .select('*')
        .eq('game_id', String(ctx.game_id))
        .maybeSingle();

      console.log('Intel found:', !!intel, 'error:', intelError?.message);

      const hasRealIntel = intel && (
        (intel.offensive_rating_home && intel.offensive_rating_home > 0) ||
        (intel.home_record_home && intel.home_record_home !== 'null') ||
        (intel.pace_home && intel.pace_home > 0)
      );

      if (hasRealIntel) {
        dataQuality = 'full';
        statsContext = `
GAME: ${ctx.away_team} @ ${ctx.home_team}

=== REAL TEAM STATISTICS ===
${ctx.home_team}:
- Points per game: ${intel.offensive_rating_home ?? 'N/A'}
- Opponent PPG: ${intel.defensive_rating_home ?? 'N/A'}
- Home record: ${intel.home_record_home ?? 'N/A'}
- Last 10: ${intel.last_5_home ? JSON.stringify(intel.last_5_home) : 'N/A'}
- Pace: ${intel.pace_home ?? 'N/A'}
- Back to back: ${intel.back_to_back_home ? 'YES - fatigue risk' : 'No'}
- Rest days: ${intel.rest_days_home ?? 'N/A'}

${ctx.away_team}:
- Points per game: ${intel.offensive_rating_away ?? 'N/A'}
- Opponent PPG: ${intel.defensive_rating_away ?? 'N/A'}
- Away record: ${intel.away_record_away ?? 'N/A'}
- Last 10: ${intel.last_5_away ? JSON.stringify(intel.last_5_away) : 'N/A'}
- Pace: ${intel.pace_away ?? 'N/A'}
- Back to back: ${intel.back_to_back_away ? 'YES - fatigue risk' : 'No'}
- Rest days: ${intel.rest_days_away ?? 'N/A'}

Injuries: ${intel.injury_report?.length > 0
  ? intel.injury_report.map((i: any) => `${i.player} (${i.status})`).join(', ')
  : 'None reported'}
`.trim();
      } else {
        const homeLastWord = ctx.home_team?.split(' ').pop() || '';
        const awayLastWord = ctx.away_team?.split(' ').pop() || '';

        const { data: homeStats } = await supabase
          .from('sbo_team_stats')
          .select('*')
          .ilike('team_name', `%${homeLastWord}%`)
          .maybeSingle();

        const { data: awayStats } = await supabase
          .from('sbo_team_stats')
          .select('*')
          .ilike('team_name', `%${awayLastWord}%`)
          .maybeSingle();

        const hasTeamStats = (homeStats?.wins > 0 || homeStats?.points_per_game > 0) ||
                             (awayStats?.wins > 0 || awayStats?.points_per_game > 0);

        if (hasTeamStats) {
          dataQuality = 'partial';
          statsContext = `
GAME: ${ctx.away_team} @ ${ctx.home_team}

=== TEAM STATS (Season averages) ===
${ctx.home_team}:
- Record: ${homeStats?.wins ?? '?'}-${homeStats?.losses ?? '?'}
- Points per game: ${homeStats?.points_per_game > 0 ? homeStats.points_per_game : 'N/A'}
- Opponent PPG: ${homeStats?.opponent_points_per_game > 0 ? homeStats.opponent_points_per_game : 'N/A'}
- Home record: ${homeStats?.home_wins ?? '?'}-${homeStats?.home_losses ?? '?'}
- Offensive rating: ${homeStats?.offensive_rating > 0 ? homeStats.offensive_rating : 'N/A'}
- Defensive rating: ${homeStats?.defensive_rating > 0 ? homeStats.defensive_rating : 'N/A'}

${ctx.away_team}:
- Record: ${awayStats?.wins ?? '?'}-${awayStats?.losses ?? '?'}
- Points per game: ${awayStats?.points_per_game > 0 ? awayStats.points_per_game : 'N/A'}
- Opponent PPG: ${awayStats?.opponent_points_per_game > 0 ? awayStats.opponent_points_per_game : 'N/A'}
- Away record: ${awayStats?.away_wins ?? '?'}-${awayStats?.away_losses ?? '?'}
- Offensive rating: ${awayStats?.offensive_rating > 0 ? awayStats.offensive_rating : 'N/A'}
- Defensive rating: ${awayStats?.defensive_rating > 0 ? awayStats.defensive_rating : 'N/A'}
`.trim();
        } else {
          dataQuality = 'odds_only';
          statsContext = `GAME: ${ctx.away_team} @ ${ctx.home_team}
No real stats available. Base prediction on odds and context only. Cap confidence at 55.`;
        }
      }
    }
  } catch (e) {
    console.error('Stats context fetch error:', e);
    statsContext = 'Live stats unavailable — using general knowledge';
    dataQuality = 'odds_only';
  }

  if (ctx.prediction_type === 'player_prop') {
    // Build calibration hints dynamically from live sbo_calibration data
    const auditCalibration = calibrationText;

    const system = `You are an elite NBA prop analyst for Dynasty OS SBO Engine. You must decide whether a player goes OVER or UNDER a given prop line based on actual statistics. Do NOT default to OVER. If the player's season average is below the line, lean UNDER. Respond ONLY with valid JSON.

${auditCalibration}`;

    const propPrompt = `
PLAYER: ${ctx.player_name} (${ctx.team || 'Unknown'})
PROP: ${ctx.prop_type} line ${ctx.line}
ODDS: Over ${ctx.over_odds} / Under ${ctx.under_odds}
GAME: ${ctx.away_team || 'TBD'} @ ${ctx.home_team || 'TBD'}

${statsContext || 'No detailed stats available.'}

Analyze whether this player will go OVER or UNDER ${ctx.line} ${ctx.prop_type}.

Rules:
1. If player's season average for this stat is more than 20% below the line → pick UNDER
2. If player's season average is above the line → lean OVER
3. If line is near the average → analyze matchup context
4. Do NOT default to OVER — base your pick on actual numbers
5. If this is a Pts+Ast or Pts+Reb combo prop, lower confidence by 10 points (historically 45-46%)
6. If recommending UNDER, you may add 5 confidence points (historically 68% accurate)
7. Cap maximum confidence at 87%

Return ONLY valid JSON:
{
  "recommendation": "OVER" or "UNDER",
  "score": 0-100,
  "player_avg": "player's season average for this stat type",
  "edge": "specific reason with numbers",
  "reasoning": "2-3 sentence analysis citing actual numbers"
}`;

    const raw = await callAI(system, propPrompt);
    try {
      const p = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}');
      let score = Math.min(100, Math.max(0, p.score || 50));
      if (dataQuality === 'odds_only' && score > 55) score = 55;
      const recommendation = (p.recommendation || 'OVER').toUpperCase();
      return {
        score,
        reasoning: p.reasoning || 'Statistical analysis complete',
        data_quality: dataQuality,
        ai_recommendation: recommendation === 'UNDER' ? 'under' : 'over',
        player_avg: p.player_avg || '',
        edge: p.edge || '',
      };
    } catch {
      return { score: 50, reasoning: 'Statistical analysis inconclusive', data_quality: dataQuality, ai_recommendation: 'over' };
    }
  }

  const system = `You are a professional NBA statistical analyst. You are given REAL current season data for tonight's game. Analyze the actual numbers provided — do not use general knowledge, use only the data given. Give a confidence score 0-100 based purely on the statistics.
If stats show N/A or are missing, acknowledge the gap and lower your confidence.

Respond ONLY with valid JSON: {"score": 0-100, "reasoning": "2-3 sentences referencing the actual stats provided"}`;

  const user = `${statsContext}

Predict: ${ctx.predicted_outcome === 'home' ? ctx.home_team : ctx.away_team} to WIN
Home odds: ${ctx.home_odds} | Away odds: ${ctx.away_odds}
${dataQuality === 'odds_only' ? 'WARNING: No real stats available. Cap your confidence at 55 maximum.' : ''}
Statistical confidence 0-100.`;

  const raw = await callAI(system, user);
  try {
    const p = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}');
    let score = Math.min(100, Math.max(0, p.score || 50));
    if (dataQuality === 'odds_only' && score > 55) score = 55;
    return {
      score,
      reasoning: p.reasoning || 'Statistical analysis complete',
      data_quality: dataQuality,
    };
  } catch {
    return { score: 50, reasoning: 'Statistical analysis inconclusive', data_quality: dataQuality };
  }
}

async function runMarketBrain(ctx: any) {
  const system = `You are a professional sports betting market analyst. Read betting lines as signals: sharp money, line movement, implied probabilities, consensus across books. Respond ONLY with valid JSON: {"score": 0-100, "reasoning": "2-3 sentences max"}`;
  const impliedProb = ctx.home_odds
    ? ctx.home_odds < 0 ? Math.abs(ctx.home_odds) / (Math.abs(ctx.home_odds) + 100) * 100 : 100 / (ctx.home_odds + 100) * 100
    : 50;
  const user = ctx.prediction_type === 'moneyline'
    ? `${ctx.away_team} @ ${ctx.home_team}. DK odds: Home ${ctx.home_odds} / Away ${ctx.away_odds}. Implied prob of predicted winner: ${impliedProb.toFixed(1)}%. Market confidence 0-100 that ${ctx.predicted_outcome === 'home' ? ctx.home_team : ctx.away_team} wins.`
    : `${ctx.player_name} ${ctx.prop_type} ${(ctx.final_recommendation || ctx.predicted_outcome || 'OVER').toUpperCase()} ${ctx.line}. Over: ${ctx.over_odds}, Under: ${ctx.under_odds}. Market confidence 0-100.`;
  const raw = await callAI(system, user);
  try {
    const p = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}');
    return { score: Math.min(100, Math.max(0, p.score || 50)), reasoning: p.reasoning || 'Market analysis complete' };
  } catch { return { score: 50, reasoning: 'Market analysis inconclusive' }; }
}

async function runContextBrain(ctx: any) {
  const system = `You are an NBA insider analyst. Assess qualitative factors: injuries, load management, motivation, revenge games, travel fatigue, coaching matchups, contract years, back-to-backs. Respond ONLY with valid JSON: {"score": 0-100, "reasoning": "2-3 sentences max"}`;
  const user = ctx.prediction_type === 'moneyline'
    ? `${ctx.away_team} @ ${ctx.home_team} on ${ctx.game_date}. Predict: ${ctx.predicted_outcome === 'home' ? ctx.home_team : ctx.away_team} wins. Contextual/situational confidence 0-100.`
    : `${ctx.player_name} (${ctx.team}) — ${ctx.prop_type} ${(ctx.final_recommendation || ctx.predicted_outcome || 'OVER').toUpperCase()} ${ctx.line}. Game: ${ctx.away_team} @ ${ctx.home_team}. Context confidence 0-100.`;
  const raw = await callAI(system, user);
  try {
    const p = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}');
    return { score: Math.min(100, Math.max(0, p.score || 50)), reasoning: p.reasoning || 'Context analysis complete' };
  } catch { return { score: 50, reasoning: 'Context analysis inconclusive' }; }
}

async function runPolymarketBrain(
  ctx: any,
  supabase: any
): Promise<{ score: number; reasoning: string; has_data: boolean }> {
  const { data: markets } = await supabase
    .from('sbo_polymarket')
    .select('*')
    .eq('game_id', ctx.game_id || null)
    .eq('status', 'open')
    .order('volume_usd', { ascending: false })
    .limit(3);

  if (!markets?.length || !ctx.game_id) {
    return { score: 50, reasoning: 'No Polymarket data available for this game', has_data: false };
  }

  const bestMarket = markets[0];
  const volumeUSD = bestMarket.volume_usd || 0;

  if (volumeUSD < 1000) {
    return { score: 50, reasoning: `Polymarket has low volume ($${volumeUSD.toFixed(0)}) — insufficient signal`, has_data: false };
  }

  let marketPrice = 0.5;
  let interpretation = '';

  if (ctx.prediction_type === 'moneyline') {
    if (ctx.predicted_outcome === 'home' && bestMarket.home_team_price) {
      marketPrice = bestMarket.home_team_price;
      interpretation = `Polymarket gives ${ctx.home_team} a ${(marketPrice * 100).toFixed(1)}% win probability`;
    } else if (ctx.predicted_outcome === 'away' && bestMarket.away_team_price) {
      marketPrice = bestMarket.away_team_price;
      interpretation = `Polymarket gives ${ctx.away_team} a ${(marketPrice * 100).toFixed(1)}% win probability`;
    } else if (bestMarket.outcome_yes_price) {
      marketPrice = bestMarket.outcome_yes_price;
      interpretation = `Polymarket YES price: ${(marketPrice * 100).toFixed(1)}%`;
    }
  }

  const volumeWeight = Math.min(Math.log10(Math.max(volumeUSD, 1000)) / 5, 1.0);
  const rawScore = marketPrice * 100;
  const weightedScore = Math.round(50 + (rawScore - 50) * volumeWeight);
  const finalScore = Math.min(100, Math.max(0, weightedScore));

  await supabase.from('sbo_polymarket_signals').insert({
    market_id: bestMarket.market_id,
    signal_strength: finalScore,
    price_used: marketPrice,
    volume_used: volumeUSD,
    interpretation,
  }).then(() => {}).catch(() => {});

  return {
    score: finalScore,
    reasoning: `${interpretation}. Volume: $${(volumeUSD / 1000).toFixed(0)}k real money. ${
      volumeUSD > 50000 ? 'High volume = strong signal.'
        : volumeUSD > 10000 ? 'Moderate volume = reliable signal.'
        : 'Lower volume — signal weighted accordingly.'
    }`,
    has_data: true,
  };
}

serve(async (req) => {
  console.log('Function started — sbo-run-predictions');

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Validate required env vars
    const missingVars = ['LOVABLE_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
      .filter(k => !Deno.env.get(k));
    if (missingVars.length > 0) {
      return new Response(JSON.stringify({
        error: `Missing required environment variables: ${missingVars.join(', ')}`,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { game_id, prop_id, prediction_type, predicted_outcome, force_rerun } = await req.json();
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // ═══ LIVE CALIBRATION: Read from sbo_calibration table ═══
    let calibrationData: Array<{ confidence_bucket: string; actual_accuracy: number; calibration_score: number; total_picks: number }> = [];
    let calibrationText = '';
    try {
      const { data: calRows } = await supabase
        .from('sbo_calibration')
        .select('confidence_bucket, actual_accuracy, calibration_score, total_picks')
        .order('confidence_bucket');
      calibrationData = calRows || [];

      if (calibrationData.length > 0) {
        const totalVerified = calibrationData.reduce((s, r) => s + r.total_picks, 0);
        const bucketLines = calibrationData.map(b => {
          const status = b.calibration_score >= 1.1 ? '🔥 STRONG' :
                         b.calibration_score >= 0.95 ? '✅ CALIBRATED' :
                         b.calibration_score >= 0.80 ? '⚠️ OVERCONFIDENT' : '🚨 UNRELIABLE';
          return `- ${b.confidence_bucket}% bucket: actual ${b.actual_accuracy}% accuracy (${b.total_picks} picks) — ${status}`;
        }).join('\n');

        calibrationText = `
LIVE SYSTEM CALIBRATION (based on ${totalVerified} verified predictions — auto-updated):
${bucketLines}

CRITICAL RULES FROM CALIBRATION DATA:
- 80-90% confidence range has ${calibrationData.find(b => b.confidence_bucket === '80-90')?.actual_accuracy || 'N/A'}% actual accuracy — this is the sweet spot.
- 65-75% confidence range is OVERCONFIDENT — actual accuracy is only ~50%. If your analysis lands here, either find stronger evidence to push higher or lower your score.
- Cap confidence at 87% maximum to stay in the proven sweet spot.
- Minimum confidence to save: 50%.
- Market Brain is the strongest signal — weight market analysis heavily.
`;
      } else {
        calibrationText = 'No calibration data available yet. Use conservative confidence estimates. Cap at 87%.';
      }
    } catch (calErr) {
      console.error('Failed to load calibration:', calErr);
      calibrationText = 'Calibration data unavailable. Use conservative estimates. Cap at 87%.';
    }

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    // Cache check — moneyline
    if (game_id && prediction_type === 'moneyline' && !force_rerun) {
      const { data: existingPred } = await supabase
        .from('sbo_predictions')
        .select('id, final_confidence, confidence_tier, data_quality')
        .eq('game_id', game_id)
        .eq('prediction_type', 'moneyline')
        .gte('created_at', `${today}T00:00:00`)
        .maybeSingle();

      if (existingPred) {
        return new Response(JSON.stringify({
          success: true,
          prediction_id: existingPred.id,
          final_confidence: existingPred.final_confidence,
          confidence_tier: existingPred.confidence_tier,
          data_quality: existingPred.data_quality,
          source: 'cache',
          message: 'Prediction already exists for this game today',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Cache check — props
    if (prop_id) {
      const { data: existingPropPred } = await supabase
        .from('sbo_predictions')
        .select('id, final_confidence, confidence_tier, data_quality')
        .eq('prop_id', prop_id)
        .gte('created_at', `${today}T00:00:00`)
        .maybeSingle();

      if (existingPropPred) {
        return new Response(JSON.stringify({
          success: true,
          prediction_id: existingPropPred.id,
          final_confidence: existingPropPred.final_confidence,
          source: 'cache',
          message: 'Prop already analyzed today',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    let ctx: any = { prediction_type, predicted_outcome, game_id };

    if (game_id) {
      const { data: game } = await supabase.from('sbo_games').select('*').eq('id', game_id).single();
      const { data: odds } = await supabase.from('sbo_odds').select('*').eq('game_id', game_id).eq('market_type', 'moneyline').eq('sportsbook', 'draftkings').order('fetched_at', { ascending: false }).limit(1);
      ctx = { ...ctx, ...game, home_odds: odds?.[0]?.home_odds, away_odds: odds?.[0]?.away_odds };
    }

    if (prop_id) {
      const { data: prop } = await supabase.from('sbo_player_props').select('*, sbo_games(*)').eq('id', prop_id).single();
      ctx = { ...ctx, ...prop, home_team: (prop as any).sbo_games?.home_team, away_team: (prop as any).sbo_games?.away_team, game_date: (prop as any).sbo_games?.game_date, game_id: (prop as any).game_id };
    }

    // Run stats brain first for props to get AI recommendation
    const statsResult = await runStatsBrain(ctx, supabase);

    let finalOutcome = predicted_outcome;
    if (prediction_type === 'player_prop' && statsResult.ai_recommendation) {
      finalOutcome = statsResult.ai_recommendation;
      ctx.predicted_outcome = finalOutcome;
      ctx.final_recommendation = finalOutcome;
    }

    // Run remaining brains in parallel
    const [market, context, polyResult] = await Promise.all([
      runMarketBrain(ctx),
      runContextBrain(ctx),
      runPolymarketBrain(ctx, supabase),
    ]);

    const stats = { score: statsResult.score, reasoning: statsResult.reasoning };
    const dataQuality = statsResult.data_quality;

    const { data: activeConfig } = await supabase
      .from('sbo_model_performance')
      .select('stats_weight, market_weight, context_weight, polymarket_weight')
      .eq('is_active', true)
      .maybeSingle();

    const weights = {
      stats: activeConfig?.stats_weight || 0.40,
      market: activeConfig?.market_weight || 0.35,
      context: activeConfig?.context_weight || 0.25,
      polymarket: activeConfig?.polymarket_weight || 0.00,
    };

    let finalScore = polyResult.has_data
      ? Math.round(
          stats.score * weights.stats +
          market.score * weights.market +
          context.score * weights.context +
          polyResult.score * weights.polymarket
        )
      : Math.round(
          stats.score * (weights.stats / (1 - weights.polymarket)) +
          market.score * (weights.market / (1 - weights.polymarket)) +
          context.score * (weights.context / (1 - weights.polymarket))
        );

    // ═══ AUDIT-DRIVEN CALIBRATION ═══
    if (prediction_type === 'player_prop') {
      const pt = (ctx.prop_type || '').toLowerCase().replace(/[\s_\-+]/g, '');
      // Combo prop penalty (Pts+Ast 45%, Pts+Reb 46% historically)
      if (['ptsast', 'pointsassists', 'pa', 'ptsreb', 'pointsrebounds', 'pr'].includes(pt)) {
        finalScore = Math.max(45, finalScore - 10);
        console.log(`Combo prop penalty applied: ${ctx.prop_type} → ${finalScore}%`);
      }
      // UNDER bonus (68% hist. accuracy)
      if (finalOutcome === 'under' && finalScore < 87) {
        finalScore = Math.min(87, finalScore + 5);
      }
      // Cap at 87% to avoid overconfidence
      if (finalScore > 87) {
        finalScore = 87;
        console.log('Confidence capped at 87% (audit calibration)');
      }
    }

    // Don't save predictions below 50% — they add noise
    if (finalScore < 50) {
      console.log(`Prediction below 50% threshold (${finalScore}%) — not saving`);
      return new Response(JSON.stringify({
        success: false,
        reason: `Confidence ${finalScore}% below 50% minimum — prediction not saved`,
        confidence: finalScore,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const tier = finalScore >= 85 ? 'elite' : finalScore >= 70 ? 'strong' : finalScore >= 55 ? 'moderate' : 'weak';

    const { data: prediction } = await supabase.from('sbo_predictions').insert({
      game_id: game_id || null,
      prop_id: prop_id || null,
      prediction_type,
      predicted_outcome: finalOutcome,
      stats_brain_score: stats.score,
      stats_brain_reasoning: stats.reasoning,
      market_brain_score: market.score,
      market_brain_reasoning: market.reasoning,
      context_brain_score: context.score,
      context_brain_reasoning: context.reasoning,
      polymarket_brain_score: polyResult.has_data ? polyResult.score : null,
      polymarket_brain_reasoning: polyResult.reasoning,
      brain_count: polyResult.has_data ? 4 : 3,
      final_confidence: finalScore,
      confidence_tier: tier,
      weights_used: weights,
      data_quality: dataQuality,
    }).select().single();

    // AUTO-SAVE to sbo_saved_picks
    if (prediction?.id) {
      try {
        const label = prediction_type === 'player_prop'
          ? `${ctx.player_name} ${(finalOutcome || 'over').toUpperCase()} ${ctx.line} ${ctx.prop_type}`
          : `${finalOutcome === 'home' ? ctx.home_team : ctx.away_team} ML`;

        const detail = prediction_type === 'player_prop'
          ? `${ctx.prop_type} line: ${ctx.line} · AI avg: ${statsResult.player_avg || 'N/A'} · ${statsResult.edge || ''}`
          : `${ctx.away_team} @ ${ctx.home_team} · Confidence: ${finalScore}%`;

        const odds = prediction_type === 'player_prop'
          ? (finalOutcome === 'over' ? ctx.over_odds : ctx.under_odds)
          : (finalOutcome === 'home' ? ctx.home_odds : ctx.away_odds);

        const { data: alreadySaved } = await supabase
          .from('sbo_saved_picks')
          .select('id')
          .eq('source_id', prediction.id)
          .maybeSingle();

        if (!alreadySaved) {
          const pickDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
          await supabase.from('sbo_saved_picks').insert({
            pick_type: prediction_type === 'player_prop' ? 'prop' : 'game',
            label,
            detail: detail || '',
            odds: String(odds || '-110'),
            ai_analysis: stats.reasoning || '',
            confidence: finalScore,
            source_table: 'sbo_predictions',
            source_id: prediction.id,
            result: 'pending',
            pick_date: pickDate,
            game_date: ctx.game_date ? new Date(ctx.game_date).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) : pickDate,
            sport: 'NBA',
          });
        }
      } catch (saveErr) {
        console.error('Auto-save to saved_picks failed:', saveErr);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      prediction_id: prediction?.id,
      final_confidence: finalScore,
      confidence_tier: tier,
      data_quality: dataQuality,
      predicted_outcome: finalOutcome,
      brains: { stats, market, context, polymarket: polyResult },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('sbo-run-predictions fatal error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
