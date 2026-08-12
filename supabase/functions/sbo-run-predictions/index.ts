import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { deriveMoneylineConsensus, americanToImplied } from '../_shared/devigMoneyline.ts';
import { upsertMoneylineSignal } from '../_shared/sboSignals.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ═══════════════════════════════════════════════════════════
// SPORT_CONTEXT — sport-aware prompts for stats + context brains
// Market brain stays sport-neutral (reads odds, not sport context)
// ═══════════════════════════════════════════════════════════
const SPORT_CONTEXT: Record<string, { stats_role: string; context_role: string; key_signals: string }> = {
  nba: {
    stats_role: "You are an elite NBA statistical analyst.",
    context_role: "You are an NBA insider analyst.",
    key_signals: `Key accuracy signals:
Blocks are 91% predictive.
Steals are 83% predictive.
UNDER bets hit 68% of the time.
Consider: back-to-back schedule, home/away rest, pace matchup, injury impact on rotations.`,
  },
  wnba: {
    stats_role: "You are an elite WNBA statistical analyst.",
    context_role: "You are a WNBA insider analyst.",
    key_signals: `Key accuracy signals:
Usage rate and minutes load drive scoring props more than talent alone.
Short 12-player rotations mean injuries swing usage dramatically.
Back-to-backs and heavy travel legs suppress efficiency.
Pace matchup matters — the league's pace spread is wide.
Three-point volume is streaky; weight attempts over makes.`,
  },
  nfl: {
    stats_role: "You are an elite NFL statistical analyst.",
    context_role: "You are an NFL insider analyst.",
    key_signals: `Key accuracy signals:
Home field worth ~3 points.
Wind >15mph kills passing games.
Injury report is critical — Full/Limited/Out status matters.
Rest advantage: bye week team +4pts.
Short week favors home team.`,
  },
  mlb: {
    stats_role: "You are an elite MLB statistical analyst.",
    context_role: "You are an MLB insider analyst.",
    key_signals: `Key accuracy signals:
Starting pitcher ERA is #1 factor.
Bullpen usage last 72 hours.
Park factor affects run totals.
Platoon splits (L vs R matchup).
Day vs night game splits.
Wind direction affects HRs.`,
  },
  nhl: {
    stats_role: "You are an elite NHL statistical analyst.",
    context_role: "You are an NHL insider analyst.",
    key_signals: `Key accuracy signals:
Confirmed starting goalie critical.
Back-to-back games cause fatigue.
Power play efficiency matters.
Corsi possession % is predictive.
Home ice gives +10% win probability.`,
  },
  mma: {
    stats_role: "You are an elite MMA fight analyst.",
    context_role: "You are an MMA insider with camp connections.",
    key_signals: `Key accuracy signals:
Reach advantage in striking fights.
Grappling record vs striking record.
Weight cut difficulty and history.
Southpaw vs orthodox matchup.
Training camp reports critical.
5-round vs 3-round performance.`,
  },
};

function getSportCtx(sport_key: string) {
  return SPORT_CONTEXT[sport_key] ?? SPORT_CONTEXT['nba'];
}

// Use Lovable AI gateway instead of direct Anthropic (fixes IPv6 connection reset)
async function callAI(system: string, user: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.error('LOVABLE_API_KEY not configured');
    return '{"score": 50, "reasoning": "AI service not configured"}';
  }

  // PHASE 8F — Item 3: bound output + retry ONLY on transient provider errors.
  // Before: no max_tokens (unbounded output on a per-prop x 3-brains x 72-runs/day
  // path) and a catch-all retry that re-billed the ENTIRE call on parse errors and
  // on timeouts (a timeout may mean the request already succeeded server-side).
  const MAX_OUTPUT_TOKENS = 400;

  const body = JSON.stringify({
    model: 'google/gemini-2.5-flash',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    max_tokens: MAX_OUTPUT_TOKENS,
  });

  const post = async (signal?: AbortSignal) =>
    await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body,
      signal,
    });

  // PHASE 8F — Item 3.3: code-side truncation/size signal. No paid call; this only
  // reads the response we already paid for, so the first funded run can prove
  // whether 400 output tokens is enough.
  const readContent = (data: any): string => {
    const usage = data?.usage ?? null;
    const finish = data?.choices?.[0]?.finish_reason ?? null;
    const content = data?.choices?.[0]?.message?.content?.trim() || '';
    console.log(JSON.stringify({
      tag: 'sbo_ai_usage',
      fn: 'sbo-run-predictions',
      model: 'google/gemini-2.5-flash',
      max_tokens: MAX_OUTPUT_TOKENS,
      finish_reason: finish,
      output_chars: content.length,
      prompt_tokens: usage?.prompt_tokens ?? null,
      completion_tokens: usage?.completion_tokens ?? null,
    }));
    if (finish === 'length') {
      console.warn(`[sbo-run-predictions] OUTPUT TRUNCATED at max_tokens=${MAX_OUTPUT_TOKENS} — raise the cap`);
    }
    return content;
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

  let res: Response;
  try {
    res = await post(controller.signal);
  } catch (e) {
    clearTimeout(timeout);
    // Network failure or 30s timeout. NOT retried: the upstream call may have
    // completed and billed already. Fail closed with the neutral fallback.
    console.error('AI call failed (no retry — transport/timeout, may already be billed):', e);
    return '{"score": 50, "reasoning": "AI analysis unavailable — using fallback"}';
  }
  clearTimeout(timeout);

  // Retry ONLY on transient provider errors (429 rate limit / 5xx).
  if (res.status === 429 || res.status >= 500) {
    console.error(`AI transient error ${res.status} — retrying once`);
    await new Promise(r => setTimeout(r, 2000));
    try {
      const res2 = await post();
      if (!res2.ok) {
        console.error(`AI retry returned ${res2.status}`);
        return '{"score": 50, "reasoning": "AI analysis unavailable — using fallback"}';
      }
      return readContent(await res2.json());
    } catch (e2) {
      console.error('AI retry also failed:', e2);
      return '{"score": 50, "reasoning": "AI analysis unavailable — using fallback"}';
    }
  }

  if (!res.ok) {
    // 4xx (402 out-of-credits, 400 bad request, 401/403 auth) — NOT retryable.
    const errText = await res.text().catch(() => '');
    console.error(`AI non-retryable error ${res.status}: ${errText.slice(0, 300)}`);
    return '{"score": 50, "reasoning": "AI analysis unavailable — using fallback"}';
  }

  try {
    return readContent(await res.json());
  } catch (e) {
    // Parse failure of a SUCCESSFUL (already billed) response — never re-bill.
    console.error('AI response parse failed (no retry — already billed):', e);
    return '{"score": 50, "reasoning": "AI analysis unavailable — using fallback"}';
  }
}


async function runStatsBrain(ctx: any, supabase: any, calibrationText: string): Promise<{ score: number; reasoning: string; data_quality: string; ai_recommendation?: string; player_avg?: string; edge?: string }> {
  let statsContext = '';
  let dataQuality = 'odds_only';
  const sportCtx = getSportCtx(ctx.sport_key || 'nba');

  try {
    if (ctx.prediction_type === 'player_prop' && ctx.player_name) {
      const { data } = await supabase.functions.invoke('sbo-get-player-context', {
        body: {
          player_name: ctx.player_name,
          team: ctx.team,
          game_date: ctx.game_date?.split('T')[0] || new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }),
          prop_type: ctx.prop_type,
          opponent: ctx.home_team === ctx.team ? ctx.away_team : ctx.home_team,
          sport: ctx.sport_key || 'nba',
          player_id: ctx.player_id ?? null,
        },
      });
      if (data?.context_text) {
        statsContext = data.context_text;
        if (typeof data.data_quality === 'string') {
          // Sports with a real stats brain (MLB, Stage 2c) compute
          // data_quality per-player-per-prop-type and report it directly.
          dataQuality = data.data_quality;
          console.log(`data_quality from context fn: ${dataQuality} (resolution: ${data.resolution ?? 'n/a'})`);
        } else {
          // TRUTHFULNESS GUARD (NBA path): sbo-get-player-context ALWAYS returns a
          // non-empty context_text template (filled with N/A when no rows match).
          // Only claim 'full' when there is actually real stat data behind it.
          const recentValues = data.raw?.recent_values ?? [];
          const gamesPlayed = Number(data.raw?.season_stats?.games_played ?? 0);
          const hasRealStats = recentValues.length > 0 || gamesPlayed > 0;
          dataQuality = hasRealStats ? 'full' : 'odds_only';
        }
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
    const auditCalibration = calibrationText;

    const system = `${sportCtx.stats_role} You are working for the Dynasty OS SBO Engine. You must decide whether a player goes OVER or UNDER a given prop line based on actual statistics. Do NOT default to OVER. If the player's season average is below the line, lean UNDER. Respond ONLY with valid JSON.

${sportCtx.key_signals}

${auditCalibration}`;

    const propPrompt = `
PLAYER: ${ctx.player_name} (${ctx.team || 'Unknown'})
PROP: ${ctx.prop_type} line ${ctx.line}
ODDS: Over ${ctx.over_odds} / Under ${ctx.under_odds}
GAME: ${ctx.away_team || 'TBD'} @ ${ctx.home_team || 'TBD'}
SPORT: ${(ctx.sport_key || 'nba').toUpperCase()}

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

  const system = `${sportCtx.stats_role} You are given REAL current season data for tonight's game. Analyze the actual numbers provided — do not use general knowledge, use only the data given. Give a confidence score 0-100 based purely on the statistics.
If stats show N/A or are missing, acknowledge the gap and lower your confidence.

${sportCtx.key_signals}

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
  // Market brain stays sport-neutral — reads odds signals, not sport context
  const system = `You are a professional sports betting market analyst. Read betting lines as signals: sharp money, line movement, implied probabilities, consensus across books. Respond ONLY with valid JSON: {"score": 0-100, "reasoning": "2-3 sentences max"}`;
  // ═══ IMPLIED PROBABILITY OF THE SIDE ACTUALLY PICKED ═══
  // Previously this always computed the HOME implied probability regardless of
  // which side was predicted. Now: prefer the de-vigged multi-book consensus for
  // the derived side; fall back to that same side's single-book price.
  const side: 'home' | 'away' = ctx.predicted_outcome === 'away' ? 'away' : 'home';
  const sideOdds = Number(side === 'away' ? ctx.away_odds : ctx.home_odds);
  const impliedProb = ctx.devig
    ? (side === 'home' ? ctx.devig.home_prob : ctx.devig.away_prob) * 100
    : (Number.isFinite(sideOdds) ? americanToImplied(sideOdds) * 100 : 50);
  const consensusNote = ctx.devig
    ? ` De-vigged consensus across ${ctx.devig.books_used} book(s): ${ctx.home_team} ${(ctx.devig.home_prob * 100).toFixed(1)}% / ${ctx.away_team} ${(ctx.devig.away_prob * 100).toFixed(1)}%.`
    : '';
  const user = ctx.prediction_type === 'moneyline'
    ? `${ctx.away_team} @ ${ctx.home_team}. Odds: Home ${ctx.home_odds} / Away ${ctx.away_odds}.${consensusNote} Implied prob of predicted winner (${side === 'home' ? ctx.home_team : ctx.away_team}): ${impliedProb.toFixed(1)}%. Market confidence 0-100 that ${side === 'home' ? ctx.home_team : ctx.away_team} wins.`
    : `${ctx.player_name} ${ctx.prop_type} ${(ctx.final_recommendation || ctx.predicted_outcome || 'OVER').toUpperCase()} ${ctx.line}. Over: ${ctx.over_odds}, Under: ${ctx.under_odds}. Market confidence 0-100.`;
  const raw = await callAI(system, user);
  try {
    const p = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}');
    return { score: Math.min(100, Math.max(0, p.score || 50)), reasoning: p.reasoning || 'Market analysis complete' };
  } catch { return { score: 50, reasoning: 'Market analysis inconclusive' }; }
}

async function runContextBrain(ctx: any) {
  const sportCtx = getSportCtx(ctx.sport_key || 'nba');
  const system = `${sportCtx.context_role} Assess qualitative factors: injuries, load management, motivation, revenge games, travel fatigue, coaching matchups, contract years, rest/schedule spots.

${sportCtx.key_signals}

Respond ONLY with valid JSON: {"score": 0-100, "reasoning": "2-3 sentences max"}`;
  const user = ctx.prediction_type === 'moneyline'
    ? `${ctx.away_team} @ ${ctx.home_team} on ${ctx.game_date}. Sport: ${(ctx.sport_key || 'nba').toUpperCase()}. Predict: ${ctx.predicted_outcome === 'home' ? ctx.home_team : ctx.away_team} wins. Contextual/situational confidence 0-100.`
    : `${ctx.player_name} (${ctx.team}) — ${ctx.prop_type} ${(ctx.final_recommendation || ctx.predicted_outcome || 'OVER').toUpperCase()} ${ctx.line}. Sport: ${(ctx.sport_key || 'nba').toUpperCase()}. Game: ${ctx.away_team} @ ${ctx.home_team}. Context confidence 0-100.`;
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
        .select('id, final_confidence, confidence_tier, data_quality, predicted_outcome')
        .eq('game_id', game_id)
        .eq('prediction_type', 'moneyline')
        .gte('created_at', `${today}T00:00:00`)
        .maybeSingle();

      if (existingPred) {
        // Signal write is idempotent — keep it in sync even on a cache hit so a
        // game predicted before sbo_signals existed still gets its signal row.
        let cachedSignal: any = null;
        try {
          const { data: g } = await supabase
            .from('sbo_games')
            .select('home_team, away_team, game_date, sport_key')
            .eq('id', game_id)
            .maybeSingle();
          if (g) {
            cachedSignal = await upsertMoneylineSignal(supabase, {
              sport_key: g.sport_key,
              home_team: g.home_team,
              away_team: g.away_team,
              game_date: g.game_date,
              side: existingPred.predicted_outcome,
              internal_confidence: existingPred.final_confidence ?? 0,
            });
          }
        } catch (sigErr) {
          console.error('Non-fatal: cached sbo_signals upsert failed:', sigErr);
        }

        return new Response(JSON.stringify({
          success: true,
          prediction_id: existingPred.id,
          final_confidence: existingPred.final_confidence,
          confidence_tier: existingPred.confidence_tier,
          data_quality: existingPred.data_quality,
          predicted_outcome: existingPred.predicted_outcome,
          signal: cachedSignal,
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
      // ALL books for this game's moneyline — needed for the de-vigged consensus.
      const { data: allOdds } = await supabase
        .from('sbo_odds')
        .select('sportsbook, home_odds, away_odds, fetched_at')
        .eq('game_id', game_id)
        .eq('market_type', 'moneyline')
        .order('fetched_at', { ascending: false });

      const devig = deriveMoneylineConsensus(allOdds || []);
      const dk = (allOdds || []).find((o: any) => (o.sportsbook || '').toLowerCase() === 'draftkings');
      const anyBook = dk || (allOdds || [])[0];

      ctx = {
        ...ctx,
        ...game,
        home_odds: anyBook?.home_odds ?? null,
        away_odds: anyBook?.away_odds ?? null,
        devig,
      };

      if (devig) {
        console.log(
          `De-vig consensus (${devig.books_used} books): home ${(devig.home_prob * 100).toFixed(1)}% / away ${(devig.away_prob * 100).toFixed(1)}% → ${devig.predicted_outcome}`,
        );
      } else {
        console.log('No two-sided moneyline odds found — de-vig derivation unavailable');
      }
    }


    if (prop_id) {
      const { data: prop } = await supabase.from('sbo_player_props').select('*, sbo_games(*)').eq('id', prop_id).single();
      ctx = {
        ...ctx,
        ...prop,
        home_team: (prop as any).sbo_games?.home_team,
        away_team: (prop as any).sbo_games?.away_team,
        game_date: (prop as any).sbo_games?.game_date,
        game_id: (prop as any).game_id,
        // Prop's own sport_key wins if present, else fall back to parent game's sport_key
        sport_key: (prop as any).sport_key || (prop as any).sbo_games?.sport_key || ctx.sport_key,
      };
    }

    // ═══ DERIVE SPORT_KEY (default 'nba' — protects existing NBA flow) ═══
    const sport_key: string = (ctx.sport_key || 'nba').toLowerCase();
    ctx.sport_key = sport_key;
    console.log(`Prediction sport_key resolved: ${sport_key}`);

    // ═══ OPTION A: DERIVE THE MONEYLINE SIDE FROM DE-VIGGED MARKET CONSENSUS ═══
    // Replaces any caller-supplied (historically hardcoded 'home') side. Runs
    // BEFORE the brains so every prompt reasons about the real derived side.
    let derivedFromMarket = false;
    if (prediction_type === 'moneyline' && ctx.devig) {
      derivedFromMarket = true;
      ctx.predicted_outcome = ctx.devig.predicted_outcome;
    }

    // Run stats brain first for props to get AI recommendation
    const statsResult = await runStatsBrain(ctx, supabase, calibrationText);

    let finalOutcome = ctx.predicted_outcome ?? predicted_outcome;
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
    // Market-derived moneyline sides are, by construction, backed by odds only —
    // no stats feed selected the side. Label them 'odds_only' so the existing
    // 54-point clamp (unmodified) applies.
    const dataQuality = derivedFromMarket ? 'odds_only' : statsResult.data_quality;

    // ═══ WEIGHTS: prefer sbo_sports (learned_X ?? base_X), fallback to sbo_model_performance ═══
    let weights = { stats: 0.40, market: 0.35, context: 0.25, polymarket: 0.00 };
    let weightsSource: 'sbo_sports' | 'sbo_model_performance' | 'default' = 'default';

    const { data: sportRow } = await supabase
      .from('sbo_sports')
      .select('stats_weight, market_weight, context_weight, learned_stats_weight, learned_market_weight, learned_context_weight')
      .eq('sport_key', sport_key)
      .maybeSingle();

    if (sportRow) {
      let SW = Number(sportRow.learned_stats_weight ?? sportRow.stats_weight ?? 0.40);
      let MW = Number(sportRow.learned_market_weight ?? sportRow.market_weight ?? 0.35);
      let CW = Number(sportRow.learned_context_weight ?? sportRow.context_weight ?? 0.25);

      // sbo_sports stores weights as percentages (e.g. 40/35/25). Normalize to decimals if > 1.
      const sumRaw = SW + MW + CW;
      if (sumRaw > 1.5) {
        SW = SW / 100;
        MW = MW / 100;
        CW = CW / 100;
      }

      // Preserve existing polymarket weight logic — pull from sbo_model_performance
      const { data: activeConfig } = await supabase
        .from('sbo_model_performance')
        .select('polymarket_weight')
        .eq('is_active', true)
        .maybeSingle();

      weights = {
        stats: Number(SW),
        market: Number(MW),
        context: Number(CW),
        polymarket: Number(activeConfig?.polymarket_weight ?? 0.00),
      };
      weightsSource = 'sbo_sports';
    } else {
      // Secondary fallback: existing sbo_model_performance behavior
      const { data: activeConfig } = await supabase
        .from('sbo_model_performance')
        .select('stats_weight, market_weight, context_weight, polymarket_weight')
        .eq('is_active', true)
        .maybeSingle();

      weights = {
        stats: activeConfig?.stats_weight || 0.40,
        market: activeConfig?.market_weight || 0.35,
        context: activeConfig?.context_weight || 0.25,
        polymarket: activeConfig?.polymarket_weight || 0.00,
      };
      weightsSource = activeConfig ? 'sbo_model_performance' : 'default';
    }
    console.log(`Weights source: ${weightsSource} for sport ${sport_key}`, weights);

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

    // ═══ LIVE CALIBRATION ADJUSTMENT ═══
    if (calibrationData.length > 0) {
      const bucket = calibrationData.find(b => {
        const [low, high] = b.confidence_bucket.split('-').map(Number);
        return finalScore >= low && finalScore < high;
      });
      if (bucket && bucket.total_picks >= 10) {
        const cal = bucket.calibration_score;
        if (cal < 0.85) {
          const penalty = Math.round((1 - cal) * 15);
          const before = finalScore;
          finalScore = Math.max(50, finalScore - penalty);
          console.log(`Live calibration: ${bucket.confidence_bucket}% bucket overconfident (cal=${cal}), deflated ${before}→${finalScore}`);
        } else if (cal > 1.1 && finalScore < 87) {
          const bonus = Math.round((cal - 1) * 5);
          const before = finalScore;
          finalScore = Math.min(87, finalScore + bonus);
          console.log(`Live calibration: ${bucket.confidence_bucket}% bucket strong (cal=${cal}), boosted ${before}→${finalScore}`);
        }
      }
    }

    // ═══ HARD CEILING: odds_only can never present as moderate+ ═══
    // Applied AFTER all brains, penalties, bonuses and live calibration —
    // this is the final mutation of finalScore. Any future adjustment must
    // be added ABOVE this block, never below it.
    const ODDS_ONLY_MAX_CONFIDENCE = 65; // raised: strong odds-only signals may reach PLAY on their own
    if (dataQuality === 'odds_only' && finalScore > ODDS_ONLY_MAX_CONFIDENCE) {
      console.log(`odds_only hard cap: ${finalScore} → ${ODDS_ONLY_MAX_CONFIDENCE} (no real stats feed)`);
      finalScore = ODDS_ONLY_MAX_CONFIDENCE;
    }

    // Don't save predictions below 50% — they add noise
    if (finalScore < 50) {
      console.log(`Prediction below 50% threshold (${finalScore}%) — not saving`);
      return new Response(JSON.stringify({
        success: true,
        saved: false,
        skipped: true,
        reason: `Confidence ${finalScore}% below 50% minimum — prediction not saved`,
        confidence: finalScore,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const tier = finalScore >= 85 ? 'elite' : finalScore >= 70 ? 'strong' : finalScore >= 55 ? 'moderate' : 'weak';

    const { data: prediction, error: insertError } = await supabase.from('sbo_predictions').insert({
      game_id: game_id || null,
      prop_id: prop_id || null,
      prediction_type,
      predicted_outcome: finalOutcome,
      sport_key,
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
    if (insertError) {
      console.error('sbo_predictions insert failed:', insertError);
    }

    // ═══ GAME-LEVEL SIGNAL (sbo_signals) ═══
    // One row per game+pick_type, idempotent via the game-identity unique index.
    // Only moneyline game predictions produce a signal; props are prop-level.
    let signalResult: any = null;
    if (prediction?.id && prediction_type === 'moneyline' && game_id) {
      try {
        signalResult = await upsertMoneylineSignal(supabase, {
          sport_key,
          home_team: ctx.home_team,
          away_team: ctx.away_team,
          game_date: ctx.game_date,
          side: finalOutcome,
          internal_confidence: finalScore,
          odds: finalOutcome === 'home' ? ctx.home_odds : ctx.away_odds,
        });
        console.log('sbo_signals upsert:', JSON.stringify(signalResult));
      } catch (sigErr) {
        console.error('Non-fatal: sbo_signals upsert failed:', sigErr);
        signalResult = { skipped: true, reason: (sigErr as Error).message };
      }
    }

    // ═══ INCREMENT sbo_sports.total_predictions (non-fatal) ═══
    if (prediction?.id) {
      try {
        const { data: cur } = await supabase
          .from('sbo_sports')
          .select('total_predictions')
          .eq('sport_key', sport_key)
          .maybeSingle();
        if (cur) {
          await supabase
            .from('sbo_sports')
            .update({
              total_predictions: (cur.total_predictions || 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq('sport_key', sport_key);
        }
      } catch (counterErr) {
        console.error('Non-fatal: failed to increment sbo_sports.total_predictions:', counterErr);
      }
    }

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
            sport: sport_key.toUpperCase(),
          });
        }
      } catch (saveErr) {
        console.error('Auto-save to saved_picks failed:', saveErr);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      saved: !!prediction?.id,
      skipped: false,
      insert_error: insertError?.message ?? null,
      prediction_id: prediction?.id,
      sport_key,
      final_confidence: finalScore,
      confidence_tier: tier,
      data_quality: dataQuality,
      predicted_outcome: finalOutcome,
      outcome_source: derivedFromMarket ? 'devig_consensus' : 'caller',
      signal: signalResult,
      devig: ctx.devig ? {
        books_used: ctx.devig.books_used,
        home_prob: Number((ctx.devig.home_prob * 100).toFixed(2)),
        away_prob: Number((ctx.devig.away_prob * 100).toFixed(2)),
        books: ctx.devig.books.map((b: any) => ({
          sportsbook: b.sportsbook,
          home_odds: b.home_odds,
          away_odds: b.away_odds,
          vig: Number((b.vig * 100).toFixed(2)),
          home_prob: Number((b.home_prob * 100).toFixed(2)),
          away_prob: Number((b.away_prob * 100).toFixed(2)),
        })),
      } : null,
      weights_source: weightsSource,
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
