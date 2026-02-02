// Floor 9 - AI Operations Type Definitions

export type AIWorkerStatus = 'active' | 'sleeping' | 'busy' | 'error' | 'paused';
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'escalated' | 'blocked';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type FeedbackStatus = 'pending' | 'accepted' | 'rejected' | 'modified';

export interface AIWorker {
  id: string;
  worker_name: string;
  worker_role: string;
  worker_department: string;
  description: string | null;
  kpi_metrics: Record<string, any>;
  memory: Record<string, any>;
  status: AIWorkerStatus;
  experience_points: number;
  tasks_completed: number;
  tasks_failed: number;
  last_task_at: string | null;
  created_at: string;
}

export interface AIWorkTask {
  id: string;
  task_title: string;
  task_details: string | null;
  assigned_to_worker_id: string | null;
  auto_assigned: boolean;
  status: TaskStatus;
  priority: TaskPriority;
  department: string | null;
  tags: string[];
  input_data: Record<string, any>;
  output: Record<string, any>;
  error_message: string | null;
  parent_task_id: string | null;
  created_by: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  worker?: AIWorker;
}

export interface AIPlaybook {
  id: string;
  user_id: string | null;
  title: string;
  description: string | null;
  steps: PlaybookStep[];
  domain: string;
  trigger_conditions: TriggerCondition[];
  allowed_data_sources: string[];
  decision_rules: DecisionRule[];
  output_types: string[];
  confidence_threshold: number;
  escalation_rules: EscalationRule;
  requires_approval: boolean;
  is_active: boolean;
  version: number;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlaybookStep {
  order: number;
  action: string;
  description: string;
  conditions?: Record<string, any>;
  outputs?: string[];
}

export interface TriggerCondition {
  type: 'schedule' | 'event' | 'threshold' | 'manual';
  config: Record<string, any>;
}

export interface DecisionRule {
  name: string;
  condition: string;
  action: string;
  confidence_required: number;
}

export interface EscalationRule {
  on_low_confidence?: boolean;
  on_error?: boolean;
  on_threshold_breach?: boolean;
  escalate_to?: string;
  notify_channels?: string[];
}

export interface AIRoutine {
  id: string;
  playbook_id: string;
  routine_name: string | null;
  description: string | null;
  frequency: string;
  next_run_at: string;
  active: boolean;
  notify_user: boolean;
  input_sources: InputSource[];
  expected_outputs: string[];
  notification_rules: NotificationRule;
  failure_handling: string;
  last_run_at: string | null;
  last_result: Record<string, any> | null;
  run_count: number;
  success_count: number;
  failure_count: number;
  created_at: string;
  updated_at: string;
  playbook?: AIPlaybook;
}

export interface InputSource {
  type: 'table' | 'api' | 'function' | 'external';
  name: string;
  config?: Record<string, any>;
}

export interface NotificationRule {
  on_success?: boolean;
  on_failure?: boolean;
  channels?: string[];
  recipients?: string[];
}

export interface AIInstinctLog {
  id: string;
  worker_id: string | null;
  task_id: string | null;
  playbook_id: string | null;
  action_type: string;
  input_data: Record<string, any>;
  reasoning: string;
  decision_path: DecisionPathStep[];
  confidence_score: number;
  human_feedback: string | null;
  feedback_status: FeedbackStatus;
  created_at: string;
  worker?: AIWorker;
  task?: AIWorkTask;
  playbook?: AIPlaybook;
}

export interface DecisionPathStep {
  step: number;
  action: string;
  reasoning: string;
  confidence: number;
}

export interface AIActionQueueItem {
  id: string;
  task_id: string | null;
  worker_id: string | null;
  action_type: string;
  action_summary: string;
  ai_recommendation: string;
  reasoning: Record<string, any>;
  risk_level: RiskLevel;
  sla_deadline: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'modified' | 'expired';
  human_decision: string | null;
  decision_notes: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  worker?: AIWorker;
  task?: AIWorkTask;
}

export interface AIPerformanceResult {
  id: string;
  period_start: string;
  period_end: string;
  worker_id: string | null;
  playbook_id: string | null;
  tasks_auto_resolved: number;
  tasks_escalated: number;
  time_saved_minutes: number;
  errors_prevented: number;
  revenue_protected: number;
  revenue_generated: number;
  human_trust_score: number;
  confidence_trend: ConfidenceTrendPoint[];
  created_at: string;
}

export interface ConfidenceTrendPoint {
  date: string;
  confidence: number;
  tasks: number;
}

export interface AIKillSwitchState {
  id: string;
  is_active: boolean;
  scope: 'global' | 'worker' | 'playbook';
  target_worker_id: string | null;
  target_playbook_id: string | null;
  activated_by: string | null;
  activation_reason: string | null;
  activated_at: string;
  deactivated_at: string | null;
  deactivated_by: string | null;
}

export interface WorkforceStats {
  total_workers: number;
  active_workers: number;
  busy_workers: number;
  sleeping_workers: number;
  error_workers: number;
  total_tasks: number;
  pending_tasks: number;
  processing_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  escalated_tasks: number;
  tasks_today: number;
  pending_actions: number;
  avg_confidence: number;
}

export interface AIHealthMetrics {
  overall_health: number;
  uptime_percentage: number;
  avg_response_time_ms: number;
  error_rate: number;
  confidence_trend: 'rising' | 'stable' | 'declining';
  active_kill_switches: number;
  pending_escalations: number;
}
