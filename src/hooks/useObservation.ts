/**
 * useObservation - React hook for Phase 4.5 observation tracking
 * Provides easy integration of observation recording into any component
 */

import { useCallback, useRef } from 'react';
import { 
  recordObservation, 
  recordDecision,
  type ObservationType,
  type TaskDecision,
} from '@/services/taskGovernance/observationService';
import type { FloorId } from '@/services/taskGovernance/types';

interface UseObservationOptions {
  taskId: string;
  taskType: string;
  floorId: FloorId;
}

export function useObservation({ taskId, taskType, floorId }: UseObservationOptions) {
  // Track when decision flow started (for latency calculation)
  const decisionStartRef = useRef<Date | null>(null);

  /**
   * Record a generic observation
   */
  const observe = useCallback(async (
    type: ObservationType,
    metadata?: Record<string, unknown>
  ) => {
    return recordObservation(taskId, taskType, floorId, type, { metadata });
  }, [taskId, taskType, floorId]);

  /**
   * Start tracking decision time (call when approval UI is shown)
   */
  const startDecisionTimer = useCallback(() => {
    decisionStartRef.current = new Date();
  }, []);

  /**
   * Record a human decision with latency tracking
   */
  const recordHumanDecision = useCallback(async (
    decision: TaskDecision,
    options?: {
      confidence?: number;
      wasOverride?: boolean;
      overrideReason?: string;
    }
  ) => {
    return recordDecision(taskId, taskType, floorId, decision, {
      decisionStartedAt: decisionStartRef.current || undefined,
      ...options,
    });
  }, [taskId, taskType, floorId]);

  /**
   * Record task creation
   */
  const observeCreation = useCallback(async () => {
    return observe('task_created');
  }, [observe]);

  /**
   * Record task start
   */
  const observeStart = useCallback(async () => {
    return observe('task_started');
  }, [observe]);

  /**
   * Record dry-run execution
   */
  const observeDryRun = useCallback(async (passed: boolean) => {
    return recordObservation(taskId, taskType, floorId, 'dry_run_executed', {
      dryRunPassed: passed,
    });
  }, [taskId, taskType, floorId]);

  /**
   * Record approval request (starts decision timer automatically)
   */
  const observeApprovalRequest = useCallback(async () => {
    startDecisionTimer();
    return observe('approval_requested');
  }, [observe, startDecisionTimer]);

  /**
   * Record task completion
   */
  const observeCompletion = useCallback(async () => {
    return observe('task_completed');
  }, [observe]);

  /**
   * Record task cancellation
   */
  const observeCancellation = useCallback(async (reason?: string) => {
    return observe('task_cancelled', { reason });
  }, [observe]);

  /**
   * Record task failure
   */
  const observeFailure = useCallback(async (error?: string) => {
    return observe('task_failed', { error });
  }, [observe]);

  return {
    // Core observation
    observe,
    
    // Decision tracking
    startDecisionTimer,
    recordHumanDecision,
    
    // Convenience methods
    observeCreation,
    observeStart,
    observeDryRun,
    observeApprovalRequest,
    observeCompletion,
    observeCancellation,
    observeFailure,
  };
}

/**
 * useObservationStats - Hook for fetching observation statistics
 */
export { useQuery } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { getObservationStats, getRecentObservations } from '@/services/taskGovernance/observationService';

export function useObservationStats(floorId?: FloorId) {
  return useQuery({
    queryKey: ['observation-stats', floorId],
    queryFn: () => getObservationStats(floorId),
    refetchInterval: 30000,
  });
}

export function useRecentObservations(floorId?: FloorId, limit: number = 50) {
  return useQuery({
    queryKey: ['recent-observations', floorId, limit],
    queryFn: () => getRecentObservations({ floorId, limit }),
    refetchInterval: 10000,
  });
}
