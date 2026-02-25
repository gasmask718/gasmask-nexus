/**
 * SUPERVISOR PERFORMANCE ENGINE
 * Rolling 30-day scorecard with normalization + composite index.
 * Display-only. No incentives. No payroll impact.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';

export interface SupervisorRawMetrics {
  office_id: string;
  supervisor_user_id: string | null;
  total_days: number;
  goal_hit_days: number;
  goal_completion_rate: number;
  avg_boxes_per_worker: number;
  reopen_rate: number;
  material_efficiency_delta: number | null;
  calculated_at: string;
}

export type SupervisorTier = 'Elite' | 'Strong' | 'Developing' | 'Needs Support';

export interface SupervisorScorecard extends SupervisorRawMetrics {
  goal_score: number;
  efficiency_score: number;
  reopen_score: number;
  material_score: number;
  composite_index: number;
  supervisor_name?: string;
  office_name?: string;
  tier: SupervisorTier;
  stability_score: number | null;
  expansion_ready: boolean;
}

export interface SupervisorSnapshot {
  id: string;
  office_id: string;
  supervisor_user_id: string | null;
  snapshot_month: string;
  composite_index: number;
  goal_score: number;
  efficiency_score: number;
  reopen_score: number;
  material_score: number;
  performance_version: number;
  created_at: string;
}

// ── NORMALIZATION ENGINE ──

function normalizeGoalScore(rate: number): number {
  return Math.min(Math.max(rate, 0), 100);
}

function normalizeEfficiencyScore(avgBoxesPerWorker: number, officeAvg: number): number {
  if (officeAvg <= 0) return 100;
  const raw = (avgBoxesPerWorker / officeAvg) * 100;
  return Math.min(Math.max(raw, 0), 120);
}

function normalizeReopenScore(reopenRate: number): number {
  const raw = (1 - reopenRate / 100) * 100;
  return Math.min(Math.max(raw, 0), 100);
}

function normalizeMaterialScore(delta: number | null): number {
  if (delta === null || delta === undefined) return 100;
  if (delta >= 0) return 100;
  const raw = 100 - Math.abs(delta) * 100;
  return Math.max(raw, 70); // Clamp at 70 to avoid volatility panic
}

function computeComposite(
  goalScore: number,
  efficiencyScore: number,
  reopenScore: number,
  materialScore: number
): number {
  return Math.round(
    goalScore * 0.4 +
    efficiencyScore * 0.4 +
    reopenScore * 0.1 +
    materialScore * 0.1
  );
}

function classifyTier(compositeIndex: number): SupervisorTier {
  if (compositeIndex >= 100) return 'Elite';
  if (compositeIndex >= 90) return 'Strong';
  if (compositeIndex >= 80) return 'Developing';
  return 'Needs Support';
}

function computeStabilityScore(composites: number[]): number | null {
  if (composites.length < 2) return null;
  const mean = composites.reduce((s, v) => s + v, 0) / composites.length;
  const variance = composites.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / composites.length;
  return Math.round(Math.sqrt(variance) * 10) / 10;
}

function checkExpansionReady(
  compositeIndex: number,
  reopenRate: number,
  goalCompletionRate: number,
  stabilityScore: number | null
): boolean {
  return (
    compositeIndex >= 95 &&
    reopenRate < 3 &&
    goalCompletionRate >= 90 &&
    (stabilityScore === null || stabilityScore <= 5)
  );
}

// ── HOOKS ──

export function useSupervisor30dPerformance(officeId?: string) {
  return useQuery({
    queryKey: ['supervisor-30d-performance', officeId],
    queryFn: async () => {
      let query = supabase
        .from('v_supervisor_30d_performance' as any)
        .select('*');
      if (officeId) {
        query = query.eq('office_id', officeId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as SupervisorRawMetrics[];
    },
  });
}

export function useSupervisorScorecards(officeId?: string) {
  const { data: rawMetrics = [], isLoading, error } = useSupervisor30dPerformance(officeId);
  const { data: snapshots = [] } = useSupervisorSnapshots(officeId);

  const scorecards = useMemo<SupervisorScorecard[]>(() => {
    if (!rawMetrics.length) return [];

    const officeAvgs = new Map<string, number>();
    const officeGroups = new Map<string, SupervisorRawMetrics[]>();
    
    rawMetrics.forEach(m => {
      const list = officeGroups.get(m.office_id) || [];
      list.push(m);
      officeGroups.set(m.office_id, list);
    });

    officeGroups.forEach((group, oid) => {
      const totalBoxes = group.reduce((s, g) => s + (g.avg_boxes_per_worker || 0), 0);
      officeAvgs.set(oid, totalBoxes / group.length);
    });

    return rawMetrics.map(m => {
      const officeAvg = officeAvgs.get(m.office_id) || 1;
      const goalScore = normalizeGoalScore(m.goal_completion_rate || 0);
      const efficiencyScore = normalizeEfficiencyScore(m.avg_boxes_per_worker || 0, officeAvg);
      const reopenScore = normalizeReopenScore(m.reopen_rate || 0);
      const materialScore = normalizeMaterialScore(m.material_efficiency_delta);
      const compositeIndex = computeComposite(goalScore, efficiencyScore, reopenScore, materialScore);

      // Stability: std deviation of composite across last 3 snapshot windows
      const historicalComposites = snapshots
        .filter(s => s.supervisor_user_id === m.supervisor_user_id && s.office_id === m.office_id)
        .slice(0, 3)
        .map(s => s.composite_index);
      const stabilityScore = computeStabilityScore([compositeIndex, ...historicalComposites]);

      const tier = classifyTier(compositeIndex);
      const expansionReady = checkExpansionReady(
        compositeIndex,
        m.reopen_rate || 0,
        m.goal_completion_rate || 0,
        stabilityScore
      );

      return {
        ...m,
        goal_score: goalScore,
        efficiency_score: efficiencyScore,
        reopen_score: reopenScore,
        material_score: materialScore,
        composite_index: compositeIndex,
        tier,
        stability_score: stabilityScore,
        expansion_ready: expansionReady,
      };
    });
  }, [rawMetrics, snapshots]);

  return { data: scorecards, isLoading, error };
}

export function useSupervisorSnapshots(officeId?: string) {
  return useQuery({
    queryKey: ['supervisor-performance-snapshots', officeId],
    queryFn: async () => {
      let query = supabase
        .from('supervisor_performance_snapshots')
        .select('*')
        .order('snapshot_month', { ascending: false })
        .limit(12);
      if (officeId) {
        query = query.eq('office_id', officeId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as SupervisorSnapshot[];
    },
  });
}
