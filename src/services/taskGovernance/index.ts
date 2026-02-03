/**
 * Task Governance Service - Public API
 * Unified task tracking for Floors 1-9
 * 
 * Phase A-D Go-Live Fix Implementation:
 * - Phase A: Button Integrity (useGovernedAction hook)
 * - Phase B: Task Coverage (actionRegistry)
 * - Phase C: Risk & Approval (governanceConfig)
 * - Phase D: Dry-Run Mode (dryRunService)
 */

// Types
export type {
  FloorId,
  GovernedTaskStatus,
  TaskRiskLevel,
  TaskProgress,
  TaskActivityEntry,
  TaskCompletionReport,
  BlockedItem,
  TaskCancellationResult,
  TaskTemplate,
  FloorTaskRegistry,
  GovernedTask,
} from './types';

// Registry (exclude getTasksByFloor to avoid conflict)
export {
  FLOOR_REGISTRIES,
  getFloorRegistry,
  getTaskTemplate,
  getAllTasks,
  getTasksByCategory,
  getHighRiskTasks,
  getTasksByFloor as getTaskTemplatesByFloor,
} from './taskRegistry';

// Service
export {
  createGovernedTask,
  startTask,
  completeTask,
  failTask,
  pauseForApproval,
  updateProgress,
  incrementCounter,
  recordItemResult,
  logTaskActivity,
  getTaskActivities,
  cancelTask,
  deleteTask,
  restartTask,
  generateCompletionReport,
  getTasksByFloor,
  getAllActiveTasks,
  getTaskById,
} from './taskGovernanceService';

export type {
  TaskDeleteResult,
  TaskRestartResult,
  TaskQueryOptions,
} from './taskGovernanceService';

// Governance Configuration (Phase C)
export {
  RISK_POLICIES,
  FLOOR_POLICIES,
  TASK_TYPE_POLICIES,
  getRiskPolicy,
  getFloorPolicy,
  getTaskTypePolicy,
  checkGovernance,
  canExecuteLive,
  isDryRunRequired,
} from './governanceConfig';
export type {
  ExecutionMode,
  ExecutionModeConfig,
  RiskPolicy,
  FloorPolicy,
  TaskTypePolicy,
  GovernanceCheck,
} from './governanceConfig';

// Dry-Run Service (Phase D)
export {
  executeDryRun,
  checkLiveExecutionAllowed,
  createExecutionContext,
  guardWrite,
} from './dryRunService';
export type {
  DryRunResult,
  DryRunContext,
  DryRunItemResult,
  LiveExecutionOptions,
  LiveExecutionCheck,
  ExecutionContext,
} from './dryRunService';

// Production Lock (Phase G)
export {
  enableProductionLock,
  disableProductionLock,
  isProductionLockEnabled,
  getProductionLockConfig,
  setLockMode,
  checkWriteAllowed,
  logViolation,
  getViolations,
  governanceGuard,
  getGovernanceLockStatus,
  initializeProductionLock,
} from './productionLock';
export type {
  ProductionLockConfig,
  GovernanceLockStatus,
} from './productionLock';

// Action Registry (Phase B)
export {
  ACTION_REGISTRY,
  getActionMapping,
  getActionsByFloor,
  getActionsByRisk,
  getHighRiskActions,
  getActionsRequiringApproval,
  generateActionCoverageReport,
} from './actionRegistry';
export type { ActionMapping, ActionCoverageReport } from './actionRegistry';

// Observation Service (Phase 4.5)
export {
  recordObservation,
  recordDecision,
  calculateAutomationReadiness,
  getFloorAutomationReadiness,
  generateTaskPreview,
  detectBehavioralPatterns,
  getRecentObservations,
  getObservationStats,
} from './observationService';
export type {
  TaskObservation,
  ObservationType,
  TaskDecision,
  AutomationReadinessScore,
  TaskPreview,
  PreviewRecord,
} from './observationService';

// Re-export types
export * from './types';
