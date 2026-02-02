/**
 * Global Task Governance Types
 * Unified task tracking for Floors 1-9
 */

// Floor identifiers
export type FloorId = 
  | 'floor1_crm'
  | 'floor2_communication'
  | 'floor3_inventory'
  | 'floor4_delivery'
  | 'floor5_finance'
  | 'floor6_production'
  | 'floor7_marketplace'
  | 'floor8_ambassadors'
  | 'floor9_ai';

// Task status lifecycle
export type GovernedTaskStatus = 
  | 'queued'
  | 'running'
  | 'paused_for_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

// Risk levels for task execution
export type TaskRiskLevel = 'low' | 'medium' | 'high' | 'critical';

// Task progress tracking
export interface TaskProgress {
  total_items: number;
  items_processed: number;
  items_completed: number;
  items_blocked: number;
  items_skipped: number;
  items_pending_approval: number;
}

// Activity log entry for real-time tracking
export interface TaskActivityEntry {
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

// Completion report structure
export interface TaskCompletionReport {
  task_id: string;
  task_title: string;
  task_type: string;
  floor_id: FloorId;
  status: GovernedTaskStatus;
  total_items: number;
  items_completed: number;
  items_blocked: number;
  items_skipped: number;
  completion_percentage: number;
  blocked_percentage: number;
  blocked_reasons: BlockedItem[];
  execution_duration_minutes: number;
  time_saved_minutes: number;
  started_at: string | null;
  completed_at: string | null;
  generated_at: string;
  audit_confirmation: string;
}

export interface BlockedItem {
  entity_name: string;
  entity_type: string;
  entity_id: string;
  reason: string;
}

// Cancellation result
export interface TaskCancellationResult {
  success: boolean;
  cancelled_actions: number;
  preserved_records: number;
  error?: string;
}

// Task template for floor-specific operations
export interface TaskTemplate {
  id: string;
  floor_id: FloorId;
  task_type: string;
  task_title: string;
  description: string;
  category: string;
  risk_level: TaskRiskLevel;
  requires_approval: boolean;
  estimated_duration_minutes: number;
  icon?: string;
}

// Floor task registry
export interface FloorTaskRegistry {
  floor_id: FloorId;
  floor_name: string;
  floor_icon: string;
  available_tasks: TaskTemplate[];
}

// Governed task instance (extends ai_work_tasks)
export interface GovernedTask {
  id: string;
  floor_id: FloorId;
  task_title: string;
  task_type: string;
  task_details: string | null;
  status: GovernedTaskStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';
  risk_level: TaskRiskLevel;
  requires_approval: boolean;
  // Progress tracking
  total_items: number;
  items_processed: number;
  items_completed: number;
  items_blocked: number;
  items_skipped: number;
  items_pending_approval: number;
  // Execution metadata
  confidence_score: number | null;
  time_saved_minutes: number;
  execution_mode: string | null;
  // Timestamps
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  // Report
  final_report: TaskCompletionReport | null;
}
