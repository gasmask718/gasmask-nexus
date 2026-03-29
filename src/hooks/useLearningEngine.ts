import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { UnifiedSignal } from './useUnifiedSignals';
import { toast } from 'sonner';

// ── Types ──
export interface DynamicWeights {
  ai_weight: number;
  consensus_weight: number;
  capper_weight: number;
  roi_weight: number;
  market_weight: number;
  alignment_bonus: number;
  last_recalibrated_at: string | null;
  recalibration_count: number;
  sample_size: number;
  weights_locked: boolean;
}

export interface LearningEvent {
  id: string;
  created_at: string;
  game_date: string;
  player_name: string;
  prop_type: string;
  signal_tier: string;
  ai_confidence: number | null;
  capper_consensus: number;
  capper_weight: number;
  capper_avg_roi: number;
  capper_avg_grade: string;
  market_type: string;
  alignment: string;
  alignment_bonus: boolean;
  risk_tag: string;
  result: string;
  final_score: number;
}

export interface TierPerformance {
  tier: string;
  wins: number;
  losses: number;
  total: number;
  winRate: number;
  roi: number;
}

export interface FactorPerformance {
  factor: string;
  bucket: string;
  wins: number;
  losses: number;
  winRate: number;
  roi: number;
}

export interface WeightHistoryEntry {
  id: string;
  created_at: string;
  trigger_reason: string;
  sample_size: number;
  adjustments_applied: Record<string, { before: number; after: number; delta: number }> | null;
  pre_recal_win_rate: number | null;
  post_recal_win_rate: number | null;
}

export interface LearningInsights {
  bestFactor: { name: string; winRate: number } | null;
  worstFactor: { name: string; winRate: number } | null;
  bestTier: { name: string; roi: number } | null;
  worstTier: { name: string; roi: number } | null;
  overallWinRate: number;
  totalResolved: number;
  learningHealthy: boolean;
  degradationWarning: boolean;
}

// ── Default weights (fallback) ──
export const DEFAULT_WEIGHTS: DynamicWeights = {
  ai_weight: 0.40,
  consensus_weight: 0.15,
  capper_weight: 0.20,
  roi_weight: 0.15,
  market_weight: 0.10,
  alignment_bonus: 10,
  last_recalibrated_at: null,
  recalibration_count: 0,
  sample_size: 0,
  weights_locked: false,
};

// Safety: max ±10% adjustment per recalibration
const MAX_DELTA = 0.10;
const MIN_SAMPLE_SIZE = 10;

function clampDelta(before: number, proposed: number): number {
  const delta = proposed - before;
  const clamped = Math.max(-MAX_DELTA, Math.min(MAX_DELTA, delta));
  return Math.round((before + clamped) * 1000) / 1000;
}

// ── Main Hook ──
export function useLearningEngine() {
  const qc = useQueryClient();

  // Fetch current dynamic weights
  const { data: weights = DEFAULT_WEIGHTS, isLoading: weightsLoading } = useQuery({
    queryKey: ['sbo-dynamic-weights'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('sbo_dynamic_weights').select('*').eq('id', 1).single();
      return data ? {
        ai_weight: Number(data.ai_weight),
        consensus_weight: Number(data.consensus_weight),
        capper_weight: Number(data.capper_weight),
        roi_weight: Number(data.roi_weight),
        market_weight: Number(data.market_weight),
        alignment_bonus: Number(data.alignment_bonus),
        last_recalibrated_at: data.last_recalibrated_at,
        recalibration_count: data.recalibration_count || 0,
        sample_size: data.sample_size || 0,
        weights_locked: data.weights_locked || false,
      } as DynamicWeights : DEFAULT_WEIGHTS;
    },
  });

  // Fetch learning events
  const { data: learningEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['sbo-learning-events'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('sbo_learning_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      return (data || []) as LearningEvent[];
    },
  });

  // Fetch weight history
  const { data: weightHistory = [] } = useQuery({
    queryKey: ['sbo-weight-history'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('sbo_decision_weight_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      return (data || []) as WeightHistoryEntry[];
    },
  });

  // ── Record resolved signals as learning events ──
  const recordEvent = useMutation({
    mutationFn: async (signal: UnifiedSignal) => {
      if (!signal.result || (signal.result !== 'won' && signal.result !== 'lost')) return;
      const { error } = await (supabase as any).from('sbo_learning_events').insert({
        game_date: signal.game_date,
        player_name: signal.player_name,
        prop_type: signal.prop_type,
        line: signal.line,
        direction: signal.direction,
        sport: signal.sport,
        final_score: signal.combined_score,
        signal_tier: signal.signal_tier,
        ai_confidence: signal.ai_confidence,
        capper_consensus: signal.capper_consensus,
        capper_weight: signal.capper_weight,
        capper_avg_roi: signal.capper_avg_roi,
        capper_avg_grade: signal.capper_avg_grade,
        market_type: signal.prop_type,
        alignment: signal.alignment,
        alignment_bonus: signal.alignment_bonus,
        risk_tag: signal.risk_tag,
        result: signal.result,
        short_reason: signal.short_reason,
        full_reason: signal.full_reason,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sbo-learning-events'] }),
  });

  // ── Toggle weight lock ──
  const toggleWeightLock = useMutation({
    mutationFn: async (locked: boolean) => {
      const { error } = await (supabase as any).from('sbo_dynamic_weights')
        .update({ weights_locked: locked, updated_at: new Date().toISOString() })
        .eq('id', 1);
      if (error) throw error;
    },
    onSuccess: (_, locked) => {
      toast.success(locked ? 'Weights locked — learning paused' : 'Weights unlocked — learning resumed');
      qc.invalidateQueries({ queryKey: ['sbo-dynamic-weights'] });
    },
  });

  // ── Manual weight override ──
  const setManualWeights = useMutation({
    mutationFn: async (newW: Partial<Pick<DynamicWeights, 'ai_weight' | 'consensus_weight' | 'capper_weight' | 'roi_weight' | 'market_weight' | 'alignment_bonus'>>) => {
      // Save history first
      const adjustments: Record<string, { before: number; after: number; delta: number }> = {};
      for (const [k, v] of Object.entries(newW)) {
        const before = (weights as any)[k];
        if (before !== v) {
          adjustments[k] = { before, after: v as number, delta: Math.round(((v as number) - before) * 1000) / 1000 };
        }
      }
      await (supabase as any).from('sbo_decision_weight_history').insert({
        ai_weight_before: weights.ai_weight,
        ai_weight_after: newW.ai_weight ?? weights.ai_weight,
        consensus_weight_before: weights.consensus_weight,
        consensus_weight_after: newW.consensus_weight ?? weights.consensus_weight,
        capper_weight_before: weights.capper_weight,
        capper_weight_after: newW.capper_weight ?? weights.capper_weight,
        roi_weight_before: weights.roi_weight,
        roi_weight_after: newW.roi_weight ?? weights.roi_weight,
        market_weight_before: weights.market_weight,
        market_weight_after: newW.market_weight ?? weights.market_weight,
        alignment_bonus_before: weights.alignment_bonus,
        alignment_bonus_after: newW.alignment_bonus ?? weights.alignment_bonus,
        trigger_reason: 'manual_override',
        sample_size: learningEvents.length,
        adjustments_applied: adjustments,
      });

      const { error } = await (supabase as any).from('sbo_dynamic_weights').update({
        ...newW,
        updated_at: new Date().toISOString(),
      }).eq('id', 1);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Weights manually updated');
      qc.invalidateQueries({ queryKey: ['sbo-dynamic-weights'] });
      qc.invalidateQueries({ queryKey: ['sbo-weight-history'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Rollback to previous weights ──
  const rollbackWeights = useMutation({
    mutationFn: async (historyEntry: WeightHistoryEntry) => {
      // The "before" values in this history entry are what we want to restore
      const adj = historyEntry.adjustments_applied;
      if (!adj || Object.keys(adj).length === 0) throw new Error('No adjustments to rollback');

      const rollback: Record<string, number> = {};
      for (const [key, val] of Object.entries(adj)) {
        rollback[key] = (val as any).before;
      }

      // Save rollback as history
      await (supabase as any).from('sbo_decision_weight_history').insert({
        ai_weight_before: weights.ai_weight,
        ai_weight_after: rollback.ai_weight ?? weights.ai_weight,
        consensus_weight_before: weights.consensus_weight,
        consensus_weight_after: rollback.consensus_weight ?? weights.consensus_weight,
        capper_weight_before: weights.capper_weight,
        capper_weight_after: rollback.capper_weight ?? weights.capper_weight,
        roi_weight_before: weights.roi_weight,
        roi_weight_after: rollback.roi_weight ?? weights.roi_weight,
        market_weight_before: weights.market_weight,
        market_weight_after: rollback.market_weight ?? weights.market_weight,
        alignment_bonus_before: weights.alignment_bonus,
        alignment_bonus_after: rollback.alignment_bonus ?? weights.alignment_bonus,
        trigger_reason: 'rollback',
        sample_size: learningEvents.length,
        adjustments_applied: Object.fromEntries(
          Object.entries(rollback).map(([k, v]) => [k, { before: (weights as any)[k], after: v, delta: Math.round((v - (weights as any)[k]) * 1000) / 1000 }])
        ),
      });

      const { error } = await (supabase as any).from('sbo_dynamic_weights').update({
        ...rollback,
        updated_at: new Date().toISOString(),
      }).eq('id', 1);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Weights rolled back to previous state');
      qc.invalidateQueries({ queryKey: ['sbo-dynamic-weights'] });
      qc.invalidateQueries({ queryKey: ['sbo-weight-history'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Reset to defaults ──
  const resetToDefaults = useMutation({
    mutationFn: async () => {
      await (supabase as any).from('sbo_decision_weight_history').insert({
        ai_weight_before: weights.ai_weight,
        ai_weight_after: DEFAULT_WEIGHTS.ai_weight,
        consensus_weight_before: weights.consensus_weight,
        consensus_weight_after: DEFAULT_WEIGHTS.consensus_weight,
        capper_weight_before: weights.capper_weight,
        capper_weight_after: DEFAULT_WEIGHTS.capper_weight,
        roi_weight_before: weights.roi_weight,
        roi_weight_after: DEFAULT_WEIGHTS.roi_weight,
        market_weight_before: weights.market_weight,
        market_weight_after: DEFAULT_WEIGHTS.market_weight,
        alignment_bonus_before: weights.alignment_bonus,
        alignment_bonus_after: DEFAULT_WEIGHTS.alignment_bonus,
        trigger_reason: 'reset_to_defaults',
        sample_size: learningEvents.length,
        adjustments_applied: {},
      });
      const { error } = await (supabase as any).from('sbo_dynamic_weights').update({
        ai_weight: DEFAULT_WEIGHTS.ai_weight,
        consensus_weight: DEFAULT_WEIGHTS.consensus_weight,
        capper_weight: DEFAULT_WEIGHTS.capper_weight,
        roi_weight: DEFAULT_WEIGHTS.roi_weight,
        market_weight: DEFAULT_WEIGHTS.market_weight,
        alignment_bonus: DEFAULT_WEIGHTS.alignment_bonus,
        updated_at: new Date().toISOString(),
      }).eq('id', 1);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Weights reset to factory defaults');
      qc.invalidateQueries({ queryKey: ['sbo-dynamic-weights'] });
      qc.invalidateQueries({ queryKey: ['sbo-weight-history'] });
    },
  });

  // ── Recalibrate weights based on learning events ──
  const recalibrate = useMutation({
    mutationFn: async () => {
      if (weights.weights_locked) throw new Error('Weights are locked. Unlock before recalibrating.');
      if (learningEvents.length < MIN_SAMPLE_SIZE) {
        throw new Error(`Need at least ${MIN_SAMPLE_SIZE} resolved picks to recalibrate (have ${learningEvents.length})`);
      }

      // Pre-recalibration win rate
      const resolved = learningEvents.filter(e => e.result === 'won' || e.result === 'lost');
      const preWR = resolved.length > 0 ? resolved.filter(e => e.result === 'won').length / resolved.length : 0;

      const aiHigh = learningEvents.filter(e => e.ai_confidence != null && e.ai_confidence >= 70);
      const aiHighWR = aiHigh.length > 0 ? aiHigh.filter(e => e.result === 'won').length / aiHigh.length : 0.5;
      const consHigh = learningEvents.filter(e => e.capper_consensus >= 3);
      const consHighWR = consHigh.length > 0 ? consHigh.filter(e => e.result === 'won').length / consHigh.length : 0.5;
      const gradeHigh = learningEvents.filter(e => e.capper_avg_grade === 'A' || e.capper_avg_grade === 'B');
      const gradeHighWR = gradeHigh.length > 0 ? gradeHigh.filter(e => e.result === 'won').length / gradeHigh.length : 0.5;
      const roiPos = learningEvents.filter(e => e.capper_avg_roi > 0);
      const roiPosWR = roiPos.length > 0 ? roiPos.filter(e => e.result === 'won').length / roiPos.length : 0.5;
      const aligned = learningEvents.filter(e => e.alignment === 'ai_and_capper');
      const alignedWR = aligned.length > 0 ? aligned.filter(e => e.result === 'won').length / aligned.length : 0.5;

      const nudge = (wr: number) => (wr - 0.5) * 0.1;
      const proposed = {
        ai_weight: weights.ai_weight + nudge(aiHighWR),
        consensus_weight: weights.consensus_weight + nudge(consHighWR),
        capper_weight: weights.capper_weight + nudge(gradeHighWR),
        roi_weight: weights.roi_weight + nudge(roiPosWR),
        market_weight: weights.market_weight,
        alignment_bonus: alignedWR > 0.6 ? Math.min(15, weights.alignment_bonus + 1)
          : alignedWR < 0.4 ? Math.max(5, weights.alignment_bonus - 1) : weights.alignment_bonus,
      };

      const newWeights = {
        ai_weight: clampDelta(DEFAULT_WEIGHTS.ai_weight, proposed.ai_weight),
        consensus_weight: clampDelta(DEFAULT_WEIGHTS.consensus_weight, proposed.consensus_weight),
        capper_weight: clampDelta(DEFAULT_WEIGHTS.capper_weight, proposed.capper_weight),
        roi_weight: clampDelta(DEFAULT_WEIGHTS.roi_weight, proposed.roi_weight),
        market_weight: clampDelta(DEFAULT_WEIGHTS.market_weight, proposed.market_weight),
        alignment_bonus: Math.round(proposed.alignment_bonus * 10) / 10,
      };

      const adjustments: Record<string, { before: number; after: number; delta: number }> = {};
      for (const key of ['ai_weight', 'consensus_weight', 'capper_weight', 'roi_weight', 'market_weight', 'alignment_bonus'] as const) {
        const before = weights[key];
        const after = newWeights[key];
        if (before !== after) {
          adjustments[key] = { before, after, delta: Math.round((after - before) * 1000) / 1000 };
        }
      }

      await (supabase as any).from('sbo_decision_weight_history').insert({
        ai_weight_before: weights.ai_weight,
        ai_weight_after: newWeights.ai_weight,
        consensus_weight_before: weights.consensus_weight,
        consensus_weight_after: newWeights.consensus_weight,
        capper_weight_before: weights.capper_weight,
        capper_weight_after: newWeights.capper_weight,
        roi_weight_before: weights.roi_weight,
        roi_weight_after: newWeights.roi_weight,
        market_weight_before: weights.market_weight,
        market_weight_after: newWeights.market_weight,
        alignment_bonus_before: weights.alignment_bonus,
        alignment_bonus_after: newWeights.alignment_bonus,
        trigger_reason: 'daily_recalibration',
        sample_size: learningEvents.length,
        adjustments_applied: adjustments,
        pre_recal_win_rate: Math.round(preWR * 1000) / 10,
      });

      const { error } = await (supabase as any).from('sbo_dynamic_weights').update({
        ...newWeights,
        last_recalibrated_at: new Date().toISOString(),
        recalibration_count: (weights.recalibration_count || 0) + 1,
        sample_size: learningEvents.length,
        updated_at: new Date().toISOString(),
      }).eq('id', 1);
      if (error) throw error;
      return { adjustments, newWeights };
    },
    onSuccess: (result) => {
      const count = Object.keys(result?.adjustments || {}).length;
      toast.success(`Recalibrated! ${count} weight${count !== 1 ? 's' : ''} adjusted.`);
      qc.invalidateQueries({ queryKey: ['sbo-dynamic-weights'] });
      qc.invalidateQueries({ queryKey: ['sbo-weight-history'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Computed analytics ──
  const tierPerformance: TierPerformance[] = (() => {
    const tiers = ['ELITE', 'STRONG', 'WATCHLIST', 'LOW'];
    return tiers.map(tier => {
      const events = learningEvents.filter(e => e.signal_tier === tier);
      const wins = events.filter(e => e.result === 'won').length;
      const losses = events.filter(e => e.result === 'lost').length;
      const total = wins + losses;
      const roiSum = wins * 0.909 - losses;
      return { tier, wins, losses, total, winRate: total > 0 ? Math.round((wins / total) * 100) : 0, roi: total > 0 ? Math.round((roiSum / total) * 10000) / 100 : 0 };
    }).filter(t => t.total > 0);
  })();

  const factorPerformance: FactorPerformance[] = (() => {
    const factors: FactorPerformance[] = [];
    const calc = (label: string, factor: string, filter: (e: LearningEvent) => boolean) => {
      const events = learningEvents.filter(filter);
      const w = events.filter(e => e.result === 'won').length;
      const l = events.filter(e => e.result === 'lost').length;
      const t = w + l;
      if (t > 0) factors.push({ factor, bucket: label, wins: w, losses: l, winRate: Math.round((w / t) * 100), roi: Math.round(((w * 0.909 - l) / t) * 10000) / 100 });
    };
    calc('AI 80+', 'AI Confidence', e => e.ai_confidence != null && e.ai_confidence >= 80);
    calc('AI 60-79', 'AI Confidence', e => e.ai_confidence != null && e.ai_confidence >= 60 && e.ai_confidence < 80);
    calc('AI <60', 'AI Confidence', e => e.ai_confidence != null && e.ai_confidence < 60);
    calc('4+ Cappers', 'Consensus', e => e.capper_consensus >= 4);
    calc('2-3 Cappers', 'Consensus', e => e.capper_consensus >= 2 && e.capper_consensus < 4);
    calc('1 Capper', 'Consensus', e => e.capper_consensus === 1);
    for (const align of ['ai_and_capper', 'ai_only', 'capper_only']) {
      calc(align.replace(/_/g, ' '), 'Alignment', e => e.alignment === align);
    }
    return factors;
  })();

  // ── Learning Insights ──
  const insights: LearningInsights = (() => {
    const resolved = learningEvents.filter(e => e.result === 'won' || e.result === 'lost');
    const totalResolved = resolved.length;
    const overallWinRate = totalResolved > 0 ? Math.round((resolved.filter(e => e.result === 'won').length / totalResolved) * 100) : 0;

    const allFactors = factorPerformance.filter(f => (f.wins + f.losses) >= 3);
    const bestFactor = allFactors.length > 0 ? allFactors.reduce((a, b) => a.winRate > b.winRate ? a : b) : null;
    const worstFactor = allFactors.length > 0 ? allFactors.reduce((a, b) => a.winRate < b.winRate ? a : b) : null;
    const bestTier = tierPerformance.length > 0 ? tierPerformance.reduce((a, b) => a.roi > b.roi ? a : b) : null;
    const worstTier = tierPerformance.length > 0 ? tierPerformance.reduce((a, b) => a.roi < b.roi ? a : b) : null;

    // Check if last recalibration degraded performance
    const lastRecal = weightHistory.find(h => h.trigger_reason === 'daily_recalibration');
    const degradationWarning = lastRecal?.pre_recal_win_rate != null && lastRecal?.post_recal_win_rate != null
      && lastRecal.post_recal_win_rate < lastRecal.pre_recal_win_rate - 3;

    return {
      bestFactor: bestFactor ? { name: `${bestFactor.bucket}`, winRate: bestFactor.winRate } : null,
      worstFactor: worstFactor ? { name: `${worstFactor.bucket}`, winRate: worstFactor.winRate } : null,
      bestTier: bestTier ? { name: bestTier.tier, roi: bestTier.roi } : null,
      worstTier: worstTier ? { name: worstTier.tier, roi: worstTier.roi } : null,
      overallWinRate,
      totalResolved,
      learningHealthy: overallWinRate >= 50 || totalResolved < 10,
      degradationWarning: !!degradationWarning,
    };
  })();

  return {
    weights,
    weightsLoading,
    learningEvents,
    eventsLoading,
    weightHistory,
    tierPerformance,
    factorPerformance,
    insights,
    recordEvent,
    recalibrate,
    isRecalibrating: recalibrate.isPending,
    toggleWeightLock,
    setManualWeights,
    rollbackWeights,
    resetToDefaults,
    totalEvents: learningEvents.length,
    canRecalibrate: learningEvents.length >= MIN_SAMPLE_SIZE && !weights.weights_locked,
    DEFAULT_WEIGHTS,
  };
}
