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
}

// ── Default weights (fallback) ──
const DEFAULT_WEIGHTS: DynamicWeights = {
  ai_weight: 0.40,
  consensus_weight: 0.15,
  capper_weight: 0.20,
  roi_weight: 0.15,
  market_weight: 0.10,
  alignment_bonus: 10,
  last_recalibrated_at: null,
  recalibration_count: 0,
  sample_size: 0,
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

  // ── Recalibrate weights based on learning events ──
  const recalibrate = useMutation({
    mutationFn: async () => {
      if (learningEvents.length < MIN_SAMPLE_SIZE) {
        throw new Error(`Need at least ${MIN_SAMPLE_SIZE} resolved picks to recalibrate (have ${learningEvents.length})`);
      }

      // Calculate factor performance
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

      // Adjust: if factor WR > 55%, nudge weight up; if < 45%, nudge down
      const nudge = (wr: number) => (wr - 0.5) * 0.1; // max ±5% per factor

      const proposed = {
        ai_weight: weights.ai_weight + nudge(aiHighWR),
        consensus_weight: weights.consensus_weight + nudge(consHighWR),
        capper_weight: weights.capper_weight + nudge(gradeHighWR),
        roi_weight: weights.roi_weight + nudge(roiPosWR),
        market_weight: weights.market_weight,
        alignment_bonus: alignedWR > 0.6 ? Math.min(15, weights.alignment_bonus + 1) : alignedWR < 0.4 ? Math.max(5, weights.alignment_bonus - 1) : weights.alignment_bonus,
      };

      // Clamp all adjustments
      const newWeights = {
        ai_weight: clampDelta(DEFAULT_WEIGHTS.ai_weight, proposed.ai_weight),
        consensus_weight: clampDelta(DEFAULT_WEIGHTS.consensus_weight, proposed.consensus_weight),
        capper_weight: clampDelta(DEFAULT_WEIGHTS.capper_weight, proposed.capper_weight),
        roi_weight: clampDelta(DEFAULT_WEIGHTS.roi_weight, proposed.roi_weight),
        market_weight: clampDelta(DEFAULT_WEIGHTS.market_weight, proposed.market_weight),
        alignment_bonus: Math.round(proposed.alignment_bonus * 10) / 10,
      };

      // Build adjustments log
      const adjustments: Record<string, { before: number; after: number; delta: number }> = {};
      for (const key of ['ai_weight', 'consensus_weight', 'capper_weight', 'roi_weight', 'market_weight', 'alignment_bonus'] as const) {
        const before = weights[key];
        const after = newWeights[key];
        if (before !== after) {
          adjustments[key] = { before, after, delta: Math.round((after - before) * 1000) / 1000 };
        }
      }

      // Save weight history
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
      });

      // Update dynamic weights
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
      return {
        tier,
        wins,
        losses,
        total,
        winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
        roi: total > 0 ? Math.round((roiSum / total) * 10000) / 100 : 0,
      };
    }).filter(t => t.total > 0);
  })();

  const factorPerformance: FactorPerformance[] = (() => {
    const factors: FactorPerformance[] = [];
    // AI confidence buckets
    const aiBuckets = [
      { label: 'AI 80+', filter: (e: LearningEvent) => e.ai_confidence != null && e.ai_confidence >= 80 },
      { label: 'AI 60-79', filter: (e: LearningEvent) => e.ai_confidence != null && e.ai_confidence >= 60 && e.ai_confidence < 80 },
      { label: 'AI <60', filter: (e: LearningEvent) => e.ai_confidence != null && e.ai_confidence < 60 },
    ];
    for (const b of aiBuckets) {
      const events = learningEvents.filter(b.filter);
      const w = events.filter(e => e.result === 'won').length;
      const l = events.filter(e => e.result === 'lost').length;
      const t = w + l;
      if (t > 0) factors.push({ factor: 'AI Confidence', bucket: b.label, wins: w, losses: l, winRate: Math.round((w/t)*100), roi: Math.round(((w*0.909-l)/t)*10000)/100 });
    }
    // Consensus buckets
    const consBuckets = [
      { label: '4+ Cappers', filter: (e: LearningEvent) => e.capper_consensus >= 4 },
      { label: '2-3 Cappers', filter: (e: LearningEvent) => e.capper_consensus >= 2 && e.capper_consensus < 4 },
      { label: '1 Capper', filter: (e: LearningEvent) => e.capper_consensus === 1 },
    ];
    for (const b of consBuckets) {
      const events = learningEvents.filter(b.filter);
      const w = events.filter(e => e.result === 'won').length;
      const l = events.filter(e => e.result === 'lost').length;
      const t = w + l;
      if (t > 0) factors.push({ factor: 'Consensus', bucket: b.label, wins: w, losses: l, winRate: Math.round((w/t)*100), roi: Math.round(((w*0.909-l)/t)*10000)/100 });
    }
    // Alignment
    for (const align of ['ai_and_capper', 'ai_only', 'capper_only']) {
      const events = learningEvents.filter(e => e.alignment === align);
      const w = events.filter(e => e.result === 'won').length;
      const l = events.filter(e => e.result === 'lost').length;
      const t = w + l;
      if (t > 0) factors.push({ factor: 'Alignment', bucket: align.replace(/_/g, ' '), wins: w, losses: l, winRate: Math.round((w/t)*100), roi: Math.round(((w*0.909-l)/t)*10000)/100 });
    }
    return factors;
  })();

  return {
    weights,
    weightsLoading,
    learningEvents,
    eventsLoading,
    weightHistory,
    tierPerformance,
    factorPerformance,
    recordEvent,
    recalibrate,
    isRecalibrating: recalibrate.isPending,
    totalEvents: learningEvents.length,
    canRecalibrate: learningEvents.length >= MIN_SAMPLE_SIZE,
  };
}
