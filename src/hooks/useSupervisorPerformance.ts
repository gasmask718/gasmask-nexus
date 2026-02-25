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

export interface SupervisorScorecard extends SupervisorRawMetrics {
  goal_score: number;
  efficiency_score: number;
  reopen_score: number;
  material_score: number;
  composite_index: number;
  supervisor_name?: string;
  office_name?: string;
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

  const scorecards = useMemo<SupervisorScorecard[]>(() => {
    if (!rawMetrics.length) return [];

    // Compute office-level averages for normalization
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

      return {
        ...m,
        goal_score: goalScore,
        efficiency_score: efficiencyScore,
        reopen_score: reopenScore,
        material_score: materialScore,
        composite_index: compositeIndex,
      };
    });
  }, [rawMetrics]);

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
