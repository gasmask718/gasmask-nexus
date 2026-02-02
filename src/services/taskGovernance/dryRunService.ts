/**
 * Dry-Run Execution Service
 * Phase D: Dry-Run Execution Mode
 * 
 * Implements dry_run vs live execution modes with enforcement.
 * Dry-run simulates the full pipeline without writes.
 */

import { supabase } from '@/integrations/supabase/client';
import { FloorId, GovernedTask, TaskProgress, TaskActivityEntry } from './types';
import { checkGovernance, ExecutionMode, isDryRunRequired } from './governanceConfig';
import { logTaskActivity, updateProgress } from './taskGovernanceService';

// ============= DRY-RUN STATE =============

export interface DryRunResult {
  task_id: string;
  execution_mode: 'dry_run';
  passed: boolean;
  simulated_progress: TaskProgress;
  simulated_activities: TaskActivityEntry[];
  would_complete: number;
  would_block: number;
  would_skip: number;
  blocking_reasons: string[];
  governance_warnings: string[];
  estimated_duration_minutes: number;
  ready_for_live: boolean;
}

export interface DryRunContext {
  task_id: string;
  floor_id: FloorId;
  task_type: string;
  items: any[];
  processor: (item: any, context: DryRunContext) => Promise<DryRunItemResult>;
}

export interface DryRunItemResult {
  would_succeed: boolean;
  would_block: boolean;
  would_skip: boolean;
  reason?: string;
  entity_info?: {
    type: string;
    id: string;
    name: string;
  };
}

// ============= DRY-RUN EXECUTION =============

export async function executeDryRun(
  taskId: string,
  floorId: FloorId,
  taskType: string,
  items: any[],
  processor: (item: any) => Promise<DryRunItemResult>
): Promise<DryRunResult> {
  const startTime = Date.now();
  
  // Log dry-run start
  await logTaskActivity(
    taskId,
    'dry_run_started',
    `Dry-run execution started for ${items.length} items`,
    'success'
  );

  // Update task to show dry-run mode
  await supabase
    .from('ai_work_tasks')
    .update({ 
      execution_mode: 'dry_run',
      status: 'processing',
      started_at: new Date().toISOString(),
      total_items: items.length,
    })
    .eq('id', taskId);

  const simulatedActivities: TaskActivityEntry[] = [];
  const blockingReasons: string[] = [];
  const governanceWarnings: string[] = [];
  
  let wouldComplete = 0;
  let wouldBlock = 0;
  let wouldSkip = 0;
  let processed = 0;

  // Check governance first
  const governanceCheck = checkGovernance(taskType, floorId, 'dry_run');
  if (!governanceCheck.allowed) {
    governanceWarnings.push(governanceCheck.blocking_reason || 'Governance check failed');
  }
  if (governanceCheck.requires_approval) {
    governanceWarnings.push('Live execution will require human approval');
  }
  if (items.length > governanceCheck.max_batch_size) {
    governanceWarnings.push(`Batch size (${items.length}) exceeds maximum (${governanceCheck.max_batch_size})`);
  }

  // Process each item in dry-run mode
  for (const item of items) {
    try {
      const result = await processor(item);
      processed++;

      // Update progress (even in dry-run for visibility)
      await updateProgress(taskId, { items_processed: processed });

      if (result.would_succeed) {
        wouldComplete++;
        simulatedActivities.push({
          id: crypto.randomUUID(),
          task_id: taskId,
          action_type: 'dry_run_would_complete',
          action_description: result.entity_info 
            ? `Would complete: ${result.entity_info.type} "${result.entity_info.name}"`
            : 'Would complete item',
          result: 'success',
          reason: null,
          target_entity_type: result.entity_info?.type || null,
          target_entity_id: result.entity_info?.id || null,
          target_entity_name: result.entity_info?.name || null,
          created_at: new Date().toISOString(),
        });
      } else if (result.would_block) {
        wouldBlock++;
        if (result.reason) {
          blockingReasons.push(`${result.entity_info?.name || 'Item'}: ${result.reason}`);
        }
        simulatedActivities.push({
          id: crypto.randomUUID(),
          task_id: taskId,
          action_type: 'dry_run_would_block',
          action_description: result.entity_info 
            ? `Would block: ${result.entity_info.type} "${result.entity_info.name}"`
            : 'Would block item',
          result: 'blocked',
          reason: result.reason || null,
          target_entity_type: result.entity_info?.type || null,
          target_entity_id: result.entity_info?.id || null,
          target_entity_name: result.entity_info?.name || null,
          created_at: new Date().toISOString(),
        });
      } else if (result.would_skip) {
        wouldSkip++;
        simulatedActivities.push({
          id: crypto.randomUUID(),
          task_id: taskId,
          action_type: 'dry_run_would_skip',
          action_description: result.entity_info 
            ? `Would skip: ${result.entity_info.type} "${result.entity_info.name}"`
            : 'Would skip item',
          result: 'skipped',
          reason: result.reason || null,
          target_entity_type: result.entity_info?.type || null,
          target_entity_id: result.entity_info?.id || null,
          target_entity_name: result.entity_info?.name || null,
          created_at: new Date().toISOString(),
        });
      }
    } catch (error) {
      wouldBlock++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      blockingReasons.push(`Processing error: ${errorMessage}`);
    }
  }

  const endTime = Date.now();
  const durationMinutes = Math.round((endTime - startTime) / 60000);

  // Determine if ready for live
  const readyForLive = wouldBlock === 0 && governanceWarnings.length === 0;

  const result: DryRunResult = {
    task_id: taskId,
    execution_mode: 'dry_run',
    passed: readyForLive,
    simulated_progress: {
      total_items: items.length,
      items_processed: processed,
      items_completed: wouldComplete,
      items_blocked: wouldBlock,
      items_skipped: wouldSkip,
      items_pending_approval: 0,
    },
    simulated_activities: simulatedActivities,
    would_complete: wouldComplete,
    would_block: wouldBlock,
    would_skip: wouldSkip,
    blocking_reasons: blockingReasons,
    governance_warnings: governanceWarnings,
    estimated_duration_minutes: durationMinutes,
    ready_for_live: readyForLive,
  };

  // Store dry-run result - cast to any for JSONB compatibility
  const outputPayload = {
    dry_run_result: JSON.parse(JSON.stringify(result)),
    dry_run_passed: readyForLive,
    dry_run_completed_at: new Date().toISOString(),
  };

  await supabase
    .from('ai_work_tasks')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      items_completed: wouldComplete,
      items_blocked: wouldBlock,
      items_skipped: wouldSkip,
      output: outputPayload as any,
    })
    .eq('id', taskId);

  // Log dry-run completion
  await logTaskActivity(
    taskId,
    'dry_run_completed',
    `Dry-run completed: ${wouldComplete} would succeed, ${wouldBlock} would block, ${wouldSkip} would skip. Ready for live: ${readyForLive ? 'YES' : 'NO'}`,
    readyForLive ? 'success' : 'blocked'
  );

  return result;
}

// ============= LIVE EXECUTION WITH DRY-RUN CHECK =============

export interface LiveExecutionOptions {
  task_id: string;
  floor_id: FloorId;
  task_type: string;
  override_dry_run?: boolean;
  has_approval?: boolean;
  confidence_score?: number;
}

export interface LiveExecutionCheck {
  allowed: boolean;
  reason: string;
  dry_run_required: boolean;
  dry_run_passed: boolean | null;
  approval_required: boolean;
  has_approval: boolean;
}

export async function checkLiveExecutionAllowed(
  options: LiveExecutionOptions
): Promise<LiveExecutionCheck> {
  // Get task to check dry-run status
  const { data: task } = await supabase
    .from('ai_work_tasks')
    .select('output')
    .eq('id', options.task_id)
    .single();

  const outputData = task?.output as Record<string, any> | null;
  const dryRunPassed = outputData?.dry_run_passed ?? null;
  
  const dryRunRequired = isDryRunRequired(options.task_type, options.floor_id);
  const governanceCheck = checkGovernance(
    options.task_type,
    options.floor_id,
    'live',
    options.confidence_score,
    dryRunPassed === true
  );

  // Check 1: Dry-run requirement
  if (dryRunRequired && dryRunPassed !== true && !options.override_dry_run) {
    return {
      allowed: false,
      reason: 'Dry-run must pass before live execution. Run dry-run first or explicitly override.',
      dry_run_required: true,
      dry_run_passed: dryRunPassed,
      approval_required: governanceCheck.requires_approval,
      has_approval: options.has_approval || false,
    };
  }

  // Check 2: Approval requirement
  if (governanceCheck.requires_approval && !options.has_approval) {
    return {
      allowed: false,
      reason: 'Human approval required for live execution of this task type.',
      dry_run_required: dryRunRequired,
      dry_run_passed: dryRunPassed,
      approval_required: true,
      has_approval: false,
    };
  }

  // Check 3: Governance blocking reason
  if (!governanceCheck.allowed) {
    return {
      allowed: false,
      reason: governanceCheck.blocking_reason || 'Governance check failed',
      dry_run_required: dryRunRequired,
      dry_run_passed: dryRunPassed,
      approval_required: governanceCheck.requires_approval,
      has_approval: options.has_approval || false,
    };
  }

  return {
    allowed: true,
    reason: 'All checks passed. Live execution allowed.',
    dry_run_required: dryRunRequired,
    dry_run_passed: dryRunPassed,
    approval_required: governanceCheck.requires_approval,
    has_approval: options.has_approval || false,
  };
}

// ============= EXECUTION MODE WRAPPER =============

export interface ExecutionContext {
  mode: ExecutionMode;
  task_id: string;
  floor_id: FloorId;
  task_type: string;
  allow_writes: boolean;
}

export function createExecutionContext(
  mode: ExecutionMode,
  taskId: string,
  floorId: FloorId,
  taskType: string
): ExecutionContext {
  return {
    mode,
    task_id: taskId,
    floor_id: floorId,
    task_type: taskType,
    allow_writes: mode === 'live',
  };
}

/**
 * Guard function for writes
 * Use this to wrap any database mutation
 */
export function guardWrite<T>(
  context: ExecutionContext,
  writeOperation: () => Promise<T>,
  dryRunResult?: T
): Promise<T> {
  if (context.mode === 'dry_run') {
    // In dry-run, return the simulated result without actually writing
    if (dryRunResult !== undefined) {
      return Promise.resolve(dryRunResult);
    }
    // If no dry-run result provided, return a promise that resolves to undefined as T
    return Promise.resolve(undefined as unknown as T);
  }
  
  // In live mode, execute the actual write
  return writeOperation();
}
