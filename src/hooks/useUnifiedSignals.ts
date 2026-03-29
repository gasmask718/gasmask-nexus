import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useConsensusIntelligence, ConsensusPick, CapperKPI } from './useConsensusIntelligence';

export interface DynamicWeightsInput {
  ai_weight: number;
  consensus_weight: number;
  capper_weight: number;
  roi_weight: number;
  market_weight: number;
  alignment_bonus: number;
}

export interface UnifiedSignal {
  player_name: string;
  team: string | null;
  sport: string;
  prop_type: string;
  line: number;
  direction: string;
  game_date: string;
  // AI layer
  ai_confidence: number | null;
  ai_recommendation: string | null;
  ai_prediction_id: string | null;
  confidence_tier: string | null;
  // Capper layer
  capper_consensus: number;
  capper_names: string[];
  capper_avg_roi: number;
  capper_avg_wr: number;
  capper_avg_grade: string;
  capper_weight: number;
  // Combined
  combined_score: number;
  signal_tier: 'ELITE' | 'STRONG' | 'WATCHLIST' | 'LOW';
  risk_tag: 'HIGH_CONFIDENCE' | 'MEDIUM_CONFIDENCE' | 'HIGH_RISK';
  alignment: 'ai_and_capper' | 'ai_only' | 'capper_only';
  alignment_bonus: boolean;
  result: string | null;
  short_reason: string;
  full_reason: string;
}

export interface YesterdayStats {
  wins: number;
  losses: number;
  pushes: number;
  roi: number;
  bestSignal: UnifiedSignal | null;
  worstSignal: UnifiedSignal | null;
}

export interface MarketEdge {
  market: string;
  winRate: number;
  roi: number;
  totalPicks: number;
}

// Grade → weight multiplier
const GRADE_WEIGHT: Record<string, number> = { A: 1.5, B: 1.2, C: 1.0, D: 0.6 };

function gradeFromKPIs(capperNames: string[], capperKPIs: CapperKPI[]): { avgGrade: string; avgWeight: number } {
  if (capperNames.length === 0) return { avgGrade: 'C', avgWeight: 1.0 };
  const matched = capperKPIs.filter(k => capperNames.some(n => n.toLowerCase() === k.name.toLowerCase()));
  if (matched.length === 0) return { avgGrade: 'C', avgWeight: 1.0 };
  const totalWeight = matched.reduce((s, k) => s + (GRADE_WEIGHT[k.grade] || 1.0), 0);
  const avgW = totalWeight / matched.length;
  const avgGrade = avgW >= 1.4 ? 'A' : avgW >= 1.1 ? 'B' : avgW >= 0.9 ? 'C' : 'D';
  return { avgGrade, avgWeight: Math.round(avgW * 100) / 100 };
}

/**
 * ADAPTIVE DECISION FORMULA (v3):
 * Uses dynamic weights from sbo_dynamic_weights table
 */
function calcFinalScore(
  aiConf: number | null,
  consensusCount: number,
  capperWeight: number,
  capperROI: number,
  marketWR: number,
  hasAlignment: boolean,
  dw: DynamicWeightsInput,
): number {
  const aiScale = dw.ai_weight * 100;
  const consScale = dw.consensus_weight * 100;
  const cwScale = dw.capper_weight * 100;
  const roiScale = dw.roi_weight * 100;
  const mktScale = dw.market_weight * 100;

  const ai = aiConf != null ? Math.min(aiConf / 100, 1) * aiScale : 0;
  const consensus = Math.min(consensusCount / 5, 1) * consScale;
  const weight = Math.min(capperWeight / 1.5, 1) * cwScale;
  const roi = Math.min(Math.max(capperROI + 20, 0) / 40, 1) * roiScale;
  const mkt = Math.min(marketWR / 100, 1) * mktScale;
  const bonus = hasAlignment ? dw.alignment_bonus : 0;
  return Math.min(100, Math.round(ai + consensus + weight + roi + mkt + bonus));
}

function getTier(score: number): UnifiedSignal['signal_tier'] {
  if (score >= 80) return 'ELITE';
  if (score >= 60) return 'STRONG';
  if (score >= 40) return 'WATCHLIST';
  return 'LOW';
}

function getRiskTag(score: number, capperWeight: number, capperROI: number): UnifiedSignal['risk_tag'] {
  if (score >= 75 && capperWeight >= 1.2) return 'HIGH_CONFIDENCE';
  if (capperROI < -5 || capperWeight <= 0.6) return 'HIGH_RISK';
  return 'MEDIUM_CONFIDENCE';
}

function generateReason(signal: Omit<UnifiedSignal, 'short_reason' | 'full_reason'>): { short_reason: string; full_reason: string } {
  const strengths: string[] = [];
  const risks: string[] = [];

  // AI confidence
  if (signal.ai_confidence != null) {
    if (signal.ai_confidence >= 75) strengths.push(`Strong AI confidence (${signal.ai_confidence}%)`);
    else if (signal.ai_confidence >= 60) strengths.push(`Moderate AI confidence (${signal.ai_confidence}%)`);
    else risks.push(`Low AI confidence (${signal.ai_confidence}%)`);
  }

  // Consensus
  if (signal.capper_consensus >= 4) strengths.push(`${signal.capper_consensus} cappers aligned (elite consensus)`);
  else if (signal.capper_consensus >= 3) strengths.push(`${signal.capper_consensus} cappers aligned (strong consensus)`);
  else if (signal.capper_consensus >= 2) strengths.push(`${signal.capper_consensus} cappers aligned`);
  else if (signal.capper_consensus === 0 && signal.alignment !== 'ai_only') risks.push('No capper consensus');

  // Grade
  if (signal.capper_avg_grade === 'A') strengths.push('Backed by A-grade capper(s)');
  else if (signal.capper_avg_grade === 'B') strengths.push('Backed by B-grade capper(s)');
  else if (signal.capper_avg_grade === 'D' && signal.capper_consensus > 0) risks.push('Low capper reliability (D-grade)');

  // ROI
  if (signal.capper_avg_roi > 5 && signal.capper_consensus > 0) strengths.push(`Capper ROI: +${signal.capper_avg_roi}%`);
  else if (signal.capper_avg_roi < -5 && signal.capper_consensus > 0) risks.push(`Negative capper ROI (${signal.capper_avg_roi}%)`);

  // Alignment
  if (signal.alignment_bonus) strengths.push('AI + capper agreement (+10 bonus)');

  // Risk tag context
  if (signal.risk_tag === 'HIGH_RISK') risks.push('Flagged as high risk');

  const full_parts: string[] = [];
  if (strengths.length > 0) full_parts.push(strengths.join('. ') + '.');
  if (risks.length > 0) full_parts.push('Risks: ' + risks.join('; ') + '.');

  const full_reason = full_parts.join(' ') || 'Insufficient data for detailed analysis.';

  // Short reason: top strength or top risk
  const short_reason = strengths.length > 0
    ? strengths[0]
    : risks.length > 0
    ? risks[0]
    : 'Limited signal data';

  return { short_reason, full_reason };
}

export function useUnifiedSignals() {
  const { consensusPicks, consensusStats, capperKPIs, todayConsensusPicks, isLoading: capperLoading } = useConsensusIntelligence();

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

  // Fetch dynamic weights
  const DEFAULT_DW: DynamicWeightsInput = { ai_weight: 0.40, consensus_weight: 0.15, capper_weight: 0.20, roi_weight: 0.15, market_weight: 0.10, alignment_bonus: 10 };
  const { data: dynamicWeights = DEFAULT_DW } = useQuery({
    queryKey: ['sbo-dynamic-weights'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('sbo_dynamic_weights').select('ai_weight,consensus_weight,capper_weight,roi_weight,market_weight,alignment_bonus').eq('id', 1).single();
      return data ? {
        ai_weight: Number(data.ai_weight),
        consensus_weight: Number(data.consensus_weight),
        capper_weight: Number(data.capper_weight),
        roi_weight: Number(data.roi_weight),
        market_weight: Number(data.market_weight),
        alignment_bonus: Number(data.alignment_bonus),
      } as DynamicWeightsInput : DEFAULT_DW;
    },
  });

  const { data: aiPredictions = [], isLoading: aiLoading } = useQuery({
    queryKey: ['unified-ai-predictions', today],
    queryFn: async () => {
      const { data } = await (supabase as any).from('sbo_predictions')
        .select('id, prediction_type, final_confidence, confidence_tier, predicted_outcome, was_correct, sbo_player_props(player_name, prop_type, line, team), sbo_games(home_team, away_team, game_date)')
        .gte('created_at', `${yesterday}T00:00:00`)
        .order('final_confidence', { ascending: false })
        .limit(200);
      return data || [];
    },
  });

  const { data: todayProps = [] } = useQuery({
    queryKey: ['unified-props-today', today],
    queryFn: async () => {
      const { data } = await (supabase as any).from('props_master')
        .select('id, player_name, stat_type, line, game_date, ai_confidence, ai_recommendation, result, consensus_over, consensus_under, season_avg')
        .eq('game_date', today)
        .limit(500);
      return data || [];
    },
  });

  const { signals, alignedSignals, aiOnlySignals, capperOnlySignals, yesterdayStats, pendingSignals, eliteSignals, strongSignals, bestPlays, marketEdges } = useMemo(() => {
    const allSignals: UnifiedSignal[] = [];
    const aiMap = new Map<string, any>();
    const propsMap = new Map<string, any>();

    for (const pred of aiPredictions) {
      const pp = pred.sbo_player_props;
      if (!pp?.player_name) continue;
      const key = `${pp.player_name.toLowerCase().trim()}|${(pp.prop_type || '').toLowerCase()}|${pp.line}`;
      aiMap.set(key, pred);
    }

    for (const prop of todayProps) {
      const key = `${(prop.player_name || '').toLowerCase().trim()}|${(prop.stat_type || '').toLowerCase()}|${prop.line}`;
      propsMap.set(key, prop);
    }

    const processedKeys = new Set<string>();

    // Process consensus picks
    for (const cp of consensusPicks) {
      const key = `${cp.player_name.toLowerCase().trim()}|${cp.prop_type.toLowerCase()}|${cp.line}`;
      processedKeys.add(key);
      const aiPred = aiMap.get(key);
      const prop = propsMap.get(key);
      const aiConf = aiPred?.final_confidence || prop?.ai_confidence || null;
      const hasAI = aiConf != null && aiConf > 0;
      const { avgGrade, avgWeight } = gradeFromKPIs(cp.capperNames, capperKPIs);

      const score = calcFinalScore(aiConf, cp.capperCount, avgWeight, cp.avgCapperROI, cp.avgCapperWinRate, hasAI, dynamicWeights);

      const partial = {
        player_name: cp.player_name,
        team: cp.team,
        sport: cp.sport,
        prop_type: cp.prop_type,
        line: cp.line,
        direction: cp.direction,
        game_date: cp.game_date,
        ai_confidence: aiConf,
        ai_recommendation: aiPred?.predicted_outcome || prop?.ai_recommendation || null,
        ai_prediction_id: aiPred?.id || null,
        confidence_tier: aiPred?.confidence_tier || null,
        capper_consensus: cp.capperCount,
        capper_names: cp.capperNames,
        capper_avg_roi: cp.avgCapperROI,
        capper_avg_wr: cp.avgCapperWinRate,
        capper_avg_grade: avgGrade,
        capper_weight: avgWeight,
        combined_score: score,
        signal_tier: getTier(score),
        risk_tag: getRiskTag(score, avgWeight, cp.avgCapperROI),
        alignment: hasAI ? 'ai_and_capper' as const : 'capper_only' as const,
        alignment_bonus: hasAI,
        result: cp.result,
      };
      allSignals.push({ ...partial, ...generateReason(partial) });
    }

    // Process AI-only signals
    for (const pred of aiPredictions) {
      const pp = pred.sbo_player_props;
      if (!pp?.player_name) continue;
      const key = `${pp.player_name.toLowerCase().trim()}|${(pp.prop_type || '').toLowerCase()}|${pp.line}`;
      if (processedKeys.has(key)) continue;
      processedKeys.add(key);

      const conf = pred.final_confidence || 0;
      if (conf < 55) continue;

      const score = calcFinalScore(conf, 0, 1.0, 0, 0, false, dynamicWeights);
      const partial2 = {
        player_name: pp.player_name,
        team: pp.team || null,
        sport: 'NBA',
        prop_type: pp.prop_type || '',
        line: pp.line,
        direction: pred.predicted_outcome?.includes('OVER') ? 'OVER' : pred.predicted_outcome?.includes('UNDER') ? 'UNDER' : '',
        game_date: pred.sbo_games?.game_date || today,
        ai_confidence: conf,
        ai_recommendation: pred.predicted_outcome,
        ai_prediction_id: pred.id,
        confidence_tier: pred.confidence_tier,
        capper_consensus: 0,
        capper_names: [] as string[],
        capper_avg_roi: 0,
        capper_avg_wr: 0,
        capper_avg_grade: '—',
        capper_weight: 1.0,
        combined_score: score,
        signal_tier: getTier(score),
        risk_tag: getRiskTag(score, 1.0, 0),
        alignment: 'ai_only' as const,
        alignment_bonus: false,
        result: pred.was_correct != null ? (pred.was_correct ? 'won' : 'lost') : null,
      };
      allSignals.push({ ...partial2, ...generateReason(partial2) });
    }

    allSignals.sort((a, b) => b.combined_score - a.combined_score);

    const aligned = allSignals.filter(s => s.alignment === 'ai_and_capper');
    const aiOnly = allSignals.filter(s => s.alignment === 'ai_only');
    const capperOnly = allSignals.filter(s => s.alignment === 'capper_only');
    const pending = allSignals.filter(s => !s.result);
    const elite = allSignals.filter(s => s.signal_tier === 'ELITE');
    const strong = allSignals.filter(s => s.signal_tier === 'STRONG');

    // Best plays = top 5 ELITE+STRONG, no result yet
    const best = allSignals
      .filter(s => !s.result && (s.signal_tier === 'ELITE' || s.signal_tier === 'STRONG'))
      .slice(0, 5);

    // Market edge detection
    const mktMap = new Map<string, { wins: number; losses: number; total: number; roiSum: number }>();
    for (const s of allSignals) {
      if (!s.result || (s.result !== 'won' && s.result !== 'lost')) continue;
      const m = s.prop_type || 'unknown';
      if (!mktMap.has(m)) mktMap.set(m, { wins: 0, losses: 0, total: 0, roiSum: 0 });
      const entry = mktMap.get(m)!;
      entry.total++;
      if (s.result === 'won') { entry.wins++; entry.roiSum += 0.909; }
      else { entry.losses++; entry.roiSum -= 1; }
    }
    const edges: MarketEdge[] = [...mktMap.entries()]
      .filter(([, v]) => v.total >= 3)
      .map(([market, v]) => ({
        market,
        winRate: Math.round((v.wins / v.total) * 100),
        roi: Math.round((v.roiSum / v.total) * 10000) / 100,
        totalPicks: v.total,
      }))
      .sort((a, b) => b.roi - a.roi);

    // Yesterday stats
    const yesterdaySignals = allSignals.filter(s => s.game_date === yesterday && (s.result === 'won' || s.result === 'lost'));
    const yWins = yesterdaySignals.filter(s => s.result === 'won').length;
    const yLosses = yesterdaySignals.filter(s => s.result === 'lost').length;
    const yTotal = yWins + yLosses;
    const yROI = yTotal > 0 ? Math.round(((yWins * 0.909 - yLosses) / yTotal) * 10000) / 100 : 0;
    const bestY = yesterdaySignals.filter(s => s.result === 'won').sort((a, b) => b.combined_score - a.combined_score)[0] || null;
    const worstY = yesterdaySignals.filter(s => s.result === 'lost').sort((a, b) => b.combined_score - a.combined_score)[0] || null;

    return {
      signals: allSignals,
      alignedSignals: aligned,
      aiOnlySignals: aiOnly,
      capperOnlySignals: capperOnly,
      pendingSignals: pending,
      eliteSignals: elite,
      strongSignals: strong,
      bestPlays: best,
      marketEdges: edges,
      yesterdayStats: { wins: yWins, losses: yLosses, pushes: 0, roi: yROI, bestSignal: bestY, worstSignal: worstY } as YesterdayStats,
    };
  }, [aiPredictions, todayProps, consensusPicks, capperKPIs, today, yesterday]);

  return {
    signals,
    alignedSignals,
    aiOnlySignals,
    capperOnlySignals,
    pendingSignals,
    eliteSignals,
    strongSignals,
    bestPlays,
    marketEdges,
    yesterdayStats,
    consensusStats,
    capperKPIs,
    todayConsensusPicks,
    isLoading: capperLoading || aiLoading,
    today,
    yesterday,
  };
}
