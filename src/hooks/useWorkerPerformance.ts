/**
 * WORKER PERFORMANCE HOOKS
 * 
 * Queries and mutations for worker skill profiles,
 * performance snapshots, and cycle time benchmarks.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, subDays } from 'date-fns';

// Re-export worker type from production portal
export { useProductionWorkers } from './useProductionPortal';

// ============================================================
// TYPES
// ============================================================

export interface WorkerSkillProfile {
  id: string;
  worker_id: string;
  office_id: string | null;
  
  // Calculated metrics
  avg_tube_fill_seconds: number | null;
  avg_sticker_apply_seconds: number | null;
  defect_rate_per_thousand: number | null;
  boxes_per_hour: number | null;
  
  // Rolling periods
  rolling_7_day_boxes: number;
  rolling_7_day_defects: number;
  rolling_7_day_hours: number;
  rolling_30_day_boxes: number;
  rolling_30_day_defects: number;
  rolling_30_day_hours: number;
  rolling_90_day_boxes: number;
  rolling_90_day_defects: number;
  rolling_90_day_hours: number;
  
  // Attendance
  attendance_rate_7d: number | null;
  attendance_rate_30d: number | null;
  
  // Trends
  trend_speed: 'improving' | 'stable' | 'declining';
  trend_quality: 'improving' | 'stable' | 'declining';
  
  // Scores
  speed_score: number;
  quality_score: number;
  reliability_score: number;
  overall_score: number;
  
  // Metadata
  last_calculated_at: string;
  created_at: string;
  updated_at: string;
}

export interface WorkerPerformanceSnapshot {
  id: string;
  worker_id: string;
  office_id: string | null;
  snapshot_date: string;
  batches_participated: number;
  boxes_produced: number;
  tubes_filled: number;
  stickers_applied: number;
  defects_count: number;
  defect_rate: number | null;
  hours_worked: number | null;
  avg_tube_fill_seconds: number | null;
  avg_sticker_apply_seconds: number | null;
  boxes_per_hour: number | null;
  created_at: string;
}

export interface CycleBenchmark {
  id: string;
  scope_type: 'global' | 'office' | 'brand';
  scope_id: string | null;
  brand: string | null;
  expected_tube_fill_seconds: number;
  expected_sticker_apply_seconds: number;
  expected_batch_completion_minutes: number;
  expected_boxes_per_hour: number;
  variance_threshold_pct: number;
  set_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// SKILL PROFILE HOOKS
// ============================================================

export function useWorkerSkillProfiles(officeId: string | undefined) {
  return useQuery({
    queryKey: ['worker-skill-profiles', officeId],
    queryFn: async () => {
      if (!officeId) return [];
      
      // Use type assertion since table may not be in generated types yet
      const { data, error } = await supabase
        .from('production_worker_skill_profiles' as any)
        .select('*')
        .eq('office_id', officeId)
        .order('overall_score', { ascending: false });
      
      if (error) throw error;
      return (data || []) as unknown as WorkerSkillProfile[];
    },
    enabled: !!officeId,
  });
}

export function useWorkerSkillProfile(workerId: string | undefined, officeId: string | undefined) {
  return useQuery({
    queryKey: ['worker-skill-profile', workerId, officeId],
    queryFn: async () => {
      if (!workerId) return null;
      
      let query = supabase
        .from('production_worker_skill_profiles' as any)
        .select('*')
        .eq('worker_id', workerId);
      
      if (officeId) {
        query = query.eq('office_id', officeId);
      }
      
      const { data, error } = await query.maybeSingle();
      
      if (error) throw error;
      return data as unknown as WorkerSkillProfile | null;
    },
    enabled: !!workerId,
  });
}

// ============================================================
// PERFORMANCE SNAPSHOT HOOKS
// ============================================================

export function useWorkerPerformanceHistory(workerId: string | undefined, days: number = 30) {
  return useQuery({
    queryKey: ['worker-performance-history', workerId, days],
    queryFn: async () => {
      if (!workerId) return [];
      
      const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');
      
      // Use type assertion since table may not be in generated types yet
      const { data, error } = await supabase
        .from('production_worker_performance_snapshots' as any)
        .select('*')
        .eq('worker_id', workerId)
        .gte('snapshot_date', startDate)
        .order('snapshot_date', { ascending: true });
      
      if (error) throw error;
      return (data || []) as unknown as WorkerPerformanceSnapshot[];
    },
    enabled: !!workerId,
  });
}

// ============================================================
// CYCLE BENCHMARK HOOKS
// ============================================================

export function useCycleBenchmarks(officeId?: string) {
  return useQuery({
    queryKey: ['cycle-benchmarks', officeId],
    queryFn: async () => {
      // Use type assertion since table may not be in generated types yet
      let query = supabase
        .from('production_cycle_benchmarks' as any)
        .select('*')
        .order('scope_type');
      
      if (officeId) {
        // Get global + office-specific benchmarks
        query = query.or(`scope_id.is.null,scope_id.eq.${officeId}`);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return (data || []) as unknown as CycleBenchmark[];
    },
  });
}

export function useUpdateCycleBenchmark() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CycleBenchmark> & { id: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      // Use type assertion since table may not be in generated types yet
      const { data, error } = await (supabase
        .from('production_cycle_benchmarks' as any)
        .update({
          ...updates,
          set_by: userData.user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single());
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycle-benchmarks'] });
      toast({ title: 'Benchmark updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update benchmark', description: error.message, variant: 'destructive' });
    },
  });
}

// ============================================================
// SKILL PROFILE CALCULATION (client-side helper)
// ============================================================

export function calculateSkillScores(
  snapshots: WorkerPerformanceSnapshot[],
  benchmarks: CycleBenchmark[]
): Partial<WorkerSkillProfile> {
  if (snapshots.length === 0) {
    return {
      speed_score: 50,
      quality_score: 50,
      reliability_score: 50,
      overall_score: 50,
      trend_speed: 'stable',
      trend_quality: 'stable',
    };
  }

  // Get benchmark (use global as default)
  const benchmark = benchmarks.find(b => b.scope_type === 'global') || {
    expected_tube_fill_seconds: 8,
    expected_sticker_apply_seconds: 5,
    expected_boxes_per_hour: 10,
  };

  // Calculate rolling metrics
  const last7 = snapshots.slice(-7);
  const last30 = snapshots.slice(-30);
  
  const rolling_7_day_boxes = last7.reduce((sum, s) => sum + (s.boxes_produced || 0), 0);
  const rolling_7_day_defects = last7.reduce((sum, s) => sum + (s.defects_count || 0), 0);
  const rolling_7_day_hours = last7.reduce((sum, s) => sum + (s.hours_worked || 0), 0);
  
  const rolling_30_day_boxes = last30.reduce((sum, s) => sum + (s.boxes_produced || 0), 0);
  const rolling_30_day_defects = last30.reduce((sum, s) => sum + (s.defects_count || 0), 0);
  const rolling_30_day_hours = last30.reduce((sum, s) => sum + (s.hours_worked || 0), 0);

  // Average metrics
  const avgTubeFill = snapshots.reduce((sum, s) => sum + (s.avg_tube_fill_seconds || 0), 0) / snapshots.length;
  const avgStickerApply = snapshots.reduce((sum, s) => sum + (s.avg_sticker_apply_seconds || 0), 0) / snapshots.length;
  const boxesPerHour = rolling_7_day_hours > 0 ? rolling_7_day_boxes / rolling_7_day_hours : 0;
  const defectRate = rolling_30_day_boxes > 0 ? (rolling_30_day_defects / rolling_30_day_boxes) * 1000 : 0;

  // Speed score (compare to benchmark)
  const speedRatio = avgTubeFill > 0 ? benchmark.expected_tube_fill_seconds / avgTubeFill : 1;
  const speed_score = Math.min(100, Math.max(0, Math.round(speedRatio * 50 + 25)));

  // Quality score (lower defects = higher score)
  const quality_score = Math.min(100, Math.max(0, Math.round(100 - defectRate * 2)));

  // Reliability score (based on consistency)
  const avgDaysWorked = snapshots.filter(s => (s.hours_worked || 0) > 0).length;
  const reliability_score = Math.min(100, Math.max(0, Math.round((avgDaysWorked / snapshots.length) * 100)));

  // Overall score (weighted average)
  const overall_score = Math.round(speed_score * 0.3 + quality_score * 0.5 + reliability_score * 0.2);

  // Trend detection
  const recentAvgSpeed = last7.reduce((sum, s) => sum + (s.avg_tube_fill_seconds || 0), 0) / (last7.length || 1);
  const olderAvgSpeed = snapshots.slice(0, -7).reduce((sum, s) => sum + (s.avg_tube_fill_seconds || 0), 0) / (snapshots.slice(0, -7).length || 1);
  const speedChange = olderAvgSpeed > 0 ? ((olderAvgSpeed - recentAvgSpeed) / olderAvgSpeed) * 100 : 0;
  
  const recentDefects = last7.reduce((sum, s) => sum + (s.defects_count || 0), 0);
  const olderDefects = snapshots.slice(0, -7).reduce((sum, s) => sum + (s.defects_count || 0), 0) / (snapshots.slice(0, -7).length || 1) * 7;
  const qualityChange = olderDefects > 0 ? ((olderDefects - recentDefects) / olderDefects) * 100 : 0;

  return {
    avg_tube_fill_seconds: avgTubeFill || null,
    avg_sticker_apply_seconds: avgStickerApply || null,
    defect_rate_per_thousand: defectRate || null,
    boxes_per_hour: boxesPerHour || null,
    rolling_7_day_boxes,
    rolling_7_day_defects,
    rolling_7_day_hours,
    rolling_30_day_boxes,
    rolling_30_day_defects,
    rolling_30_day_hours,
    speed_score,
    quality_score,
    reliability_score,
    overall_score,
    trend_speed: speedChange > 5 ? 'improving' : speedChange < -5 ? 'declining' : 'stable',
    trend_quality: qualityChange > 5 ? 'improving' : qualityChange < -5 ? 'declining' : 'stable',
  };
}
