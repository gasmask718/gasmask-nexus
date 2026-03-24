import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function normalizePropType(raw: string): string {
  const map: Record<string, string> = {
    points: 'Points', pts: 'Points', player_points: 'Points', point: 'Points',
    rebounds: 'Rebounds', reb: 'Rebounds', player_rebounds: 'Rebounds',
    assists: 'Assists', ast: 'Assists', player_assists: 'Assists',
    threes: '3-Pointers', three_pointers: '3-Pointers', player_threes: '3-Pointers', '3pt': '3-Pointers',
    blocks: 'Blocks', blk: 'Blocks', player_blocks: 'Blocks', blocked_shots: 'Blocks',
    steals: 'Steals', stl: 'Steals', player_steals: 'Steals',
    turnovers: 'Turnovers', tov: 'Turnovers', player_turnovers: 'Turnovers',
    pra: 'Pts+Reb+Ast', pts_reb_ast: 'Pts+Reb+Ast', points_rebounds_assists: 'Pts+Reb+Ast',
    pts_reb: 'Pts+Reb', points_rebounds: 'Pts+Reb',
    pts_ast: 'Pts+Ast', points_assists: 'Pts+Ast',
    reb_ast: 'Reb+Ast', rebounds_assists: 'Reb+Ast',
    blks_stls: 'Blks+Stls', fantasy_points: 'Fantasy', minutes: 'Minutes',
  }
  return map[(raw || '').toLowerCase().trim()] || raw
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  console.log('sbo-intelligence-audit started')

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    // QUERY 1 — Get all verifications (no nested joins)
    const { data: verifications, error: verError } = await supabase
      .from('sbo_results_verification')
      .select(`
        id, verdict, was_correct, actual_value, actual_result,
        pick_type, prediction_id, verified_at
      `)
      .not('verdict', 'is', null)
      .in('verdict', ['correct', 'incorrect', 'push'])
      .limit(1000)

    if (verError) throw new Error(`Verifications query failed: ${verError.message}`)
    console.log(`Loaded ${verifications?.length || 0} verifications`)

    if (!verifications?.length) {
      return new Response(JSON.stringify({
        error: 'No verified predictions found yet. Run verification first.',
        summary: { total: 0, correct: 0, incorrect: 0, accuracy: 0 }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // QUERY 2 — Get prediction details in batches (avoid URL length limits)
    const predictionIds = verifications.map(v => v.prediction_id).filter(Boolean)

    const BATCH_SIZE = 50
    const allPredictions: any[] = []
    for (let i = 0; i < predictionIds.length; i += BATCH_SIZE) {
      const batch = predictionIds.slice(i, i + BATCH_SIZE)
      const { data: batchPreds, error: batchErr } = await supabase
        .from('sbo_predictions')
        .select(`
          id, prediction_type, predicted_outcome, final_confidence,
          confidence_tier, data_quality, stats_brain_score,
          market_brain_score, context_brain_score, game_id, prop_id
        `)
        .in('id', batch)
      if (batchErr) throw new Error(`Predictions batch query failed: ${batchErr.message}`)
      allPredictions.push(...(batchPreds || []))
    }
    const predictions = allPredictions
    console.log(`Loaded ${predictions.length} predictions`)

    // QUERY 3 — Get prop details in batches
    const propPredictions = predictions.filter(p => p.prediction_type === 'player_prop' && p.prop_id)
    const propIds = propPredictions.map(p => p.prop_id).filter(Boolean)

    const propsMap: Record<string, any> = {}
    for (let i = 0; i < propIds.length; i += BATCH_SIZE) {
      const batch = propIds.slice(i, i + BATCH_SIZE)
      const { data: props } = await supabase
        .from('sbo_player_props')
        .select('id, player_name, team, prop_type, line, sportsbook, source')
        .in('id', batch)
      for (const prop of (props || [])) {
        propsMap[prop.id] = prop
      }
    }
    console.log(`Loaded ${Object.keys(propsMap).length} prop details`)

    // BUILD MERGED DATASET
    const predMap: Record<string, any> = {}
    for (const pred of (predictions || [])) {
      predMap[pred.id] = {
        ...pred,
        prop_details: pred.prop_id ? propsMap[pred.prop_id] : null
      }
    }

    const merged = verifications.map(v => ({
      ...v,
      pred: predMap[v.prediction_id] || null
    })).filter(v => v.pred !== null)

    console.log(`Merged dataset: ${merged.length} records`)

    // ANALYSIS 1 — OVERALL STATS
    const total = merged.length
    const correct = merged.filter(p => p.verdict === 'correct').length
    const incorrect = merged.filter(p => p.verdict === 'incorrect').length
    const pushes = merged.filter(p => p.verdict === 'push').length
    const accuracy = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0

    // ANALYSIS 2 — BY CONFIDENCE TIER
    const byTier: Record<string, { correct: number, incorrect: number, total: number, accuracy: number }> = {}
    for (const p of merged) {
      const tier = p.pred?.confidence_tier || 'unknown'
      if (!byTier[tier]) byTier[tier] = { correct: 0, incorrect: 0, total: 0, accuracy: 0 }
      byTier[tier].total++
      if (p.verdict === 'correct') byTier[tier].correct++
      else if (p.verdict === 'incorrect') byTier[tier].incorrect++
    }
    for (const tier of Object.keys(byTier)) {
      const t = byTier[tier].correct + byTier[tier].incorrect
      byTier[tier].accuracy = t > 0 ? Math.round(byTier[tier].correct / t * 100) : 0
    }

    // ANALYSIS 3 — BY CONFIDENCE RANGE
    const byConfRange: Record<string, { correct: number, incorrect: number, total: number, accuracy: number }> = {
      '90-100': { correct: 0, incorrect: 0, total: 0, accuracy: 0 },
      '80-89': { correct: 0, incorrect: 0, total: 0, accuracy: 0 },
      '70-79': { correct: 0, incorrect: 0, total: 0, accuracy: 0 },
      '60-69': { correct: 0, incorrect: 0, total: 0, accuracy: 0 },
      '50-59': { correct: 0, incorrect: 0, total: 0, accuracy: 0 },
      'below-50': { correct: 0, incorrect: 0, total: 0, accuracy: 0 }
    }
    for (const p of merged) {
      const conf = p.pred?.final_confidence || 0
      const range = conf >= 90 ? '90-100' : conf >= 80 ? '80-89' : conf >= 70 ? '70-79' :
                    conf >= 60 ? '60-69' : conf >= 50 ? '50-59' : 'below-50'
      byConfRange[range].total++
      if (p.verdict === 'correct') byConfRange[range].correct++
      else if (p.verdict === 'incorrect') byConfRange[range].incorrect++
    }
    for (const range of Object.keys(byConfRange)) {
      const t = byConfRange[range].correct + byConfRange[range].incorrect
      byConfRange[range].accuracy = t > 0 ? Math.round(byConfRange[range].correct / t * 100) : 0
    }

    // ANALYSIS 4 — BY DATA QUALITY
    const byDataQuality: Record<string, { correct: number, incorrect: number, total: number, accuracy: number }> = {}
    for (const p of merged) {
      const dq = p.pred?.data_quality || 'unknown'
      if (!byDataQuality[dq]) byDataQuality[dq] = { correct: 0, incorrect: 0, total: 0, accuracy: 0 }
      byDataQuality[dq].total++
      if (p.verdict === 'correct') byDataQuality[dq].correct++
      else if (p.verdict === 'incorrect') byDataQuality[dq].incorrect++
    }
    for (const dq of Object.keys(byDataQuality)) {
      const t = byDataQuality[dq].correct + byDataQuality[dq].incorrect
      byDataQuality[dq].accuracy = t > 0 ? Math.round(byDataQuality[dq].correct / t * 100) : 0
    }

    // ANALYSIS 5 — BY PROP TYPE
    const byPropType: Record<string, { correct: number, incorrect: number, total: number, accuracy: number }> = {}
    const propMerged = merged.filter(p => p.pred?.prediction_type === 'player_prop')

    for (const p of propMerged) {
      const rawType = p.pred?.prop_details?.prop_type || 'unknown'
      const pt = normalizePropType(rawType)
      if (!byPropType[pt]) byPropType[pt] = { correct: 0, incorrect: 0, total: 0, accuracy: 0 }
      byPropType[pt].total++
      if (p.verdict === 'correct') byPropType[pt].correct++
      else if (p.verdict === 'incorrect') byPropType[pt].incorrect++
    }
    for (const pt of Object.keys(byPropType)) {
      const t = byPropType[pt].correct + byPropType[pt].incorrect
      byPropType[pt].accuracy = t > 0 ? Math.round(byPropType[pt].correct / t * 100) : 0
    }

    // ANALYSIS 6 — BRAIN SCORE CORRELATION
    const correctPreds = merged.filter(p => p.verdict === 'correct' && p.pred?.stats_brain_score != null)
    const incorrectPreds = merged.filter(p => p.verdict === 'incorrect' && p.pred?.stats_brain_score != null)

    const avg = (arr: any[], key: string) => arr.length > 0
      ? Math.round(arr.reduce((s: number, p: any) => s + (p.pred?.[key] || 0), 0) / arr.length)
      : 0

    const brainCorrelation = {
      stats: {
        correct_avg: avg(correctPreds, 'stats_brain_score'),
        incorrect_avg: avg(incorrectPreds, 'stats_brain_score'),
        gap: avg(correctPreds, 'stats_brain_score') - avg(incorrectPreds, 'stats_brain_score')
      },
      market: {
        correct_avg: avg(correctPreds, 'market_brain_score'),
        incorrect_avg: avg(incorrectPreds, 'market_brain_score'),
        gap: avg(correctPreds, 'market_brain_score') - avg(incorrectPreds, 'market_brain_score')
      },
      context: {
        correct_avg: avg(correctPreds, 'context_brain_score'),
        incorrect_avg: avg(incorrectPreds, 'context_brain_score'),
        gap: avg(correctPreds, 'context_brain_score') - avg(incorrectPreds, 'context_brain_score')
      }
    }

    // ANALYSIS 7 — OVER vs UNDER
    const overUnderAccuracy = {
      over: { correct: 0, incorrect: 0, total: 0, accuracy: 0 },
      under: { correct: 0, incorrect: 0, total: 0, accuracy: 0 }
    }
    for (const p of propMerged) {
      const pick = (p.pred?.predicted_outcome || '').toLowerCase()
      if (pick === 'over' || pick === 'under') {
        overUnderAccuracy[pick as 'over'|'under'].total++
        if (p.verdict === 'correct') overUnderAccuracy[pick as 'over'|'under'].correct++
        else if (p.verdict === 'incorrect') overUnderAccuracy[pick as 'over'|'under'].incorrect++
      }
    }
    for (const side of ['over', 'under'] as const) {
      const t = overUnderAccuracy[side].correct + overUnderAccuracy[side].incorrect
      overUnderAccuracy[side].accuracy = t > 0 ? Math.round(overUnderAccuracy[side].correct / t * 100) : 0
    }

    // ANALYSIS 8 — GAME vs PROP BREAKDOWN
    const gamePreds = merged.filter(p => p.pred?.prediction_type === 'moneyline')
    const gameCorrect = gamePreds.filter(p => p.verdict === 'correct').length
    const gameIncorrect = gamePreds.filter(p => p.verdict === 'incorrect').length
    const propCorrect = propMerged.filter(p => p.verdict === 'correct').length
    const propIncorrect = propMerged.filter(p => p.verdict === 'incorrect').length

    const gameVsProp = {
      games: {
        total: gamePreds.length, correct: gameCorrect, incorrect: gameIncorrect,
        accuracy: gameCorrect + gameIncorrect > 0 ? Math.round(gameCorrect / (gameCorrect + gameIncorrect) * 100) : 0
      },
      props: {
        total: propMerged.length, correct: propCorrect, incorrect: propIncorrect,
        accuracy: propCorrect + propIncorrect > 0 ? Math.round(propCorrect / (propCorrect + propIncorrect) * 100) : 0
      }
    }

    // ANALYSIS 9 — SWEET SPOT
    const sweetSpot = Object.entries(byConfRange)
      .map(([range, stats]) => ({ range, ...stats }))
      .filter(s => s.total >= 5)
      .sort((a, b) => b.accuracy - a.accuracy)[0] || null

    // ANALYSIS 10 — SORTED PROP TYPES
    const propTypesSorted = Object.entries(byPropType)
      .map(([type, stats]) => ({ type, ...stats }))
      .filter(s => s.total >= 3)
      .sort((a, b) => b.accuracy - a.accuracy)

    const bestPropTypes = propTypesSorted.slice(0, 5)
    const worstPropTypes = [...propTypesSorted].sort((a, b) => a.accuracy - b.accuracy).slice(0, 3)

    // GENERATE RECOMMENDATIONS
    const recommendations: string[] = []

    if (accuracy >= 70) {
      recommendations.push(`🏆 EXCELLENT — ${accuracy}% overall accuracy on ${total} predictions. Above industry standard.`)
    } else if (accuracy >= 60) {
      recommendations.push(`✅ GOOD — ${accuracy}% accuracy. Profitable range. Filter out low-confidence picks to push above 65%.`)
    } else {
      recommendations.push(`⚠️ NEEDS IMPROVEMENT — ${accuracy}% accuracy. Below 60%. Implement minimum confidence filter.`)
    }

    const eliteStats = byTier['elite']
    const weakStats = byTier['weak']

    if (eliteStats && eliteStats.total >= 5) {
      if (eliteStats.accuracy >= 70) {
        recommendations.push(`🔥 ELITE tier hitting ${eliteStats.accuracy}% on ${eliteStats.total} picks — prioritize and increase unit size.`)
      } else {
        recommendations.push(`⚠️ ELITE tier only ${eliteStats.accuracy}% — AI is overconfident. Recalibrate.`)
      }
    }

    if (weakStats && weakStats.total >= 5 && weakStats.accuracy < 50) {
      recommendations.push(`🔴 STOP WEAK picks — only ${weakStats.accuracy}% on ${weakStats.total} predictions. Set minimum confidence at 60%.`)
    }

    const brainGaps = [
      { name: 'Stats', gap: brainCorrelation.stats.gap },
      { name: 'Market', gap: brainCorrelation.market.gap },
      { name: 'Context', gap: brainCorrelation.context.gap }
    ].sort((a, b) => b.gap - a.gap)

    const bestBrain = brainGaps[0]
    const worstBrain = brainGaps[2]

    if (bestBrain.gap > 5) {
      recommendations.push(`🧠 ${bestBrain.name} Brain is strongest — correct picks average ${bestBrain.gap}pts higher. Increase weight.`)
    }
    if (worstBrain.gap < 2) {
      recommendations.push(`📉 ${worstBrain.name} Brain weak correlation (${worstBrain.gap}pt gap). Reduce weight.`)
    }

    for (const bt of bestPropTypes.slice(0, 3)) {
      if (bt.accuracy >= 70 && bt.total >= 5) {
        recommendations.push(`✅ FOCUS: ${bt.type} props hitting ${bt.accuracy}% on ${bt.total} picks. Confirmed edge.`)
      }
    }
    for (const wt of worstPropTypes) {
      if (wt.accuracy < 50 && wt.total >= 5) {
        recommendations.push(`❌ FADE: ${wt.type} props only ${wt.accuracy}% on ${wt.total} picks. Below coin-flip.`)
      }
    }

    const overAcc = overUnderAccuracy.over.accuracy
    const underAcc = overUnderAccuracy.under.accuracy
    if (overUnderAccuracy.over.total >= 10 && overUnderAccuracy.under.total >= 10 && Math.abs(overAcc - underAcc) >= 8) {
      const better = overAcc > underAcc ? 'OVER' : 'UNDER'
      recommendations.push(`📊 ${better} picks hitting ${Math.max(overAcc, underAcc)}% vs ${Math.min(overAcc, underAcc)}%. Prioritize ${better}.`)
    }

    const fullDQ = byDataQuality['full']
    const oddsDQ = byDataQuality['odds_only']
    if (fullDQ && oddsDQ && fullDQ.total >= 10 && oddsDQ.total >= 10 && fullDQ.accuracy > oddsDQ.accuracy + 5) {
      recommendations.push(`📈 Full Stats ${fullDQ.accuracy}% vs Odds Only ${oddsDQ.accuracy}%. Always wait for full stats.`)
    }

    if (sweetSpot && sweetSpot.accuracy >= 65) {
      recommendations.push(`🎯 SWEET SPOT: ${sweetSpot.range}% confidence hits at ${sweetSpot.accuracy}% on ${sweetSpot.total} picks.`)
    }

    if (gameVsProp.games.total >= 5 && gameVsProp.props.total >= 5) {
      const betterType = gameVsProp.games.accuracy > gameVsProp.props.accuracy ? 'Game ML picks' : 'Prop picks'
      recommendations.push(`🏀 ${betterType} outperforming at ${Math.max(gameVsProp.games.accuracy, gameVsProp.props.accuracy)}% vs ${Math.min(gameVsProp.games.accuracy, gameVsProp.props.accuracy)}%.`)
    }

    // Optimal weights
    const statGap = Math.max(0, brainCorrelation.stats.gap)
    const marketGap = Math.max(0, brainCorrelation.market.gap)
    const contextGap = Math.max(0, brainCorrelation.context.gap)
    const totalGap = statGap + marketGap + contextGap || 1

    const optimalWeights = {
      stats: Math.round(Math.max(0.25, Math.min(0.55, statGap / totalGap)) * 100) / 100,
      market: Math.round(Math.max(0.20, Math.min(0.45, marketGap / totalGap)) * 100) / 100,
      context: 0
    }
    optimalWeights.context = Math.round((1 - optimalWeights.stats - optimalWeights.market) * 100) / 100

    recommendations.push(`⚙️ OPTIMAL WEIGHTS: Stats ${Math.round(optimalWeights.stats*100)}% / Market ${Math.round(optimalWeights.market*100)}% / Context ${Math.round(optimalWeights.context*100)}%.`)

    console.log('Audit complete:', { total, correct, incorrect, accuracy })

    return new Response(JSON.stringify({
      summary: { total, correct, incorrect, pushes, accuracy },
      game_vs_prop: gameVsProp,
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
      raw_count: merged.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Audit error:', error)
    return new Response(JSON.stringify({
      error: error.message,
      tip: 'Check edge function logs for details'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})