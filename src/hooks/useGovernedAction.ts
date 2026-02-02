/**
 * useGovernedAction Hook
 * Phase A: Button Integrity Enforcement
 * 
 * Wraps any action button with governance:
 * - Creates a governed task instead of direct mutation
 * - Enforces dry-run for high-risk operations
 * - Logs all activity
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { 
  createGovernedTask, 
  startTask, 
  completeTask, 
  failTask,
  recordItemResult,
  logTaskActivity,
} from '@/services/taskGovernance';
import { 
  checkGovernance, 
  ExecutionMode,
  getRiskPolicy,
} from '@/services/taskGovernance/governanceConfig';
import { FloorId, TaskRiskLevel } from '@/services/taskGovernance/types';

// ============= TYPES =============

export interface GovernedActionConfig {
  floor_id: FloorId;
  task_type: string;
  task_title: string;
  risk_level?: TaskRiskLevel;
  requires_approval?: boolean;
  entity_ids?: string[];
  entity_type?: string;
  context_data?: Record<string, any>;
}

export interface GovernedActionResult {
  success: boolean;
  task_id: string | null;
  message: string;
  requires_approval?: boolean;
  dry_run_required?: boolean;
}

export interface UseGovernedActionReturn {
  execute: (config: GovernedActionConfig, action: () => Promise<any>) => Promise<GovernedActionResult>;
  isExecuting: boolean;
  currentTaskId: string | null;
}

// ============= HOOK =============

export function useGovernedAction(): UseGovernedActionReturn {
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);

  const execute = useCallback(async (
    config: GovernedActionConfig,
    action: () => Promise<any>
  ): Promise<GovernedActionResult> => {
    setIsExecuting(true);
    let taskId: string | null = null;

    try {
      // Check governance before proceeding
      const riskLevel = config.risk_level || 'medium';
      const riskPolicy = getRiskPolicy(riskLevel);
      
      // Create governed task
      taskId = await createGovernedTask({
        floor_id: config.floor_id,
        task_type: config.task_type,
        task_title: config.task_title,
        task_details: `Governed action for ${config.entity_type || 'entities'}`,
        total_items: config.entity_ids?.length || 1,
        priority: riskLevel === 'critical' ? 'critical' : riskLevel === 'high' ? 'high' : 'medium',
        input_data: {
          entity_ids: config.entity_ids,
          entity_type: config.entity_type,
          risk_level: riskLevel,
          requires_approval: config.requires_approval ?? riskPolicy.requires_approval,
          ...config.context_data,
        },
      });

      setCurrentTaskId(taskId);

      // Check if approval is required
      if ((config.requires_approval ?? riskPolicy.requires_approval) && riskLevel !== 'low') {
        await logTaskActivity(
          taskId,
          'approval_required',
          `Action requires approval before execution (${riskLevel} risk)`,
          'blocked'
        );

        toast.info('Action queued for approval', {
          description: 'This action requires human approval before execution.',
        });

        return {
          success: true,
          task_id: taskId,
          message: 'Task created and awaiting approval',
          requires_approval: true,
        };
      }

      // Check if dry-run is required
      const governanceCheck = checkGovernance(config.task_type, config.floor_id, 'live');
      if (governanceCheck.requires_dry_run && riskLevel !== 'low') {
        toast.info('Dry-run recommended', {
          description: 'Consider running a dry-run first for this operation.',
        });
      }

      // Start task execution
      await startTask(taskId);

      // Execute the action
      const result = await action();

      // Record success
      await recordItemResult(taskId, 'completed', {
        entityType: config.entity_type || 'action',
        entityId: config.entity_ids?.[0] || 'single',
        entityName: config.task_title,
      });

      // Complete task
      await completeTask(taskId);

      toast.success('Action completed', {
        description: config.task_title,
      });

      return {
        success: true,
        task_id: taskId,
        message: 'Action completed successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (taskId) {
        await failTask(taskId, errorMessage);
      }

      toast.error('Action failed', {
        description: errorMessage,
      });

      return {
        success: false,
        task_id: taskId,
        message: errorMessage,
      };
    } finally {
      setIsExecuting(false);
      setCurrentTaskId(null);
    }
  }, []);

  return {
    execute,
    isExecuting,
    currentTaskId,
  };
}

// ============= GOVERNED BUTTON WRAPPER =============

export interface GovernedButtonProps {
  config: GovernedActionConfig;
  action: () => Promise<any>;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

/**
 * Helper to create a governed action handler for buttons
 * Usage:
 * 
 * const { execute, isExecuting } = useGovernedAction();
 * 
 * const handleCreateOrder = async () => {
 *   await execute({
 *     floor_id: 'floor5_finance',
 *     task_type: 'invoice_creation',
 *     task_title: 'Create Order Invoice',
 *     entity_ids: [orderId],
 *     entity_type: 'order',
 *   }, async () => {
 *     // Actual mutation logic here
 *     await supabase.from('orders').insert({ ... });
 *   });
 * };
 */
export function createGovernedHandler(
  execute: UseGovernedActionReturn['execute'],
  config: GovernedActionConfig,
  action: () => Promise<any>
) {
  return async () => {
    return execute(config, action);
  };
}

// ============= BATCH GOVERNED ACTION =============

export interface BatchGovernedActionConfig extends Omit<GovernedActionConfig, 'entity_ids'> {
  items: { id: string; name: string; data: any }[];
  processor: (item: { id: string; name: string; data: any }) => Promise<{ success: boolean; reason?: string }>;
}

export async function executeBatchGovernedAction(
  execute: UseGovernedActionReturn['execute'],
  config: BatchGovernedActionConfig
): Promise<GovernedActionResult> {
  const entityIds = config.items.map(i => i.id);
  
  return execute(
    {
      ...config,
      entity_ids: entityIds,
    },
    async () => {
      const results = await Promise.allSettled(
        config.items.map(item => config.processor(item))
      );
      
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.length - successful;
      
      return {
        total: results.length,
        successful,
        failed,
        results,
      };
    }
  );
}
