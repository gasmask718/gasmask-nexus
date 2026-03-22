import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MIN_SAMPLES = 50;
const MAX_WEIGHT_SHIFT = 0.08;

async function callAI(system: string, user: string): Promise<string> {
  const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: gradedPredictions } = await supabase
      .from('sbo_predictions')
      .select('*')
      .not('was_correct', 'is', null)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false });

    const total = gradedPredictions?.length || 0;

    if (total < MIN_SAMPLES) {
      return new Response(JSON.stringify({
        success: false,
        reason: `Insufficient data: ${total}/${MIN_SAMPLES} predictions needed`,
        total_graded: total,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const predictions = gradedPredictions!;

    interface BrainPerformance {
      correct_when_high: number;
      wrong_when_high: number;
      correct_when_low: number;
      total_with_data: number;
      sum_score_correct: number;
      sum_score_wrong: number;
      count_correct: number;
      count_wrong: number;
    }

    const brainPerf: Record<string, BrainPerformance> = {
      stats: { correct_when_high: 0, wrong_when_high: 0, correct_when_low: 0, total_with_data: 0, sum_score_correct: 0, sum_score_wrong: 0, count_correct: 0, count_wrong: 0 },
      market: { correct_when_high: 0, wrong_when_high: 0, correct_when_low: 0, total_with_data: 0, sum_score_correct: 0, sum_score_wrong: 0, count_correct: 0, count_wrong: 0 },
      context: { correct_when_high: 0, wrong_when_high: 0, correct_when_low: 0, total_with_data: 0, sum_score_correct: 0, sum_score_wrong: 0, count_correct: 0, count_wrong: 0 },
      polymarket: { correct_when_high: 0, wrong_when_high: 0, correct_when_low: 0, total_with_data: 0, sum_score_correct: 0, sum_score_wrong: 0, count_correct: 0, count_wrong: 0 },
    };

    const brainFields: Record<string, string> = {
      stats: 'stats_brain_score',
      market: 'market_brain_score',
      context: 'context_brain_score',
      polymarket: 'polymarket_brain_score',
    };

    let overallCorrect = 0;

    for (const pred of predictions) {
      if (pred.was_correct) overallCorrect++;

      for (const [brainName, field] of Object.entries(brainFields)) {
        const score = (pred as any)[field];
        if (score === null || score === undefined) continue;

        const perf = brainPerf[brainName];
        perf.total_with_data++;

        if (pred.was_correct) {
          perf.count_correct++;
          perf.sum_score_correct += score;
          if (score >= 70) perf.correct_when_high++;
        } else {
          perf.count_wrong++;
          perf.sum_score_wrong += score;
          if (score >= 70) perf.wrong_when_high++;
          if (score < 50) perf.correct_when_low++;
        }
      }
    }

    const overallAccuracy = (overallCorrect / total) * 100;

    interface BrainAnalysis {
      precision: number;
      avg_score_correct: number;
      avg_score_wrong: number;
      score_differential: number;
      predictive_power: number;
      sample_size: number;
      has_sufficient_data: boolean;
    }

    const brainAnalysis: Record<string, BrainAnalysis> = {};

    for (const [brainName, perf] of Object.entries(brainPerf)) {
      const highTotal = perf.correct_when_high + perf.wrong_when_high;
      const precision = highTotal > 0 ? (perf.correct_when_high / highTotal) * 100 : 50;
      const avgCorrect = perf.count_correct > 0 ? perf.sum_score_correct / perf.count_correct : 50;
      const avgWrong = perf.count_wrong > 0 ? perf.sum_score_wrong / perf.count_wrong : 50;
      const differential = avgCorrect - avgWrong;
      const normalizedDiff = (differential / 50) * 100;
      const predictivePower = Math.min(100, Math.max(0, (precision * 0.5) + (normalizedDiff * 0.5)));

      brainAnalysis[brainName] = {
        precision,
        avg_score_correct: avgCorrect,
        avg_score_wrong: avgWrong,
        score_differential: differential,
        predictive_power: predictivePower,
        sample_size: perf.total_with_data,
        has_sufficient_data: perf.total_with_data >= 20,
      };
    }

    const { data: currentConfig } = await supabase
      .from('sbo_model_performance')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    const currentWeights = {
      stats: currentConfig?.stats_weight || 0.40,
      market: currentConfig?.market_weight || 0.35,
      context: currentConfig?.context_weight || 0.25,
      polymarket: currentConfig?.polymarket_weight || 0.00,
    };

    const validBrains = Object.entries(brainAnalysis)
      .filter(([_, a]) => a.has_sufficient_data)
      .map(([name, a]) => ({ name, power: a.predictive_power }));

    let newWeights = { ...currentWeights };

    if (validBrains.length >= 2) {
      const totalPower = validBrains.reduce((sum, b) => sum + b.power, 0);

      for (const brain of validBrains) {
        const optimalWeight = totalPower > 0 ? brain.power / totalPower : 0.25;
        const current = currentWeights[brain.name as keyof typeof currentWeights];
        const diff = optimalWeight - current;
        const shift = Math.max(-MAX_WEIGHT_SHIFT, Math.min(MAX_WEIGHT_SHIFT, diff * 0.5));
        newWeights[brain.name as keyof typeof newWeights] = Math.max(0.05, current + shift);
      }

      const weightSum = Object.values(newWeights).reduce((a, b) => a + b, 0);
      for (const key of Object.keys(newWeights)) {
        newWeights[key as keyof typeof newWeights] /= weightSum;
        newWeights[key as keyof typeof newWeights] = parseFloat(newWeights[key as keyof typeof newWeights].toFixed(3));
      }
    }

    const analysisText = Object.entries(brainAnalysis).map(([name, a]) =>
      `${name.toUpperCase()} Brain: precision=${a.precision.toFixed(1)}%, avg_score_correct=${a.avg_score_correct.toFixed(1)}, avg_score_wrong=${a.avg_score_wrong.toFixed(1)}, predictive_power=${a.predictive_power.toFixed(1)}`
    ).join('\n');

    const aiInterpretation = await callAI(
      'You are a sports betting model analyst. Analyze brain performance data and provide specific actionable insights. Max 3 sentences.',
      `Overall accuracy: ${overallAccuracy.toFixed(1)}% on ${total} predictions.\n\nBrain performance:\n${analysisText}\n\nCurrent weights: Stats=${currentWeights.stats}, Market=${currentWeights.market}, Context=${currentWeights.context}, Polymarket=${currentWeights.polymarket}\n\nProposed new weights: Stats=${newWeights.stats?.toFixed(3)}, Market=${newWeights.market?.toFixed(3)}, Context=${newWeights.context?.toFixed(3)}, Polymarket=${newWeights.polymarket?.toFixed(3)}\n\nWhat does this data tell us?`
    );

    const maxWeightChange = Math.max(
      ...Object.keys(newWeights).map(k =>
        Math.abs(newWeights[k as keyof typeof newWeights] - currentWeights[k as keyof typeof currentWeights])
      )
    );
    const shouldAdjust = maxWeightChange >= 0.01;

    await supabase.from('sbo_model_performance').update({ is_active: false }).eq('is_active', true);

    await supabase.from('sbo_model_performance').insert({
      evaluation_date: new Date().toISOString().split('T')[0],
      brain_config: brainAnalysis,
      stats_weight: shouldAdjust ? newWeights.stats : currentWeights.stats,
      market_weight: shouldAdjust ? newWeights.market : currentWeights.market,
      context_weight: shouldAdjust ? newWeights.context : currentWeights.context,
      polymarket_weight: shouldAdjust ? newWeights.polymarket : currentWeights.polymarket,
      total_predictions: total,
      correct_predictions: overallCorrect,
      accuracy_pct: overallAccuracy,
      avg_confidence_given: predictions.reduce((s: number, p: any) => s + (p.final_confidence || 50), 0) / total,
      avg_accuracy_achieved: overallAccuracy,
      calibration_score: Math.max(0, 100 - Math.abs(
        (predictions.reduce((s: number, p: any) => s + (p.final_confidence || 50), 0) / total) - overallAccuracy
      )),
      is_active: true,
    });

    if (shouldAdjust) {
      await supabase.from('sbo_weight_history').insert({
        reason: `Auto-adjustment based on ${total} prediction outcomes. ${aiInterpretation.slice(0, 200)}`,
        stats_weight_before: currentWeights.stats,
        market_weight_before: currentWeights.market,
        context_weight_before: currentWeights.context,
        polymarket_weight_before: currentWeights.polymarket,
        stats_weight_after: newWeights.stats,
        market_weight_after: newWeights.market,
        context_weight_after: newWeights.context,
        polymarket_weight_after: newWeights.polymarket,
        predictions_analyzed: total,
        accuracy_before: currentConfig?.accuracy_pct || 50,
        accuracy_after_projected: overallAccuracy,
        auto_adjusted: true,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      analysis: {
        total_predictions: total,
        overall_accuracy: overallAccuracy,
        brain_analysis: brainAnalysis,
        ai_interpretation: aiInterpretation,
        current_weights: currentWeights,
        proposed_weights: newWeights,
        max_weight_change: maxWeightChange,
        adjustment_applied: shouldAdjust,
      },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
