/**
 * Task Governance Configuration
 * Phase C: Risk, Confidence & Approval Rules
 * 
 * Enforces governance rules uniformly by configuration, not UI conditionals.
 */

import { FloorId, TaskRiskLevel } from './types';

// ============= EXECUTION MODES =============

export type ExecutionMode = 'dry_run' | 'live';

export interface ExecutionModeConfig {
  mode: ExecutionMode;
  allow_writes: boolean;
  require_dry_run_first: boolean;
  allow_override: boolean;
}

// Default: live mode blocked until dry-run passes
export const DEFAULT_EXECUTION_CONFIG: ExecutionModeConfig = {
  mode: 'dry_run',
  allow_writes: false,
  require_dry_run_first: true,
  allow_override: false,
};

// ============= RISK → APPROVAL POLICY =============

export interface RiskPolicy {
  risk_level: TaskRiskLevel;
  requires_approval: boolean;
  min_confidence_score: number | null;
  allow_auto_execute: boolean;
  max_batch_size: number;
  require_dry_run: boolean;
}

export const RISK_POLICIES: Record<TaskRiskLevel, RiskPolicy> = {
  low: {
    risk_level: 'low',
    requires_approval: false,
    min_confidence_score: null,
    allow_auto_execute: true,
    max_batch_size: 500,
    require_dry_run: false,
  },
  medium: {
    risk_level: 'medium',
    requires_approval: false,
    min_confidence_score: 0.7,
    allow_auto_execute: true,
    max_batch_size: 100,
    require_dry_run: true,
  },
  high: {
    risk_level: 'high',
    requires_approval: true,
    min_confidence_score: 0.85,
    allow_auto_execute: false,
    max_batch_size: 25,
    require_dry_run: true,
  },
  critical: {
    risk_level: 'critical',
    requires_approval: true,
    min_confidence_score: 0.95,
    allow_auto_execute: false,
    max_batch_size: 10,
    require_dry_run: true,
  },
};

// ============= FLOOR-SPECIFIC POLICIES =============

export interface FloorPolicy {
  floor_id: FloorId;
  floor_name: string;
  default_risk_level: TaskRiskLevel;
  financial_operations: boolean;
  requires_audit_log: boolean;
  allow_batch_operations: boolean;
  special_rules: string[];
}

export const FLOOR_POLICIES: Record<FloorId, FloorPolicy> = {
  floor1_crm: {
    floor_id: 'floor1_crm',
    floor_name: 'CRM / Store Master',
    default_risk_level: 'low',
    financial_operations: false,
    requires_audit_log: true,
    allow_batch_operations: true,
    special_rules: ['CRM notes auto-execute allowed', 'Contact cleanup requires approval'],
  },
  floor2_communication: {
    floor_id: 'floor2_communication',
    floor_name: 'Communication Hub',
    default_risk_level: 'medium',
    financial_operations: false,
    requires_audit_log: true,
    allow_batch_operations: true,
    special_rules: ['Draft-first for all outbound', 'Human approval for bulk sends'],
  },
  floor3_inventory: {
    floor_id: 'floor3_inventory',
    floor_name: 'Inventory Engine',
    default_risk_level: 'medium',
    financial_operations: false,
    requires_audit_log: true,
    allow_batch_operations: true,
    special_rules: ['Quantity changes require approval', 'Reconciliation high-risk'],
  },
  floor4_delivery: {
    floor_id: 'floor4_delivery',
    floor_name: 'Delivery & Routing',
    default_risk_level: 'medium',
    financial_operations: false,
    requires_audit_log: true,
    allow_batch_operations: true,
    special_rules: ['Route changes require approval', 'Capacity recalc auto-allowed'],
  },
  floor5_finance: {
    floor_id: 'floor5_finance',
    floor_name: 'Finance & Orders',
    default_risk_level: 'high',
    financial_operations: true,
    requires_audit_log: true,
    allow_batch_operations: true,
    special_rules: [
      'All invoice operations require approval OR confidence ≥ 0.85',
      'Ledger modifications always require approval',
      'Payment operations are critical risk',
    ],
  },
  floor6_production: {
    floor_id: 'floor6_production',
    floor_name: 'Production',
    default_risk_level: 'medium',
    financial_operations: false,
    requires_audit_log: true,
    allow_batch_operations: true,
    special_rules: ['Quantity/output changes require approval', 'Work order gen auto-allowed with dry-run'],
  },
  floor7_marketplace: {
    floor_id: 'floor7_marketplace',
    floor_name: 'Marketplace / Wholesale',
    default_risk_level: 'medium',
    financial_operations: true,
    requires_audit_log: true,
    allow_batch_operations: true,
    special_rules: ['Pricing changes require approval', 'Order cleanup medium-risk'],
  },
  floor8_ambassadors: {
    floor_id: 'floor8_ambassadors',
    floor_name: 'Ambassadors & Reps',
    default_risk_level: 'medium',
    financial_operations: true,
    requires_audit_log: true,
    allow_batch_operations: true,
    special_rules: ['Payout calculations are critical', 'Performance reviews auto-allowed'],
  },
  floor9_ai: {
    floor_id: 'floor9_ai',
    floor_name: 'AI Operations',
    default_risk_level: 'medium',
    financial_operations: false,
    requires_audit_log: true,
    allow_batch_operations: true,
    special_rules: ['Confidence calibration requires approval', 'Kill switch enforcement'],
  },
};

// ============= TASK TYPE → POLICY MAPPING =============

export interface TaskTypePolicy {
  task_type: string;
  floor_id: FloorId;
  risk_level: TaskRiskLevel;
  requires_approval: boolean;
  allow_dry_run: boolean;
  min_confidence: number | null;
  description: string;
}

export const TASK_TYPE_POLICIES: TaskTypePolicy[] = [
  // Floor 1 - CRM
  { task_type: 'backfill_notes', floor_id: 'floor1_crm', risk_level: 'low', requires_approval: false, allow_dry_run: true, min_confidence: null, description: 'Auto-execute allowed' },
  { task_type: 'clean_contacts', floor_id: 'floor1_crm', risk_level: 'medium', requires_approval: true, allow_dry_run: true, min_confidence: 0.7, description: 'Approval required' },
  { task_type: 'verify_followups', floor_id: 'floor1_crm', risk_level: 'low', requires_approval: false, allow_dry_run: true, min_confidence: null, description: 'Auto-execute allowed' },
  { task_type: 'normalize_stores', floor_id: 'floor1_crm', risk_level: 'medium', requires_approval: true, allow_dry_run: true, min_confidence: 0.7, description: 'Approval required' },
  
  // Floor 2 - Communication
  { task_type: 'campaign_audit', floor_id: 'floor2_communication', risk_level: 'low', requires_approval: false, allow_dry_run: true, min_confidence: null, description: 'Audit only' },
  { task_type: 'disposition_cleanup', floor_id: 'floor2_communication', risk_level: 'medium', requires_approval: true, allow_dry_run: true, min_confidence: 0.7, description: 'Approval required' },
  { task_type: 'inbox_triage', floor_id: 'floor2_communication', risk_level: 'medium', requires_approval: true, allow_dry_run: true, min_confidence: 0.7, description: 'Approval required' },
  { task_type: 'ai_followups', floor_id: 'floor2_communication', risk_level: 'medium', requires_approval: true, allow_dry_run: true, min_confidence: 0.8, description: 'Draft-first required' },
  
  // Floor 3 - Inventory
  { task_type: 'inventory_reconciliation', floor_id: 'floor3_inventory', risk_level: 'high', requires_approval: true, allow_dry_run: true, min_confidence: 0.85, description: 'High-risk financial' },
  { task_type: 'count_audit', floor_id: 'floor3_inventory', risk_level: 'medium', requires_approval: false, allow_dry_run: true, min_confidence: 0.7, description: 'Audit only' },
  { task_type: 'low_stock_detection', floor_id: 'floor3_inventory', risk_level: 'low', requires_approval: false, allow_dry_run: true, min_confidence: null, description: 'Alert only' },
  { task_type: 'supplier_sync', floor_id: 'floor3_inventory', risk_level: 'medium', requires_approval: true, allow_dry_run: true, min_confidence: 0.7, description: 'External sync' },
  
  // Floor 4 - Delivery
  { task_type: 'route_optimization', floor_id: 'floor4_delivery', risk_level: 'medium', requires_approval: true, allow_dry_run: true, min_confidence: 0.7, description: 'Route changes' },
  { task_type: 'capacity_recalculation', floor_id: 'floor4_delivery', risk_level: 'low', requires_approval: false, allow_dry_run: true, min_confidence: null, description: 'Auto-execute' },
  { task_type: 'exception_resolution', floor_id: 'floor4_delivery', risk_level: 'medium', requires_approval: true, allow_dry_run: true, min_confidence: 0.7, description: 'Approval required' },
  { task_type: 'delivery_reconciliation', floor_id: 'floor4_delivery', risk_level: 'medium', requires_approval: false, allow_dry_run: true, min_confidence: 0.7, description: 'Audit only' },
  
  // Floor 5 - Finance (HIGH RISK)
  { task_type: 'invoice_creation', floor_id: 'floor5_finance', risk_level: 'high', requires_approval: true, allow_dry_run: true, min_confidence: 0.85, description: 'Financial write' },
  { task_type: 'invoice_reconciliation', floor_id: 'floor5_finance', risk_level: 'high', requires_approval: true, allow_dry_run: true, min_confidence: 0.85, description: 'Financial audit' },
  { task_type: 'unpaid_account_audit', floor_id: 'floor5_finance', risk_level: 'medium', requires_approval: false, allow_dry_run: true, min_confidence: 0.7, description: 'Audit only' },
  { task_type: 'ledger_validation', floor_id: 'floor5_finance', risk_level: 'high', requires_approval: true, allow_dry_run: true, min_confidence: 0.9, description: 'Ledger integrity' },
  
  // Floor 6 - Production
  { task_type: 'work_order_generation', floor_id: 'floor6_production', risk_level: 'medium', requires_approval: true, allow_dry_run: true, min_confidence: 0.7, description: 'Production planning' },
  { task_type: 'production_backfill', floor_id: 'floor6_production', risk_level: 'medium', requires_approval: true, allow_dry_run: true, min_confidence: 0.7, description: 'Data correction' },
  { task_type: 'exception_audit', floor_id: 'floor6_production', risk_level: 'low', requires_approval: false, allow_dry_run: true, min_confidence: null, description: 'Audit only' },
  
  // Floor 7 - Marketplace
  { task_type: 'order_cleanup', floor_id: 'floor7_marketplace', risk_level: 'medium', requires_approval: true, allow_dry_run: true, min_confidence: 0.7, description: 'Data cleanup' },
  { task_type: 'vendor_audit', floor_id: 'floor7_marketplace', risk_level: 'low', requires_approval: false, allow_dry_run: true, min_confidence: null, description: 'Audit only' },
  { task_type: 'pricing_validation', floor_id: 'floor7_marketplace', risk_level: 'high', requires_approval: true, allow_dry_run: true, min_confidence: 0.85, description: 'Financial impact' },
  
  // Floor 8 - Ambassadors
  { task_type: 'attribution_audit', floor_id: 'floor8_ambassadors', risk_level: 'medium', requires_approval: false, allow_dry_run: true, min_confidence: 0.7, description: 'Audit only' },
  { task_type: 'payout_recalculation', floor_id: 'floor8_ambassadors', risk_level: 'critical', requires_approval: true, allow_dry_run: true, min_confidence: 0.95, description: 'Critical financial' },
  { task_type: 'performance_review', floor_id: 'floor8_ambassadors', risk_level: 'low', requires_approval: false, allow_dry_run: true, min_confidence: null, description: 'Report generation' },
  
  // Floor 9 - AI
  { task_type: 'worker_health_check', floor_id: 'floor9_ai', risk_level: 'low', requires_approval: false, allow_dry_run: false, min_confidence: null, description: 'Monitoring only' },
  { task_type: 'playbook_audit', floor_id: 'floor9_ai', risk_level: 'medium', requires_approval: false, allow_dry_run: true, min_confidence: 0.7, description: 'Audit only' },
  { task_type: 'confidence_calibration', floor_id: 'floor9_ai', risk_level: 'high', requires_approval: true, allow_dry_run: true, min_confidence: 0.85, description: 'Model calibration' },
];

// ============= GOVERNANCE ENFORCEMENT =============

export function getTaskTypePolicy(taskType: string): TaskTypePolicy | undefined {
  return TASK_TYPE_POLICIES.find(p => p.task_type === taskType);
}

export function getRiskPolicy(riskLevel: TaskRiskLevel): RiskPolicy {
  return RISK_POLICIES[riskLevel];
}

export function getFloorPolicy(floorId: FloorId): FloorPolicy {
  return FLOOR_POLICIES[floorId];
}

export interface GovernanceCheck {
  allowed: boolean;
  requires_approval: boolean;
  requires_dry_run: boolean;
  min_confidence: number | null;
  max_batch_size: number;
  blocking_reason: string | null;
}

export function checkGovernance(
  taskType: string,
  floorId: FloorId,
  executionMode: ExecutionMode,
  confidenceScore?: number,
  hasDryRunPassed?: boolean
): GovernanceCheck {
  const taskPolicy = getTaskTypePolicy(taskType);
  const floorPolicy = getFloorPolicy(floorId);
  const riskPolicy = taskPolicy ? getRiskPolicy(taskPolicy.risk_level) : getRiskPolicy(floorPolicy.default_risk_level);

  // Check dry-run requirement
  const requiresDryRun = riskPolicy.require_dry_run || (taskPolicy?.allow_dry_run ?? true);
  
  if (executionMode === 'live' && requiresDryRun && !hasDryRunPassed) {
    return {
      allowed: false,
      requires_approval: riskPolicy.requires_approval,
      requires_dry_run: true,
      min_confidence: riskPolicy.min_confidence_score,
      max_batch_size: riskPolicy.max_batch_size,
      blocking_reason: 'Live mode blocked: dry-run must pass first or be explicitly overridden',
    };
  }

  // Check confidence threshold
  if (riskPolicy.min_confidence_score && confidenceScore !== undefined) {
    if (confidenceScore < riskPolicy.min_confidence_score) {
      return {
        allowed: false,
        requires_approval: true, // Force approval if confidence too low
        requires_dry_run: requiresDryRun,
        min_confidence: riskPolicy.min_confidence_score,
        max_batch_size: riskPolicy.max_batch_size,
        blocking_reason: `Confidence score (${(confidenceScore * 100).toFixed(0)}%) below threshold (${(riskPolicy.min_confidence_score * 100).toFixed(0)}%)`,
      };
    }
  }

  return {
    allowed: true,
    requires_approval: riskPolicy.requires_approval,
    requires_dry_run: requiresDryRun,
    min_confidence: riskPolicy.min_confidence_score,
    max_batch_size: riskPolicy.max_batch_size,
    blocking_reason: null,
  };
}

// ============= EXECUTION MODE HELPERS =============

export function canExecuteLive(
  taskType: string,
  floorId: FloorId,
  hasDryRunPassed: boolean,
  hasApproval: boolean,
  confidenceScore?: number
): { allowed: boolean; reason: string } {
  const check = checkGovernance(taskType, floorId, 'live', confidenceScore, hasDryRunPassed);
  
  if (!check.allowed) {
    return { allowed: false, reason: check.blocking_reason || 'Governance check failed' };
  }
  
  if (check.requires_approval && !hasApproval) {
    return { allowed: false, reason: 'Human approval required before live execution' };
  }
  
  return { allowed: true, reason: 'All governance checks passed' };
}

export function isDryRunRequired(taskType: string, floorId: FloorId): boolean {
  const taskPolicy = getTaskTypePolicy(taskType);
  const floorPolicy = getFloorPolicy(floorId);
  const riskPolicy = taskPolicy ? getRiskPolicy(taskPolicy.risk_level) : getRiskPolicy(floorPolicy.default_risk_level);
  
  return riskPolicy.require_dry_run;
}
