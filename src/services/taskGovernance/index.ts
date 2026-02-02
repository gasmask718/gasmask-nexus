/**
 * Task Governance Service - Public API
 * Unified task tracking for Floors 1-9
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
  generateCompletionReport,
  getTasksByFloor,
  getAllActiveTasks,
  getTaskById,
} from './taskGovernanceService';

export * from './types';
export * from './taskRegistry';
export * from './taskGovernanceService';
