// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULER HOOK — Task Scheduling & Management
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type TaskType = 'visit_stores' | 'collect_payment' | 'delivery_run' | 'follow_up' | 'inventory_check' | 'route_delivery' | 'contact_store';
export type TaskStatus = 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export interface ScheduledTask {
  id: string;
  type: TaskType;
  status: TaskStatus;
  run_at: string;
  recurrence_rule?: string;
  payload: Record<string, unknown>;
  created_by?: string;
  created_at: string;
  updated_at: string;
  last_run_at?: string;
  error_message?: string;
}

export interface TaskFilters {
  status?: TaskStatus | TaskStatus[];
  type?: TaskType | TaskType[];
  dateFrom?: string;
  dateTo?: string;
  driverId?: string;
  brand?: string;
}

export interface CreateTaskParams {
  type: TaskType;
  payload: Record<string, unknown>;
  runAt: Date;
  recurrenceRule?: string;
}

export function useScheduler() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const listTasks = useCallback(async (filters?: TaskFilters) => {
    setLoading(true);
    try {
      let query = (supabase.from('scheduled_tasks' as any).select('*') as any).order('run_at', { ascending: true });
      if (filters?.status) query = query.in('status', Array.isArray(filters.status) ? filters.status : [filters.status]);
      if (filters?.type) query = query.in('type', Array.isArray(filters.type) ? filters.type : [filters.type]);
      if (filters?.dateFrom) query = query.gte('run_at', filters.dateFrom);
      if (filters?.dateTo) query = query.lte('run_at', filters.dateTo);

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      let filteredData = (data || []) as ScheduledTask[];
      if (filters?.driverId) filteredData = filteredData.filter(t => t.payload?.driver_id === filters.driverId);
      if (filters?.brand) filteredData = filteredData.filter(t => t.payload?.brand === filters.brand);

      setTasks(filteredData);
      return filteredData;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const createTask = useCallback(async (params: CreateTaskParams) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error: insertError } = await (supabase.from('scheduled_tasks' as any).insert({
        type: params.type,
        status: 'pending',
        run_at: params.runAt.toISOString(),
        recurrence_rule: params.recurrenceRule || null,
        payload: params.payload,
        created_by: userData.user?.id,
      }).select().single() as any);

      if (insertError) throw insertError;
      toast({ title: 'Task Scheduled', description: `${params.type.replace(/_/g, ' ')} scheduled` });
      await listTasks();
      return data as ScheduledTask;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create task';
      setError(message);
      toast({ title: 'Error', description: message, variant: 'destructive' });
      return null;
    } finally {
      setLoading(false);
    }
  }, [listTasks, toast]);

  const updateTaskStatus = useCallback(async (taskId: string, status: TaskStatus, errorMessage?: string) => {
    try {
      const updateData: any = { status, updated_at: new Date().toISOString() };
      if (status === 'completed' || status === 'failed') updateData.last_run_at = new Date().toISOString();
      if (errorMessage) updateData.error_message = errorMessage;

      await (supabase.from('scheduled_tasks' as any).update(updateData).eq('id', taskId) as any);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status, ...updateData } : t));
      toast({ title: 'Task Updated', description: `Task marked as ${status}` });
      return true;
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
      return false;
    }
  }, [toast]);

  const rescheduleTask = useCallback(async (taskId: string, newRunAt: Date) => {
    try {
      await (supabase.from('scheduled_tasks' as any).update({ run_at: newRunAt.toISOString(), status: 'pending', updated_at: new Date().toISOString() }).eq('id', taskId) as any);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, run_at: newRunAt.toISOString(), status: 'pending' as TaskStatus } : t));
      toast({ title: 'Task Rescheduled' });
      return true;
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
      return false;
    }
  }, [toast]);

  const runTaskNow = useCallback(async (taskId: string) => {
    await updateTaskStatus(taskId, 'in_progress');
    await new Promise(resolve => setTimeout(resolve, 1000));
    await updateTaskStatus(taskId, 'completed');
    return true;
  }, [updateTaskStatus]);

  const cancelTask = useCallback(async (taskId: string) => updateTaskStatus(taskId, 'cancelled'), [updateTaskStatus]);

  return { tasks, loading, error, createTask, updateTaskStatus, rescheduleTask, runTaskNow, cancelTask, listTasks, refetch: () => listTasks() };
}

export default useScheduler;
