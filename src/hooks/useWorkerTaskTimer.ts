/**
 * Worker Task Timer Hooks
 * CRUD for production_worker_tasks + baselines + anomaly detection
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type WorkerTaskType = 'sleeving' | 'sticker' | 'sleeving_and_sticker';
export type WorkerTaskStatus = 'running' | 'completed' | 'voided';

export interface WorkerTask {
  id: string;
  office_id: string;
  worker_user_id: string;
  worker_display_name: string | null;
  task_type: WorkerTaskType;
  product_type: string;
  standard_unit_label: string;
  standard_unit_quantity: number;
  actual_units_completed: number;
  normalized_minutes_per_1000: number | null;
  normalized_units_per_hour: number | null;
  brand: string | null;
  batch_id: string | null;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  notes: string | null;
  status: WorkerTaskStatus;
  void_reason: string | null;
  created_at: string;
  created_by: string;
}

export interface LaborBaseline {
  id: string;
  office_id: string | null;
  task_type: WorkerTaskType;
  baseline_minutes_per_1000: number;
  sample_count: number;
  last_updated_at: string;
}

const TASK_KEYS = {
  myTasks: (officeId: string, userId: string) => ['worker-tasks', officeId, userId],
  running: (officeId: string, userId: string) => ['worker-tasks-running', officeId, userId],
  today: (officeId: string, userId: string) => ['worker-tasks-today', officeId, userId],
  allOffice: (officeId: string) => ['worker-tasks-office', officeId],
  baselines: (officeId?: string) => ['labor-baselines', officeId],
  analytics: (officeId: string) => ['labor-analytics', officeId],
};

/** Get current user's running task */
export function useRunningTask(officeId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: TASK_KEYS.running(officeId || '', userId || ''),
    queryFn: async () => {
      if (!officeId || !userId) return null;
      const { data, error } = await supabase
        .from('production_worker_tasks' as any)
        .select('*')
        .eq('office_id', officeId)
        .eq('worker_user_id', userId)
        .eq('status', 'running')
        .maybeSingle();
      if (error) throw error;
      return data as unknown as WorkerTask | null;
    },
    enabled: !!officeId && !!userId,
    refetchInterval: 5000,
  });
}

/** Get today's completed tasks for current user */
export function useTodayTasks(officeId: string | undefined, userId: string | undefined) {
  const today = new Date().toISOString().split('T')[0];
  return useQuery({
    queryKey: TASK_KEYS.today(officeId || '', userId || ''),
    queryFn: async () => {
      if (!officeId || !userId) return [];
      const { data, error } = await supabase
        .from('production_worker_tasks' as any)
        .select('*')
        .eq('office_id', officeId)
        .eq('worker_user_id', userId)
        .gte('started_at', `${today}T00:00:00`)
        .order('started_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as WorkerTask[];
    },
    enabled: !!officeId && !!userId,
  });
}

/** Get all tasks for an office (manager view) */
export function useOfficeTasks(officeId: string | undefined, dateRange?: { from: string; to: string }) {
  return useQuery({
    queryKey: [...TASK_KEYS.allOffice(officeId || ''), dateRange],
    queryFn: async () => {
      if (!officeId) return [];
      let q = supabase
        .from('production_worker_tasks' as any)
        .select('*')
        .eq('office_id', officeId)
        .eq('status', 'completed')
        .order('started_at', { ascending: false })
        .limit(500);
      if (dateRange?.from) q = q.gte('started_at', dateRange.from);
      if (dateRange?.to) q = q.lte('started_at', dateRange.to);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as WorkerTask[];
    },
    enabled: !!officeId,
  });
}

/** Get labor baselines */
export function useLaborBaselines(officeId?: string) {
  return useQuery({
    queryKey: TASK_KEYS.baselines(officeId),
    queryFn: async () => {
      let q = supabase.from('production_labor_baselines' as any).select('*');
      if (officeId) {
        q = q.or(`office_id.eq.${officeId},office_id.is.null`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as LaborBaseline[];
    },
  });
}

/** Start a new task */
export function useStartTask() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (params: {
      office_id: string;
      worker_user_id: string;
      worker_display_name?: string;
      task_type: WorkerTaskType;
      brand?: string;
      batch_id?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('production_worker_tasks' as any)
        .insert({
          office_id: params.office_id,
          worker_user_id: params.worker_user_id,
          worker_display_name: params.worker_display_name || null,
          task_type: params.task_type,
          brand: params.brand || null,
          batch_id: params.batch_id || null,
          notes: params.notes || null,
          created_by: params.worker_user_id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as WorkerTask;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: TASK_KEYS.running(vars.office_id, vars.worker_user_id) });
      qc.invalidateQueries({ queryKey: TASK_KEYS.today(vars.office_id, vars.worker_user_id) });
      toast({ title: 'Timer started', description: 'Task timer is now running.' });
    },
    onError: (err: Error) => {
      const msg = err.message.includes('idx_unique_running_task')
        ? 'You already have a running task. Finish or void it first.'
        : err.message;
      toast({ title: 'Failed to start', description: msg, variant: 'destructive' });
    },
  });
}

/** Finish a running task */
export function useFinishTask() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ taskId, officeId, userId, actualUnits }: {
      taskId: string; officeId: string; userId: string; actualUnits?: number;
    }) => {
      const updatePayload: Record<string, any> = { status: 'completed' };
      if (actualUnits !== undefined && actualUnits > 0) {
        updatePayload.actual_units_completed = actualUnits;
      }
      const { data, error } = await supabase
        .from('production_worker_tasks' as any)
        .update(updatePayload)
        .eq('id', taskId)
        .select()
        .single();
      if (error) throw error;
      
      const task = data as unknown as WorkerTask;
      
      // Anti-gaming: detect anomalies
      await detectAnomalies(task, officeId, userId);
      
      return { task, officeId, userId };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: TASK_KEYS.running(result.officeId, result.userId) });
      qc.invalidateQueries({ queryKey: TASK_KEYS.today(result.officeId, result.userId) });
      qc.invalidateQueries({ queryKey: TASK_KEYS.allOffice(result.officeId) });
      const units = result.task.actual_units_completed || 1000;
      const mins = result.task.duration_seconds ? (result.task.duration_seconds / 60).toFixed(1) : '?';
      toast({ title: 'Task completed!', description: `Finished ${units.toLocaleString()} tubes in ${mins} minutes.` });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to finish', description: err.message, variant: 'destructive' });
    },
  });
}

/** Void a task */
export function useVoidTask() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ taskId, officeId, userId, reason }: { taskId: string; officeId: string; userId: string; reason: string }) => {
      const { error } = await supabase
        .from('production_worker_tasks' as any)
        .update({ status: 'voided', void_reason: reason })
        .eq('id', taskId);
      if (error) throw error;
      
      // Check excessive voids today
      const today = new Date().toISOString().split('T')[0];
      const { data: voidedToday } = await supabase
        .from('production_worker_tasks' as any)
        .select('id')
        .eq('office_id', officeId)
        .eq('worker_user_id', userId)
        .eq('status', 'voided')
        .gte('started_at', `${today}T00:00:00`);
      
      if (voidedToday && voidedToday.length >= 3) {
        await supabase.from('labor_anomaly_events' as any).insert({
          task_id: taskId,
          worker_user_id: userId,
          office_id: officeId,
          anomaly_type: 'excessive_voids',
          details: { void_count_today: voidedToday.length, reason },
        });
      }
      
      return { officeId, userId };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: TASK_KEYS.running(result.officeId, result.userId) });
      qc.invalidateQueries({ queryKey: TASK_KEYS.today(result.officeId, result.userId) });
      toast({ title: 'Task voided' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to void', description: err.message, variant: 'destructive' });
    },
  });
}

/** Anti-gaming anomaly detection */
async function detectAnomalies(task: WorkerTask, officeId: string, userId: string) {
  const anomalies: Array<{ type: string; details: Record<string, any> }> = [];
  
  // Short duration: < 5 minutes
  if (task.duration_seconds && task.duration_seconds < 300) {
    anomalies.push({
      type: 'short_duration',
      details: { duration_seconds: task.duration_seconds, threshold: 300 },
    });
  }
  
  // High units: > 2000
  if (task.actual_units_completed > 2000) {
    anomalies.push({
      type: 'high_units',
      details: { actual_units: task.actual_units_completed, threshold: 2000 },
    });
  }
  
  for (const a of anomalies) {
    await supabase.from('labor_anomaly_events' as any).insert({
      task_id: task.id,
      worker_user_id: userId,
      office_id: officeId,
      anomaly_type: a.type,
      details: a.details,
    });
  }
}

/** Update notes on a running task */
export function useUpdateTaskNotes() {
  return useMutation({
    mutationFn: async ({ taskId, notes }: { taskId: string; notes: string }) => {
      const { error } = await supabase
        .from('production_worker_tasks' as any)
        .update({ notes })
        .eq('id', taskId);
      if (error) throw error;
    },
  });
}

/** Compute analytics from completed tasks — with normalized metrics + performance score */
export function computeLaborAnalytics(tasks: WorkerTask[]) {
  const completed = tasks.filter(t => t.status === 'completed' && t.duration_seconds);
  if (completed.length === 0) return null;

  const byType: Record<string, { totalNorm: number; count: number; durations: number[]; totalUnits: number }> = {};
  const byWorker: Record<string, {
    name: string; totalNorm: number; count: number; durations: number[];
    totalUnits: number; totalHours: number;
  }> = {};

  for (const t of completed) {
    const secs = t.duration_seconds!;
    const mins = secs / 60;
    const units = t.actual_units_completed || 1000;
    const normMin = units > 0 ? (mins / units) * 1000 : mins;

    // By task type
    if (!byType[t.task_type]) byType[t.task_type] = { totalNorm: 0, count: 0, durations: [], totalUnits: 0 };
    byType[t.task_type].totalNorm += normMin;
    byType[t.task_type].count++;
    byType[t.task_type].durations.push(normMin);
    byType[t.task_type].totalUnits += units;

    // By worker
    const wKey = t.worker_user_id;
    const wName = t.worker_display_name || 'Unknown';
    if (!byWorker[wKey]) byWorker[wKey] = { name: wName, totalNorm: 0, count: 0, durations: [], totalUnits: 0, totalHours: 0 };
    byWorker[wKey].totalNorm += normMin;
    byWorker[wKey].count++;
    byWorker[wKey].durations.push(normMin);
    byWorker[wKey].totalUnits += units;
    byWorker[wKey].totalHours += secs / 3600;
  }

  const taskTypeStats = Object.entries(byType).map(([type, data]) => {
    const avg = data.totalNorm / data.count;
    const unitsPerHour = data.count > 0 && data.totalNorm > 0
      ? (data.totalUnits / (data.totalNorm * data.count / 60 / 1000 * data.count)) // simplify
      : 0;
    return {
      task_type: type,
      avg_minutes: avg,
      count: data.count,
      total_hours: data.durations.reduce((s, d) => s + d, 0) / 60,
      total_units: data.totalUnits,
      units_per_hour: data.totalUnits / (data.durations.reduce((s, d) => s + d, 0) / 60) || 0,
      min_minutes: Math.min(...data.durations),
      max_minutes: Math.max(...data.durations),
    };
  });

  const workerStats = Object.entries(byWorker)
    .map(([id, data]) => {
      const avg = data.totalNorm / data.count;
      const variance = data.durations.reduce((s, d) => s + Math.pow(d - avg, 2), 0) / data.count;
      const stdDev = Math.sqrt(variance);
      const performanceScore = (avg * 0.7) + (stdDev * 0.3);
      const inconsistent = avg > 0 && stdDev > avg * 0.2;
      return {
        worker_id: id,
        worker_name: data.name,
        avg_minutes: avg,
        count: data.count,
        total_hours: data.totalHours,
        total_units: data.totalUnits,
        units_per_hour: data.totalHours > 0 ? data.totalUnits / data.totalHours : 0,
        std_dev: stdDev,
        performance_score: performanceScore,
        inconsistent,
      };
    })
    .sort((a, b) => a.performance_score - b.performance_score);

  // Efficiency trend (30-day)
  const totalUnits = completed.reduce((s, t) => s + (t.actual_units_completed || 1000), 0);
  const totalHours = completed.reduce((s, t) => s + (t.duration_seconds! / 3600), 0);

  return {
    taskTypeStats,
    workerStats,
    totalCompleted: completed.length,
    totalHours,
    totalUnits,
    laborEfficiencyRatio: totalHours > 0 ? totalUnits / totalHours : 0,
  };
}

/** Get variance level for a task against baseline */
export function getTaskVarianceLevel(durationMinutes: number, baselineMinutes: number | undefined): 'normal' | 'amber' | 'red' {
  if (!baselineMinutes || baselineMinutes <= 0) return 'normal';
  const ratio = durationMinutes / baselineMinutes;
  if (ratio > 1.30) return 'red';
  if (ratio > 1.15) return 'amber';
  return 'normal';
}

export const TASK_TYPE_LABELS: Record<WorkerTaskType, string> = {
  sleeving: 'Sleeving',
  sticker: 'Stickering',
  sleeving_and_sticker: 'Sleeving + Stickering',
};
