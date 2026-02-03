/**
 * Phase 4.5 Observation Service
 * Instrumented learning layer that observes human behavior without autonomous action
 * 
 * PURPOSE:
 * - Track which tasks humans approve, reject, or cancel
 * - Measure approval latency and patterns
 * - Build automation readiness scores per task type
 * - Generate AI recommendations (shadow mode only)
 * 
 * RULES (NON-NEGOTIABLE):
 * - NEVER auto-execute tasks
 * - NEVER skip human approval
 * - ONLY observe and learn
 */

import { supabase } from '@/integrations/supabase/client';
import type { FloorId, TaskRiskLevel, GovernedTaskStatus } from './types';
import type { Json } from '@/integrations/supabase/types';

// ============= TYPES =============

export interface TaskObservation {
  id: string;
  task_id: string;
  task_type: string;
  floor_id: FloorId;
  observation_type: ObservationType;
  decision?: TaskDecision;
  decision_latency_ms?: number;
  dry_run_passed?: boolean;
  confidence_at_decision?: number;
  human_override?: boolean;
  override_reason?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export type ObservationType = 
  | 'task_created'
  | 'task_started'
  | 'dry_run_executed'
  | 'approval_requested'
  | 'decision_made'
  | 'task_completed'
  | 'task_cancelled'
  | 'task_failed';

export type TaskDecision = 
  | 'approved'
  | 'rejected'
  | 'modified'
  | 'cancelled'
  | 'auto_approved';

export interface AutomationReadinessScore {
  task_type: string;
  floor_id: FloorId;
  readiness_score: number; // 0-100
  readiness_level: 'not_ready' | 'low' | 'medium' | 'high' | 'ready';
  total_observations: number;
  approval_rate: number;
  avg_decision_latency_ms: number;
  dry_run_pass_rate: number;
  human_override_rate: number;
  recommendation: string;
  last_calculated_at: string;
}

export interface TaskPreview {
  task_id: string;
  task_type: string;
  floor_id: FloorId;
  preview_type: 'create' | 'update' | 'delete' | 'mixed';
  affected_records: PreviewRecord[];
  estimated_duration_ms: number;
  risk_level: TaskRiskLevel;
  confidence_score: number;
  dry_run_required: boolean;
  approval_required: boolean;
  warnings: string[];
  generated_at: string;
}

export interface PreviewRecord {
  entity_type: string;
  entity_id: string;
  entity_name: string;
  action: 'create' | 'update' | 'delete' | 'skip';
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
}

// ============= OBSERVATION RECORDING =============

/**
 * Record an observation about a task
 * This is the core learning mechanism
 */
export async function recordObservation(
  taskId: string,
  taskType: string,
  floorId: FloorId,
  observationType: ObservationType,
  details?: {
    decision?: TaskDecision;
    decisionLatencyMs?: number;
    dryRunPassed?: boolean;
    confidenceAtDecision?: number;
    humanOverride?: boolean;
    overrideReason?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('task_observations')
      .insert({
        task_id: taskId,
        task_type: taskType,
        floor_id: floorId,
        observation_type: observationType,
        decision: details?.decision || null,
        decision_latency_ms: details?.decisionLatencyMs || null,
        dry_run_passed: details?.dryRunPassed ?? null,
        confidence_at_decision: details?.confidenceAtDecision || null,
        human_override: details?.humanOverride ?? false,
        override_reason: details?.overrideReason || null,
        metadata: (details?.metadata || {}) as unknown as Json,
      });

    if (error) {
      console.error('[OBSERVATION] Failed to record:', error);
      return false;
    }

    console.log(`[OBSERVATION] Recorded: ${observationType} for task ${taskId}`);
    return true;
  } catch (err) {
    console.error('[OBSERVATION] Error:', err);
    return false;
  }
}

/**
 * Record when a human makes a decision on a task
 */
export async function recordDecision(
  taskId: string,
  taskType: string,
  floorId: FloorId,
  decision: TaskDecision,
  options?: {
    decisionStartedAt?: Date;
    confidence?: number;
    wasOverride?: boolean;
    overrideReason?: string;
  }
): Promise<boolean> {
  const latencyMs = options?.decisionStartedAt 
    ? Date.now() - options.decisionStartedAt.getTime()
    : undefined;

  return recordObservation(taskId, taskType, floorId, 'decision_made', {
    decision,
    decisionLatencyMs: latencyMs,
    confidenceAtDecision: options?.confidence,
    humanOverride: options?.wasOverride,
    overrideReason: options?.overrideReason,
  });
}

// ============= AUTOMATION READINESS =============

/**
 * Calculate automation readiness score for a task type
 * This determines how safe it would be to automate this task
 */
export async function calculateAutomationReadiness(
  taskType: string,
  floorId: FloorId
): Promise<AutomationReadinessScore | null> {
  try {
    // Get all observations for this task type
    const { data: observations, error } = await supabase
      .from('task_observations')
      .select('*')
      .eq('task_type', taskType)
      .eq('floor_id', floorId);

    if (error || !observations || observations.length === 0) {
      return null;
    }

    // Calculate metrics
    const totalObs = observations.length;
    const decisions = observations.filter(o => o.observation_type === 'decision_made');
    const approvals = decisions.filter(o => o.decision === 'approved' || o.decision === 'auto_approved');
    const dryRuns = observations.filter(o => o.observation_type === 'dry_run_executed');
    const dryRunPasses = dryRuns.filter(o => o.dry_run_passed === true);
    const overrides = observations.filter(o => o.human_override === true);

    const approvalRate = decisions.length > 0 ? approvals.length / decisions.length : 0;
    const dryRunPassRate = dryRuns.length > 0 ? dryRunPasses.length / dryRuns.length : 0;
    const overrideRate = totalObs > 0 ? overrides.length / totalObs : 0;

    // Calculate average decision latency
    const latencies = decisions
      .filter(d => d.decision_latency_ms != null)
      .map(d => d.decision_latency_ms as number);
    const avgLatency = latencies.length > 0 
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
      : 0;

    // Calculate readiness score (0-100)
    // Higher approval rate = more ready
    // Higher dry-run pass rate = more ready
    // Lower override rate = more ready
    // Lower decision latency = more ready (humans are confident)
    const readinessScore = Math.round(
      (approvalRate * 40) +
      (dryRunPassRate * 30) +
      ((1 - overrideRate) * 20) +
      (avgLatency < 5000 ? 10 : avgLatency < 15000 ? 5 : 0)
    );

    // Determine readiness level
    let readinessLevel: AutomationReadinessScore['readiness_level'] = 'not_ready';
    let recommendation = '';

    if (totalObs < 10) {
      readinessLevel = 'not_ready';
      recommendation = 'Insufficient data. Need at least 10 observations to assess automation readiness.';
    } else if (readinessScore >= 85) {
      readinessLevel = 'ready';
      recommendation = 'High approval rate, consistent dry-run passes, low human intervention. Safe to consider for automation.';
    } else if (readinessScore >= 70) {
      readinessLevel = 'high';
      recommendation = 'Good automation candidate. Consider partial automation with human spot-checks.';
    } else if (readinessScore >= 50) {
      readinessLevel = 'medium';
      recommendation = 'Moderate readiness. Continue observation to identify edge cases.';
    } else if (readinessScore >= 25) {
      readinessLevel = 'low';
      recommendation = 'Low readiness. Human oversight required for most cases.';
    } else {
      readinessLevel = 'not_ready';
      recommendation = 'Not suitable for automation. Requires consistent human judgment.';
    }

    return {
      task_type: taskType,
      floor_id: floorId,
      readiness_score: readinessScore,
      readiness_level: readinessLevel,
      total_observations: totalObs,
      approval_rate: Math.round(approvalRate * 100),
      avg_decision_latency_ms: Math.round(avgLatency),
      dry_run_pass_rate: Math.round(dryRunPassRate * 100),
      human_override_rate: Math.round(overrideRate * 100),
      recommendation,
      last_calculated_at: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[OBSERVATION] Failed to calculate readiness:', err);
    return null;
  }
}

/**
 * Get automation readiness for all task types on a floor
 */
export async function getFloorAutomationReadiness(
  floorId: FloorId
): Promise<AutomationReadinessScore[]> {
  try {
    // Get unique task types for this floor
    const { data: taskTypes, error } = await supabase
      .from('task_observations')
      .select('task_type')
      .eq('floor_id', floorId);

    if (error || !taskTypes) return [];

    const uniqueTypes = [...new Set(taskTypes.map(t => t.task_type))];
    const scores: AutomationReadinessScore[] = [];

    for (const taskType of uniqueTypes) {
      const score = await calculateAutomationReadiness(taskType, floorId);
      if (score) scores.push(score);
    }

    return scores.sort((a, b) => b.readiness_score - a.readiness_score);
  } catch (err) {
    console.error('[OBSERVATION] Failed to get floor readiness:', err);
    return [];
  }
}

// ============= TASK PREVIEW GENERATION =============

/**
 * Generate a preview of what a task would do
 * This is shown BEFORE any action is taken
 */
export async function generateTaskPreview(
  taskId: string,
  taskType: string,
  floorId: FloorId,
  options: {
    entityIds?: string[];
    riskLevel?: TaskRiskLevel;
    dryRunRequired?: boolean;
    approvalRequired?: boolean;
  }
): Promise<TaskPreview> {
  // This is a placeholder that would be filled in by actual task logic
  // Each task type would provide its own preview generation
  
  const preview: TaskPreview = {
    task_id: taskId,
    task_type: taskType,
    floor_id: floorId,
    preview_type: 'mixed',
    affected_records: [],
    estimated_duration_ms: 0,
    risk_level: options.riskLevel || 'low',
    confidence_score: 0,
    dry_run_required: options.dryRunRequired ?? false,
    approval_required: options.approvalRequired ?? false,
    warnings: [],
    generated_at: new Date().toISOString(),
  };

  // Record that a preview was generated
  await recordObservation(taskId, taskType, floorId, 'task_created', {
    metadata: { preview_generated: true },
  });

  return preview;
}

// ============= PATTERN DETECTION =============

/**
 * Detect behavioral patterns from observations
 */
export async function detectBehavioralPatterns(
  floorId?: FloorId
): Promise<{
  pattern_type: string;
  description: string;
  frequency: number;
  task_types: string[];
}[]> {
  try {
    let query = supabase
      .from('task_observations')
      .select('task_type, observation_type, decision, floor_id')
      .order('created_at', { ascending: false })
      .limit(500);

    if (floorId) {
      query = query.eq('floor_id', floorId);
    }

    const { data: observations, error } = await query;
    if (error || !observations) return [];

    const patterns: {
      pattern_type: string;
      description: string;
      frequency: number;
      task_types: string[];
    }[] = [];

    // Pattern: Always approved
    const taskDecisions: Record<string, { approved: number; total: number }> = {};
    observations
      .filter(o => o.observation_type === 'decision_made')
      .forEach(o => {
        if (!taskDecisions[o.task_type]) {
          taskDecisions[o.task_type] = { approved: 0, total: 0 };
        }
        taskDecisions[o.task_type].total++;
        if (o.decision === 'approved' || o.decision === 'auto_approved') {
          taskDecisions[o.task_type].approved++;
        }
      });

    const alwaysApproved = Object.entries(taskDecisions)
      .filter(([_, stats]) => stats.total >= 5 && stats.approved / stats.total >= 0.95)
      .map(([type]) => type);

    if (alwaysApproved.length > 0) {
      patterns.push({
        pattern_type: 'always_approved',
        description: 'These task types are approved 95%+ of the time',
        frequency: alwaysApproved.length,
        task_types: alwaysApproved,
      });
    }

    // Pattern: High cancellation
    const cancellations = observations.filter(o => o.observation_type === 'task_cancelled');
    const highCancelTypes = [...new Set(cancellations.map(c => c.task_type))];
    
    if (highCancelTypes.length > 0) {
      patterns.push({
        pattern_type: 'high_cancellation',
        description: 'These task types are frequently cancelled',
        frequency: cancellations.length,
        task_types: highCancelTypes,
      });
    }

    return patterns;
  } catch (err) {
    console.error('[OBSERVATION] Failed to detect patterns:', err);
    return [];
  }
}

// ============= OBSERVATION QUERIES =============

/**
 * Get recent observations
 */
export async function getRecentObservations(
  options?: {
    floorId?: FloorId;
    taskType?: string;
    limit?: number;
  }
): Promise<TaskObservation[]> {
  let query = supabase
    .from('task_observations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(options?.limit || 100);

  if (options?.floorId) {
    query = query.eq('floor_id', options.floorId);
  }
  if (options?.taskType) {
    query = query.eq('task_type', options.taskType);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[OBSERVATION] Failed to fetch:', error);
    return [];
  }

  return (data || []) as TaskObservation[];
}

/**
 * Get observation statistics
 */
export async function getObservationStats(floorId?: FloorId): Promise<{
  totalObservations: number;
  decisionsRecorded: number;
  approvalRate: number;
  averageLatencyMs: number;
  taskTypesObserved: number;
}> {
  let query = supabase
    .from('task_observations')
    .select('observation_type, decision, decision_latency_ms, task_type');

  if (floorId) {
    query = query.eq('floor_id', floorId);
  }

  const { data, error } = await query;
  
  if (error || !data) {
    return {
      totalObservations: 0,
      decisionsRecorded: 0,
      approvalRate: 0,
      averageLatencyMs: 0,
      taskTypesObserved: 0,
    };
  }

  const decisions = data.filter(d => d.observation_type === 'decision_made');
  const approvals = decisions.filter(d => d.decision === 'approved' || d.decision === 'auto_approved');
  const latencies = decisions
    .filter(d => d.decision_latency_ms != null)
    .map(d => d.decision_latency_ms as number);

  return {
    totalObservations: data.length,
    decisionsRecorded: decisions.length,
    approvalRate: decisions.length > 0 ? Math.round((approvals.length / decisions.length) * 100) : 0,
    averageLatencyMs: latencies.length > 0 
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0,
    taskTypesObserved: new Set(data.map(d => d.task_type)).size,
  };
}
