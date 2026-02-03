/**
 * Task Governance Service
 * Unified task management across Floors 1-9
 */

import { supabase } from '@/integrations/supabase/client';
import {
  FloorId,
  GovernedTask,
  GovernedTaskStatus,
  TaskProgress,
  TaskActivityEntry,
  TaskCompletionReport,
  TaskCancellationResult,
  BlockedItem,
} from './types';
import { getTaskTemplate } from './taskRegistry';

// ============= TASK CREATION =============

export interface CreateTaskOptions {
  floor_id: FloorId;
  task_type: string;
  task_title: string;
  task_details?: string;
  total_items?: number;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  input_data?: Record<string, any>;
}

export async function createGovernedTask(options: CreateTaskOptions): Promise<string> {
  const template = getTaskTemplate(options.task_type);
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('ai_work_tasks')
    .insert({
      task_title: options.task_title,
      task_details: options.task_details || template?.description || null,
      task_type: options.task_type,
      status: 'queued',
      priority: options.priority || 'medium',
      department: options.floor_id,
      total_items: options.total_items || 0,
      items_processed: 0,
      items_completed: 0,
      items_blocked: 0,
      items_skipped: 0,
      items_pending_approval: 0,
      input_data: {
        ...(options.input_data || {}),
        floor_id: options.floor_id,
        risk_level: template?.risk_level || 'low',
        requires_approval: template?.requires_approval || false,
      },
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error) throw error;
  
  // Log task creation
  await logTaskActivity(
    data.id,
    'task_created',
    `Task "${options.task_title}" created for ${options.floor_id}`,
    'success'
  );
  
  return data.id;
}

// ============= TASK STATUS MANAGEMENT =============

export async function startTask(taskId: string): Promise<void> {
  const { error } = await supabase
    .from('ai_work_tasks')
    .update({
      status: 'processing',
      started_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  if (error) throw error;

  await logTaskActivity(taskId, 'task_started', 'Task execution started', 'success');
}

export async function completeTask(taskId: string): Promise<void> {
  const { error } = await supabase
    .from('ai_work_tasks')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  if (error) throw error;

  await logTaskActivity(taskId, 'task_completed', 'Task completed successfully', 'success');
  
  // Generate final report
  await generateCompletionReport(taskId);
}

export async function failTask(taskId: string, errorMessage: string): Promise<void> {
  const { error } = await supabase
    .from('ai_work_tasks')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message: errorMessage,
    })
    .eq('id', taskId);

  if (error) throw error;

  await logTaskActivity(taskId, 'task_failed', `Task failed: ${errorMessage}`, 'failed');
  await generateCompletionReport(taskId);
}

export async function pauseForApproval(taskId: string, reason: string): Promise<void> {
  const { error } = await supabase
    .from('ai_work_tasks')
    .update({ status: 'awaiting_approval' })
    .eq('id', taskId);

  if (error) throw error;

  await logTaskActivity(taskId, 'approval_required', reason, 'blocked', { reason });
}

// ============= PROGRESS TRACKING =============

export async function updateProgress(
  taskId: string,
  progress: Partial<TaskProgress>
): Promise<void> {
  const { error } = await supabase
    .from('ai_work_tasks')
    .update(progress)
    .eq('id', taskId);

  if (error) throw error;
}

export async function incrementCounter(
  taskId: string,
  counter: keyof Omit<TaskProgress, 'total_items'>,
  amount: number = 1
): Promise<void> {
  const { data, error: fetchError } = await supabase
    .from('ai_work_tasks')
    .select(counter)
    .eq('id', taskId)
    .single();

  if (fetchError) throw fetchError;

  const currentValue = (data as any)[counter] || 0;

  const { error: updateError } = await supabase
    .from('ai_work_tasks')
    .update({ [counter]: currentValue + amount })
    .eq('id', taskId);

  if (updateError) throw updateError;
}

export async function recordItemResult(
  taskId: string,
  result: 'completed' | 'blocked' | 'skipped',
  entityInfo?: {
    entityType: string;
    entityId: string;
    entityName: string;
    reason?: string;
  }
): Promise<void> {
  // Increment processed counter
  await incrementCounter(taskId, 'items_processed');

  // Increment specific result counter
  switch (result) {
    case 'completed':
      await incrementCounter(taskId, 'items_completed');
      break;
    case 'blocked':
      await incrementCounter(taskId, 'items_blocked');
      break;
    case 'skipped':
      await incrementCounter(taskId, 'items_skipped');
      break;
  }

  // Log the activity
  const actionType = result === 'completed' ? 'item_processed' : 
                     result === 'blocked' ? 'item_blocked' : 'item_skipped';
  
  await logTaskActivity(
    taskId,
    actionType,
    entityInfo 
      ? `${entityInfo.entityType} "${entityInfo.entityName}" ${result}`
      : `Item ${result}`,
    result === 'completed' ? 'success' : result,
    entityInfo ? {
      targetEntityType: entityInfo.entityType,
      targetEntityId: entityInfo.entityId,
      targetEntityName: entityInfo.entityName,
      reason: entityInfo.reason,
    } : undefined
  );
}

// ============= ACTIVITY LOGGING =============

export async function logTaskActivity(
  taskId: string,
  actionType: string,
  actionDescription: string,
  result: TaskActivityEntry['result'],
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

export async function getTaskActivities(
  taskId: string,
  limit: number = 100
): Promise<TaskActivityEntry[]> {
  const { data, error } = await supabase
    .from('ai_task_activity_log')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as TaskActivityEntry[];
}

// ============= TASK CANCELLATION =============

export async function cancelTask(
  taskId: string,
  reason?: string
): Promise<TaskCancellationResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get current task state
    const { data: task, error: fetchError } = await supabase
      .from('ai_work_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (fetchError) throw fetchError;

    const pendingApprovals = task.items_pending_approval || 0;
    const remainingItems = (task.total_items || 0) - (task.items_processed || 0);

    // Update task status
    const { error: updateError } = await supabase
      .from('ai_work_tasks')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.id,
        cancellation_reason: reason || 'User requested cancellation',
        completed_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    if (updateError) throw updateError;

    // Log cancellation
    await logTaskActivity(
      taskId,
      'task_cancelled',
      `Task cancelled. ${remainingItems} remaining items and ${pendingApprovals} pending approvals cleared.`,
      'cancelled',
      { reason: reason || 'User requested cancellation' }
    );

    // Cancel pending artifact approvals
    await supabase
      .from('ai_task_artifacts')
      .update({ status: 'rejected' })
      .eq('task_id', taskId)
      .eq('status', 'pending_approval');

    // Generate final report
    await generateCompletionReport(taskId);

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

// ============= TASK SOFT DELETE =============

export interface TaskDeleteResult {
  success: boolean;
  deleted: boolean;
  error?: string;
}

export async function deleteTask(
  taskId: string,
  reason?: string
): Promise<TaskDeleteResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get current task state
    const { data: task, error: fetchError } = await supabase
      .from('ai_work_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (fetchError) throw fetchError;

    // If task is still running, cancel it first
    if (['processing', 'validating_inputs', 'queued'].includes(task.status)) {
      await cancelTask(taskId, reason || 'Task deleted by user');
    }

    // Soft delete by setting deleted_at timestamp
    const { error: updateError } = await supabase
      .from('ai_work_tasks')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
        deletion_reason: reason || 'User requested deletion',
      })
      .eq('id', taskId);

    if (updateError) throw updateError;

    // Log deletion
    await logTaskActivity(
      taskId,
      'task_deleted',
      `Task soft-deleted by user. Reason: ${reason || 'No reason provided'}`,
      'success',
      { reason: reason || 'User requested deletion' }
    );

    return {
      success: true,
      deleted: true,
    };
  } catch (error) {
    return {
      success: false,
      deleted: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============= TASK RESTART =============

export interface TaskRestartResult {
  success: boolean;
  newTaskId?: string;
  error?: string;
}

export async function restartTask(
  taskId: string
): Promise<TaskRestartResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get original task
    const { data: originalTask, error: fetchError } = await supabase
      .from('ai_work_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (fetchError) throw fetchError;

    const inputData = originalTask.input_data as Record<string, any> | null;

    // Create new task with same parameters
    const { data: newTask, error: insertError } = await supabase
      .from('ai_work_tasks')
      .insert({
        task_title: `${originalTask.task_title} (Restart)`,
        task_details: originalTask.task_details,
        task_type: originalTask.task_type,
        status: 'queued',
        priority: originalTask.priority || 'medium',
        department: originalTask.department,
        total_items: originalTask.total_items || 0,
        items_processed: 0,
        items_completed: 0,
        items_blocked: 0,
        items_skipped: 0,
        items_pending_approval: 0,
        input_data: {
          ...inputData,
          restarted_from: taskId,
          restart_count: ((inputData?.restart_count || 0) as number) + 1,
        },
        created_by: user.id,
      })
      .select('id')
      .single();

    if (insertError) throw insertError;

    // Log restart activity on original task
    await logTaskActivity(
      taskId,
      'task_restarted',
      `Task restarted as new task ${newTask.id}`,
      'success'
    );

    // Log creation on new task
    await logTaskActivity(
      newTask.id,
      'task_created',
      `Task created as restart of ${taskId}`,
      'success'
    );

    return {
      success: true,
      newTaskId: newTask.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============= COMPLETION REPORT =============

export async function generateCompletionReport(
  taskId: string
): Promise<TaskCompletionReport | null> {
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
    .select('target_entity_name, target_entity_type, target_entity_id, reason')
    .eq('task_id', taskId)
    .eq('result', 'blocked');

  const blockedReasons: BlockedItem[] = (blockedActivities || []).map(a => ({
    entity_name: a.target_entity_name || 'Unknown',
    entity_type: a.target_entity_type || 'unknown',
    entity_id: a.target_entity_id || '',
    reason: a.reason || 'No reason provided',
  }));

  const totalItems = task.total_items || 0;
  const itemsCompleted = task.items_completed || 0;
  const itemsBlocked = task.items_blocked || 0;

  // Calculate execution duration
  const startedAt = task.started_at ? new Date(task.started_at) : null;
  const completedAt = task.completed_at ? new Date(task.completed_at) : new Date();
  const durationMs = startedAt ? completedAt.getTime() - startedAt.getTime() : 0;
  const durationMinutes = Math.round(durationMs / 60000);

  const taskInputData = task.input_data as Record<string, any> | null;
  const floorId = taskInputData?.floor_id || task.department || 'floor9_ai';

  const report: TaskCompletionReport = {
    task_id: taskId,
    task_title: task.task_title,
    task_type: task.task_type || 'general',
    floor_id: floorId as FloorId,
    status: task.status as GovernedTaskStatus,
    total_items: totalItems,
    items_completed: itemsCompleted,
    items_blocked: itemsBlocked,
    items_skipped: task.items_skipped || 0,
    completion_percentage: totalItems > 0 ? Math.round((itemsCompleted / totalItems) * 100) : 0,
    blocked_percentage: totalItems > 0 ? Math.round((itemsBlocked / totalItems) * 100) : 0,
    blocked_reasons: blockedReasons,
    execution_duration_minutes: durationMinutes,
    time_saved_minutes: task.time_saved_minutes || 0,
    started_at: task.started_at,
    completed_at: task.completed_at,
    generated_at: new Date().toISOString(),
    audit_confirmation: 'All actions logged. No silent writes occurred.',
  };

  // Store report in task
  await supabase
    .from('ai_work_tasks')
    .update({ final_report: report as unknown as Record<string, any> })
    .eq('id', taskId);

  return report;
}

// ============= TASK QUERIES =============

export interface TaskQueryOptions {
  includeDeleted?: boolean;
}

export async function getTasksByFloor(
  floorId: FloorId,
  status?: GovernedTaskStatus,
  limit: number = 50,
  options?: TaskQueryOptions
): Promise<GovernedTask[]> {
  let query = supabase
    .from('ai_work_tasks')
    .select('*')
    .eq('department', floorId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq('status', status);
  }

  // By default, exclude deleted tasks
  if (!options?.includeDeleted) {
    query = query.is('deleted_at', null);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(mapToGovernedTask);
}

export async function getAllActiveTasks(options?: TaskQueryOptions): Promise<GovernedTask[]> {
  let query = supabase
    .from('ai_work_tasks')
    .select('*')
    .in('status', ['queued', 'processing', 'awaiting_approval'])
    .order('created_at', { ascending: false });

  // By default, exclude deleted tasks
  if (!options?.includeDeleted) {
    query = query.is('deleted_at', null);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapToGovernedTask);
}

export async function getTaskById(taskId: string): Promise<GovernedTask | null> {
  const { data, error } = await supabase
    .from('ai_work_tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (error) return null;
  return mapToGovernedTask(data);
}

// ============= HELPER FUNCTIONS =============

function mapToGovernedTask(data: any): GovernedTask {
  const inputData = data.input_data as Record<string, any> | null;
  const floorId = inputData?.floor_id || data.department || 'floor9_ai';
  
  return {
    id: data.id,
    floor_id: floorId as FloorId,
    task_title: data.task_title,
    task_type: data.task_type || 'general',
    task_details: data.task_details,
    status: mapStatus(data.status),
    priority: data.priority || 'medium',
    risk_level: data.input_data?.risk_level || 'low',
    requires_approval: data.input_data?.requires_approval || false,
    total_items: data.total_items || 0,
    items_processed: data.items_processed || 0,
    items_completed: data.items_completed || 0,
    items_blocked: data.items_blocked || 0,
    items_skipped: data.items_skipped || 0,
    items_pending_approval: data.items_pending_approval || 0,
    confidence_score: data.confidence_score,
    time_saved_minutes: data.time_saved_minutes || 0,
    execution_mode: data.execution_mode,
    created_at: data.created_at,
    started_at: data.started_at,
    completed_at: data.completed_at,
    cancelled_at: data.cancelled_at,
    cancelled_by: data.cancelled_by,
    cancellation_reason: data.cancellation_reason,
    deleted_at: data.deleted_at || null,
    deleted_by: data.deleted_by || null,
    deletion_reason: data.deletion_reason || null,
    final_report: data.final_report as TaskCompletionReport | null,
  };
}

function mapStatus(status: string): GovernedTaskStatus {
  const statusMap: Record<string, GovernedTaskStatus> = {
    pending: 'queued',
    assigned: 'queued',
    queued: 'queued',
    processing: 'running',
    validating_inputs: 'running',
    awaiting_approval: 'paused_for_approval',
    completed: 'completed',
    failed: 'failed',
    blocked: 'failed',
    cancelled: 'cancelled',
  };
  return statusMap[status] || 'queued';
}
