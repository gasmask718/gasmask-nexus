/**
 * Task Progress Service - Floor 9 AI Task Progress Tracking
 * Handles progress updates, activity logging, and task cancellation
 */

import { supabase } from '@/integrations/supabase/client';

// ============= TYPES =============

export interface TaskProgress {
  total_items: number;
  items_processed: number;
  items_completed: number;
  items_blocked: number;
  items_skipped: number;
  items_pending_approval: number;
}

export interface TaskActivityLogEntry {
  id: string;
  task_id: string;
  action_type: string;
  action_description: string;
  result: 'success' | 'skipped' | 'blocked' | 'failed' | 'cancelled';
  reason: string | null;
  target_entity_type: string | null;
  target_entity_id: string | null;
  target_entity_name: string | null;
  created_at: string;
}

export interface TaskCancellationResult {
  success: boolean;
  cancelled_actions: number;
  preserved_records: number;
  error?: string;
}

export interface TaskFinalReport {
  task_id: string;
  task_title: string;
  task_type: string;
  status: string;
  total_items: number;
  items_completed: number;
  items_blocked: number;
  items_skipped: number;
  blocked_reasons: { entity_name: string; reason: string }[];
  started_at: string | null;
  completed_at: string | null;
  time_saved_minutes: number;
  confidence_score: number | null;
  generated_at: string;
}

// ============= PROGRESS TRACKING =============

/**
 * Update task progress counters
 */
export async function updateTaskProgress(
  taskId: string,
  progress: Partial<TaskProgress>
): Promise<void> {
  const { error } = await supabase
    .from('ai_work_tasks')
    .update(progress)
    .eq('id', taskId);

  if (error) throw error;
}

/**
 * Increment a specific progress counter
 */
export async function incrementProgressCounter(
  taskId: string,
  counter: keyof Omit<TaskProgress, 'total_items'>,
  amount: number = 1
): Promise<void> {
  // Get current value
  const { data, error: fetchError } = await supabase
    .from('ai_work_tasks')
    .select(counter)
    .eq('id', taskId)
    .single();

  if (fetchError) throw fetchError;

  const currentValue = (data as any)[counter] || 0;

  // Update with new value
  const { error: updateError } = await supabase
    .from('ai_work_tasks')
    .update({ [counter]: currentValue + amount })
    .eq('id', taskId);

  if (updateError) throw updateError;
}

/**
 * Set total items for a task (call at task start)
 */
export async function setTotalItems(taskId: string, totalItems: number): Promise<void> {
  const { error } = await supabase
    .from('ai_work_tasks')
    .update({ total_items: totalItems })
    .eq('id', taskId);

  if (error) throw error;
}

// ============= ACTIVITY LOGGING =============

/**
 * Log a task activity entry
 */
export async function logTaskActivity(
  taskId: string,
  actionType: string,
  actionDescription: string,
  result: TaskActivityLogEntry['result'],
  options?: {
    reason?: string;
    targetEntityType?: string;
    targetEntityId?: string;
    targetEntityName?: string;
  }
): Promise<void> {
  const { error } = await supabase
    .from('ai_task_activity_log')
    .insert({
      task_id: taskId,
      action_type: actionType,
      action_description: actionDescription,
      result,
      reason: options?.reason || null,
      target_entity_type: options?.targetEntityType || null,
      target_entity_id: options?.targetEntityId || null,
      target_entity_name: options?.targetEntityName || null,
    });

  if (error) throw error;
}

/**
 * Get all activity logs for a task
 */
export async function getTaskActivityLog(
  taskId: string,
  limit: number = 100
): Promise<TaskActivityLogEntry[]> {
  const { data, error } = await supabase
    .from('ai_task_activity_log')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as TaskActivityLogEntry[];
}

// ============= TASK CANCELLATION =============

/**
 * Cancel a task safely - preserves audit trail and existing writes
 */
export async function cancelTask(
  taskId: string,
  cancelledBy: string,
  reason?: string
): Promise<TaskCancellationResult> {
  try {
    // 1. Get current task state
    const { data: task, error: fetchError } = await supabase
      .from('ai_work_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (fetchError) throw fetchError;

    // 2. Count pending actions that will be cancelled
    const pendingApprovals = task.items_pending_approval || 0;
    const remainingItems = (task.total_items || 0) - (task.items_processed || 0);

    // 3. Update task status to cancelled
    const { error: updateError } = await supabase
      .from('ai_work_tasks')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: cancelledBy,
        cancellation_reason: reason || 'User requested cancellation',
        completed_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    if (updateError) throw updateError;

    // 4. Log the cancellation activity
    await logTaskActivity(
      taskId,
      'task_cancelled',
      `Task cancelled by user. ${remainingItems} remaining items and ${pendingApprovals} pending approvals cleared.`,
      'cancelled',
      { reason: reason || 'User requested cancellation' }
    );

    // 5. Cancel any pending artifact approvals
    const { data: cancelledArtifacts } = await supabase
      .from('ai_task_artifacts')
      .update({ status: 'rejected' })
      .eq('task_id', taskId)
      .eq('status', 'pending_approval')
      .select('id');

    return {
      success: true,
      cancelled_actions: remainingItems + pendingApprovals,
      preserved_records: task.items_completed || 0,
    };
  } catch (error) {
    return {
      success: false,
      cancelled_actions: 0,
      preserved_records: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============= FINAL REPORT =============

/**
 * Generate final completion report for a task
 */
export async function generateFinalReport(taskId: string): Promise<TaskFinalReport | null> {
  // Get task data
  const { data: task, error: taskError } = await supabase
    .from('ai_work_tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (taskError || !task) return null;

  // Get blocked items from activity log
  const { data: blockedActivities } = await supabase
    .from('ai_task_activity_log')
    .select('target_entity_name, reason')
    .eq('task_id', taskId)
    .eq('result', 'blocked');

  const blockedReasons = (blockedActivities || []).map(a => ({
    entity_name: a.target_entity_name || 'Unknown',
    reason: a.reason || 'No reason provided',
  }));

  const report: TaskFinalReport = {
    task_id: taskId,
    task_title: task.task_title,
    task_type: task.task_type || 'general',
    status: task.status,
    total_items: task.total_items || 0,
    items_completed: task.items_completed || 0,
    items_blocked: task.items_blocked || 0,
    items_skipped: task.items_skipped || 0,
    blocked_reasons: blockedReasons,
    started_at: task.started_at,
    completed_at: task.completed_at,
    time_saved_minutes: task.time_saved_minutes || 0,
    confidence_score: task.confidence_score,
    generated_at: new Date().toISOString(),
  };

  // Store report in task
  await supabase
    .from('ai_work_tasks')
    .update({ final_report: report as unknown as Record<string, any> })
    .eq('id', taskId);

  return report;
}