import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function normalizePropType(raw: string): string {
  const map: Record<string, string> = {
    points: "Points", pts: "Points", player_points: "Points",
    rebounds: "Rebounds", reb: "Rebounds",
    assists: "Assists", ast: "Assists",
    threes: "3-Pointers", three_pointers: "3-Pointers", threes_made: "3-Pointers", player_threes: "3-Pointers",
    blocks: "Blocks", blk: "Blocks", blocked_shots: "Blocks",
    steals: "Steals", stl: "Steals",
    turnovers: "Turnovers", tov: "Turnovers",
    pra: "Pts+Reb+Ast", pts_reb_ast: "Pts+Reb+Ast",
    pts_reb: "Pts+Reb", pr: "Pts+Reb",
    pts_ast: "Pts+Ast", pa: "Pts+Ast",
    reb_ast: "Reb+Ast", ra: "Reb+Ast",
    blks_stls: "Blks+Stls",
    fantasy_points: "Fantasy", minutes: "Minutes",
  };
  return map[(raw || "").toLowerCase().trim()] || raw;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Fetch ALL verified predictions with full context
    const { data: allVerified, error } = await supabase
      .from("sbo_results_verification")
      .select(`
        id, verdict, actual_value, actual_result, verified_at,
        prediction_id,
        sbo_predictions(
          id, prediction_type, predicted_outcome, final_confidence,
          confidence_tier, data_quality,
          stats_brain_score, market_brain_score, context_brain_score,
          prop_type, prop_id, game_id
        )
      `)
      .in("verdict", ["correct", "incorrect", "push"])
      .limit(1000);

    if (error) throw error;

    const predictions = (allVerified || []).map((v: any) => ({
      ...v,
      pred: v.sbo_predictions,
    }));

    const total = predictions.length;
    const correct = predictions.filter((p: any) => p.verdict === "correct").length;
    const incorrect = predictions.filter((p: any) => p.verdict === "incorrect").length;
    const pushes = predictions.filter((p: any) => p.verdict === "push").length;
    const accuracy = total > 0 ? Math.round((correct / (correct + incorrect)) * 1000) / 10 : 0;

    // ═══ ANALYSIS 1: ACCURACY BY CONFIDENCE TIER ═══
    const byTier: Record<string, { correct: number; incorrect: number; total: number }> = {};
    for (const p of predictions) {
      const tier = p.pred?.confidence_tier || "unknown";
      if (!byTier[tier]) byTier[tier] = { correct: 0, incorrect: 0, total: 0 };
      byTier[tier].total++;
      if (p.verdict === "correct") byTier[tier].correct++;
      else if (p.verdict === "incorrect") byTier[tier].incorrect++;
    }

    // ═══ ANALYSIS 2: ACCURACY BY CONFIDENCE RANGE ═══
    const byConfRange: Record<string, { correct: number; incorrect: number }> = {
      "90-100": { correct: 0, incorrect: 0 },
      "80-89": { correct: 0, incorrect: 0 },
      "70-79": { correct: 0, incorrect: 0 },
      "60-69": { correct: 0, incorrect: 0 },
      "50-59": { correct: 0, incorrect: 0 },
      "below-50": { correct: 0, incorrect: 0 },
    };
    for (const p of predictions) {
      const conf = p.pred?.final_confidence || 0;
      const range = conf >= 90 ? "90-100" : conf >= 80 ? "80-89" : conf >= 70 ? "70-79" :
        conf >= 60 ? "60-69" : conf >= 50 ? "50-59" : "below-50";
      if (p.verdict === "correct") byConfRange[range].correct++;
      else if (p.verdict === "incorrect") byConfRange[range].incorrect++;
    }

    // ═══ ANALYSIS 3: ACCURACY BY DATA QUALITY ═══
    const byDataQuality: Record<string, { correct: number; incorrect: number }> = {};
    for (const p of predictions) {
      const dq = p.pred?.data_quality || "unknown";
      if (!byDataQuality[dq]) byDataQuality[dq] = { correct: 0, incorrect: 0 };
      if (p.verdict === "correct") byDataQuality[dq].correct++;
      else if (p.verdict === "incorrect") byDataQuality[dq].incorrect++;
    }

    // ═══ ANALYSIS 4: ACCURACY BY PROP TYPE ═══
    const byPropType: Record<string, { correct: number; incorrect: number }> = {};
    const propPreds = predictions.filter((p: any) => p.pred?.prediction_type === "player_prop");
    for (const p of propPreds) {
      const pt = normalizePropType(p.pred?.prop_type || "unknown");
      if (!byPropType[pt]) byPropType[pt] = { correct: 0, incorrect: 0 };
      if (p.verdict === "correct") byPropType[pt].correct++;
      else if (p.verdict === "incorrect") byPropType[pt].incorrect++;
    }

    // ═══ ANALYSIS 5: BRAIN SCORE CORRELATION ═══
    const brainCorrelation = {
      stats: { correct_avg: 0, incorrect_avg: 0 },
      market: { correct_avg: 0, incorrect_avg: 0 },
      context: { correct_avg: 0, incorrect_avg: 0 },
    };
    const correctPreds = predictions.filter((p: any) => p.verdict === "correct" && p.pred?.stats_brain_score != null);
    const incorrectPreds = predictions.filter((p: any) => p.verdict === "incorrect" && p.pred?.stats_brain_score != null);

    if (correctPreds.length > 0) {
      brainCorrelation.stats.correct_avg = Math.round(correctPreds.reduce((s: number, p: any) => s + (p.pred?.stats_brain_score || 0), 0) / correctPreds.length);
      brainCorrelation.market.correct_avg = Math.round(correctPreds.reduce((s: number, p: any) => s + (p.pred?.market_brain_score || 0), 0) / correctPreds.length);
      brainCorrelation.context.correct_avg = Math.round(correctPreds.reduce((s: number, p: any) => s + (p.pred?.context_brain_score || 0), 0) / correctPreds.length);
    }
    if (incorrectPreds.length > 0) {
      brainCorrelation.stats.incorrect_avg = Math.round(incorrectPreds.reduce((s: number, p: any) => s + (p.pred?.stats_brain_score || 0), 0) / incorrectPreds.length);
      brainCorrelation.market.incorrect_avg = Math.round(incorrectPreds.reduce((s: number, p: any) => s + (p.pred?.market_brain_score || 0), 0) / incorrectPreds.length);
      brainCorrelation.context.incorrect_avg = Math.round(incorrectPreds.reduce((s: number, p: any) => s + (p.pred?.context_brain_score || 0), 0) / incorrectPreds.length);
    }

    // ═══ ANALYSIS 6: OVER vs UNDER ACCURACY ═══
    const overUnderAccuracy = {
      over: { correct: 0, incorrect: 0 },
      under: { correct: 0, incorrect: 0 },
    };
    for (const p of propPreds) {
      const pick = (p.pred?.predicted_outcome || "").toLowerCase();
      if (pick === "over" || pick === "under") {
        if (p.verdict === "correct") overUnderAccuracy[pick as "over" | "under"].correct++;
        else if (p.verdict === "incorrect") overUnderAccuracy[pick as "over" | "under"].incorrect++;
      }
    }

    // ═══ ANALYSIS 7: GAME vs PROP ACCURACY ═══
    const gamePreds = predictions.filter((p: any) => p.pred?.prediction_type === "moneyline");
    const gameCorrect = gamePreds.filter((p: any) => p.verdict === "correct").length;
    const gameIncorrect = gamePreds.filter((p: any) => p.verdict === "incorrect").length;
    const propCorrect = propPreds.filter((p: any) => p.verdict === "correct").length;
    const propIncorrect = propPreds.filter((p: any) => p.verdict === "incorrect").length;

    // ═══ DERIVED: SWEET SPOT, BEST/WORST TYPES ═══
    const sweetSpot = Object.entries(byConfRange)
      .map(([range, stats]) => {
        const t = stats.correct + stats.incorrect;
        return { range, ...stats, total: t, accuracy: t > 0 ? Math.round(stats.correct / t * 100) : 0 };
      })
      .filter(s => s.total >= 5)
      .sort((a, b) => b.accuracy - a.accuracy)[0] || null;

    const propTypeStats = Object.entries(byPropType)
      .map(([type, stats]) => {
        const t = stats.correct + stats.incorrect;
        return { type, ...stats, total: t, accuracy: t > 0 ? Math.round(stats.correct / t * 100) : 0 };
      })
      .filter(s => s.total >= 3)
      .sort((a, b) => b.accuracy - a.accuracy);

    const bestPropTypes = propTypeStats.slice(0, 5);
    const worstPropTypes = [...propTypeStats].sort((a, b) => a.accuracy - b.accuracy).slice(0, 3);

    // ═══ OPTIMAL WEIGHTS ═══
    const statsDiff = brainCorrelation.stats.correct_avg - brainCorrelation.stats.incorrect_avg;
    const marketDiff = brainCorrelation.market.correct_avg - brainCorrelation.market.incorrect_avg;
    const contextDiff = brainCorrelation.context.correct_avg - brainCorrelation.context.incorrect_avg;

    const rawStats = statsDiff > 0 ? 0.40 + (statsDiff / 100) * 0.1 : 0.35;
    const rawMarket = marketDiff > 0 ? 0.35 + (marketDiff / 100) * 0.05 : 0.30;
    const rawContext = contextDiff > 0 ? 0.25 + (contextDiff / 100) * 0.05 : 0.25;
    const sumW = rawStats + rawMarket + rawContext;
    const optimalWeights = {
      stats: Math.round((rawStats / sumW) * 100) / 100,
      market: Math.round((rawMarket / sumW) * 100) / 100,
      context: Math.round((1 - Math.round((rawStats / sumW) * 100) / 100 - Math.round((rawMarket / sumW) * 100) / 100) * 100) / 100,
    };

    // ═══ RECOMMENDATIONS ═══
    const recommendations: string[] = [];

    for (const [tier, data] of Object.entries(byTier)) {
      const t = data.correct + data.incorrect;
      if (t < 5) continue;
      const acc = Math.round(data.correct / t * 100);
      if (tier === "weak" && acc < 45) {
        recommendations.push(`🔴 STOP PLAYING WEAK picks — ${acc}% accuracy on ${t} picks is below breakeven. Set minimum confidence to 60%.`);
      }
      if (tier === "elite" && acc >= 70) {
        recommendations.push(`🔥 ELITE tier is hitting at ${acc}% on ${t} picks — prioritize these and increase unit size.`);
      }
    }

    const bestBrain = statsDiff >= marketDiff && statsDiff >= contextDiff ? "Stats"
      : marketDiff >= contextDiff ? "Market" : "Context";
    const bestGap = Math.max(statsDiff, marketDiff, contextDiff);
    if (bestGap > 0) {
      recommendations.push(`🧠 ${bestBrain} Brain is the strongest predictor — correct picks average ${bestGap} points higher. Consider increasing ${bestBrain} Brain weight.`);
    }

    for (const wt of worstPropTypes) {
      if (wt.accuracy < 50 && wt.total >= 5) {
        recommendations.push(`❌ FADE ${wt.type} props — only ${wt.accuracy}% on ${wt.total} predictions. Below coin-flip.`);
      }
    }
    for (const bt of bestPropTypes.slice(0, 3)) {
      if (bt.accuracy >= 65 && bt.total >= 5) {
        recommendations.push(`✅ FOCUS on ${bt.type} props — ${bt.accuracy}% accuracy on ${bt.total} predictions. This is your edge.`);
      }
    }

    const overT = overUnderAccuracy.over.correct + overUnderAccuracy.over.incorrect;
    const underT = overUnderAccuracy.under.correct + overUnderAccuracy.under.incorrect;
    const overAcc = overT > 0 ? Math.round(overUnderAccuracy.over.correct / overT * 100) : 0;
    const underAcc = underT > 0 ? Math.round(overUnderAccuracy.under.correct / underT * 100) : 0;
    if (Math.abs(overAcc - underAcc) >= 10 && overT >= 5 && underT >= 5) {
      const better = overAcc > underAcc ? "OVER" : "UNDER";
      recommendations.push(`📊 ${better} picks are hitting ${Math.max(overAcc, underAcc)}% vs ${Math.min(overAcc, underAcc)}%. Prioritize ${better} plays.`);
    }

    if (sweetSpot && sweetSpot.accuracy >= 65) {
      recommendations.push(`🎯 SWEET SPOT: ${sweetSpot.range}% confidence range hits at ${sweetSpot.accuracy}% (${sweetSpot.total} picks). Most reliable zone.`);
    }

    recommendations.push(`⚙️ OPTIMAL WEIGHTS based on ${total} predictions: Stats ${Math.round(optimalWeights.stats * 100)}% / Market ${Math.round(optimalWeights.market * 100)}% / Context ${Math.round(optimalWeights.context * 100)}%.`);

    return new Response(JSON.stringify({
      summary: { total, correct, incorrect, pushes, accuracy },
      game_accuracy: {
        correct: gameCorrect, incorrect: gameIncorrect,
        accuracy: (gameCorrect + gameIncorrect) > 0 ? Math.round(gameCorrect / (gameCorrect + gameIncorrect) * 1000) / 10 : 0,
      },
      prop_accuracy: {
        correct: propCorrect, incorrect: propIncorrect,
        accuracy: (propCorrect + propIncorrect) > 0 ? Math.round(propCorrect / (propCorrect + propIncorrect) * 1000) / 10 : 0,
      },
      by_tier: byTier,
      by_confidence_range: byConfRange,
      by_data_quality: byDataQuality,
      by_prop_type: byPropType,
      brain_correlation: brainCorrelation,
      over_under_accuracy: overUnderAccuracy,
      sweet_spot: sweetSpot,
      best_prop_types: bestPropTypes,
      worst_prop_types: worstPropTypes,
      optimal_weights: optimalWeights,
      recommendations,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    console.error("Intelligence audit error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
