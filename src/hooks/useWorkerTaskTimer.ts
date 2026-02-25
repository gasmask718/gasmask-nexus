/**
 * Worker Task Timer Hooks
 * CRUD for production_worker_tasks + baselines
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
    refetchInterval: 5000, // Keep timer in sync
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
    mutationFn: async ({ taskId, officeId, userId }: { taskId: string; officeId: string; userId: string }) => {
      const { data, error } = await supabase
        .from('production_worker_tasks' as any)
        .update({ status: 'completed' })
        .eq('id', taskId)
        .select()
        .single();
      if (error) throw error;
      return { task: data as unknown as WorkerTask, officeId, userId };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: TASK_KEYS.running(result.officeId, result.userId) });
      qc.invalidateQueries({ queryKey: TASK_KEYS.today(result.officeId, result.userId) });
      qc.invalidateQueries({ queryKey: TASK_KEYS.allOffice(result.officeId) });
      const mins = result.task.duration_seconds ? (result.task.duration_seconds / 60).toFixed(1) : '?';
      toast({ title: 'Task completed!', description: `Finished 1,000 tubes in ${mins} minutes.` });
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

/** Update notes on a running task */
export function useUpdateTaskNotes() {
  const qc = useQueryClient();
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

/** Compute analytics from completed tasks */
export function computeLaborAnalytics(tasks: WorkerTask[]) {
  const completed = tasks.filter(t => t.status === 'completed' && t.duration_seconds);
  if (completed.length === 0) return null;

  const byType: Record<string, { total: number; count: number; durations: number[] }> = {};
  const byWorker: Record<string, { name: string; total: number; count: number; durations: number[] }> = {};

  for (const t of completed) {
    const secs = t.duration_seconds!;
    const mins = secs / 60;

    // By task type
    if (!byType[t.task_type]) byType[t.task_type] = { total: 0, count: 0, durations: [] };
    byType[t.task_type].total += mins;
    byType[t.task_type].count++;
    byType[t.task_type].durations.push(mins);

    // By worker
    const wKey = t.worker_user_id;
    const wName = t.worker_display_name || 'Unknown';
    if (!byWorker[wKey]) byWorker[wKey] = { name: wName, total: 0, count: 0, durations: [] };
    byWorker[wKey].total += mins;
    byWorker[wKey].count++;
    byWorker[wKey].durations.push(mins);
  }

  const taskTypeStats = Object.entries(byType).map(([type, data]) => ({
    task_type: type,
    avg_minutes: data.total / data.count,
    count: data.count,
    total_hours: data.total / 60,
    min_minutes: Math.min(...data.durations),
    max_minutes: Math.max(...data.durations),
  }));

  const workerStats = Object.entries(byWorker)
    .map(([id, data]) => {
      const avg = data.total / data.count;
      const variance = data.durations.reduce((s, d) => s + Math.pow(d - avg, 2), 0) / data.count;
      return {
        worker_id: id,
        worker_name: data.name,
        avg_minutes: avg,
        count: data.count,
        total_hours: data.total / 60,
        std_dev: Math.sqrt(variance),
      };
    })
    .sort((a, b) => a.avg_minutes - b.avg_minutes);

  return {
    taskTypeStats,
    workerStats,
    totalCompleted: completed.length,
    totalHours: completed.reduce((s, t) => s + (t.duration_seconds! / 3600), 0),
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
