// Floor 9 - AI Operations Engine
import { supabase } from '@/integrations/supabase/client';
import {
  AIWorker,
  AIWorkTask,
  AIPlaybook,
  AIRoutine,
  AIInstinctLog,
  AIActionQueueItem,
  AIPerformanceResult,
  AIKillSwitchState,
  WorkforceStats,
  AIHealthMetrics,
  TaskStatus,
  RiskLevel,
} from './types';

// ============= WORKERS =============

export async function getAIWorkers(): Promise<AIWorker[]> {
  const { data, error } = await supabase
    .from('ai_workers')
    .select('*')
    .order('worker_department', { ascending: true });

  if (error) throw error;
  return (data || []) as AIWorker[];
}

export async function getWorker(workerId: string): Promise<AIWorker | null> {
  const { data, error } = await supabase
    .from('ai_workers')
    .select('*')
    .eq('id', workerId)
    .single();

  if (error) return null;
  return data as AIWorker;
}

export async function updateWorkerStatus(workerId: string, status: AIWorker['status']): Promise<void> {
  const { error } = await supabase
    .from('ai_workers')
    .update({ status })
    .eq('id', workerId);

  if (error) throw error;
}

// ============= TASKS =============

export async function getAITasks(params?: {
  status?: TaskStatus;
  workerId?: string;
  priority?: string;
  department?: string;
  limit?: number;
}): Promise<AIWorkTask[]> {
  let query = supabase
    .from('ai_work_tasks')
    .select('*, worker:ai_workers(*)')
    .order('created_at', { ascending: false });

  if (params?.status) query = query.eq('status', params.status);
  if (params?.workerId) query = query.eq('assigned_to_worker_id', params.workerId);
  if (params?.priority) query = query.eq('priority', params.priority);
  if (params?.department) query = query.eq('department', params.department);
  if (params?.limit) query = query.limit(params.limit);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as AIWorkTask[];
}

export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  output?: Record<string, any>,
  errorMessage?: string
): Promise<void> {
  const updates: Record<string, any> = { status };

  if (status === 'completed' || status === 'failed') {
    updates.completed_at = new Date().toISOString();
  }
  if (status === 'processing') {
    updates.started_at = new Date().toISOString();
  }
  if (output) updates.output = output;
  if (errorMessage) updates.error_message = errorMessage;

  const { error } = await supabase
    .from('ai_work_tasks')
    .update(updates)
    .eq('id', taskId);

  if (error) throw error;
}

// ============= PLAYBOOKS =============

export async function getPlaybooks(params?: {
  domain?: string;
  isActive?: boolean;
}): Promise<AIPlaybook[]> {
  let query = supabase
    .from('ai_playbooks')
    .select('*')
    .order('title', { ascending: true }) as any;

  if (params?.domain) query = query.eq('domain', params.domain);
  if (params?.isActive !== undefined) query = query.eq('is_active', params.isActive);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as AIPlaybook[];
}

export async function getPlaybook(playbookId: string): Promise<AIPlaybook | null> {
  const { data, error } = await (supabase
    .from('ai_playbooks')
    .select('*')
    .eq('id', playbookId)
    .single() as any);

  if (error) return null;
  return data as unknown as AIPlaybook;
}

export async function togglePlaybook(playbookId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('ai_playbooks')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', playbookId);

  if (error) throw error;
}

// ============= ROUTINES =============

export async function getRoutines(params?: {
  playbookId?: string;
  active?: boolean;
}): Promise<AIRoutine[]> {
  let query = supabase
    .from('ai_routines')
    .select('*, playbook:ai_playbooks(*)')
    .order('next_run_at', { ascending: true }) as any;

  if (params?.playbookId) query = query.eq('playbook_id', params.playbookId);
  if (params?.active !== undefined) query = query.eq('active', params.active);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as AIRoutine[];
}

export async function toggleRoutine(routineId: string, active: boolean): Promise<void> {
  const { error } = await supabase
    .from('ai_routines')
    .update({ active, updated_at: new Date().toISOString() })
    .eq('id', routineId);

  if (error) throw error;
}

// ============= INSTINCT LOG =============

export async function getInstinctLogs(params?: {
  workerId?: string;
  taskId?: string;
  feedbackStatus?: string;
  limit?: number;
}): Promise<AIInstinctLog[]> {
  let query = supabase
    .from('ai_instinct_log')
    .select('*, worker:ai_workers(*), task:ai_work_tasks(*), playbook:ai_playbooks(*)')
    .order('created_at', { ascending: false }) as any;

  if (params?.workerId) query = query.eq('worker_id', params.workerId);
  if (params?.taskId) query = query.eq('task_id', params.taskId);
  if (params?.feedbackStatus) query = query.eq('feedback_status', params.feedbackStatus);
  if (params?.limit) query = query.limit(params.limit);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as AIInstinctLog[];
}

export async function submitInstinctFeedback(
  logId: string,
  feedback: string,
  status: 'accepted' | 'rejected' | 'modified'
): Promise<void> {
  const { error } = await supabase
    .from('ai_instinct_log')
    .update({ human_feedback: feedback, feedback_status: status })
    .eq('id', logId);

  if (error) throw error;
}

// ============= ACTION QUEUE =============

export async function getActionQueue(params?: {
  status?: string;
  riskLevel?: RiskLevel;
  limit?: number;
}): Promise<AIActionQueueItem[]> {
  let query = supabase
    .from('ai_action_queue')
    .select('*, worker:ai_workers(*), task:ai_work_tasks(*)')
    .order('created_at', { ascending: false }) as any;

  if (params?.status) query = query.eq('status', params.status);
  if (params?.riskLevel) query = query.eq('risk_level', params.riskLevel);
  if (params?.limit) query = query.limit(params.limit);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as AIActionQueueItem[];
}

export async function resolveActionItem(
  itemId: string,
  decision: 'accepted' | 'rejected' | 'modified',
  notes?: string,
  userId?: string
): Promise<void> {
  const { error } = await supabase
    .from('ai_action_queue')
    .update({
      status: decision,
      human_decision: decision,
      decision_notes: notes,
      decided_by: userId,
      decided_at: new Date().toISOString(),
    })
    .eq('id', itemId);

  if (error) throw error;
}

// ============= PERFORMANCE RESULTS =============

export async function getPerformanceResults(params?: {
  workerId?: string;
  playbookId?: string;
  days?: number;
}): Promise<AIPerformanceResult[]> {
  const since = new Date();
  since.setDate(since.getDate() - (params?.days || 30));

  let query = supabase
    .from('ai_performance_results')
    .select('*')
    .gte('period_start', since.toISOString().split('T')[0])
    .order('period_start', { ascending: false }) as any;

  if (params?.workerId) query = query.eq('worker_id', params.workerId);
  if (params?.playbookId) query = query.eq('playbook_id', params.playbookId);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as AIPerformanceResult[];
}

// ============= KILL SWITCH =============

export async function getKillSwitchState(): Promise<AIKillSwitchState[]> {
  const { data, error } = await (supabase
    .from('ai_kill_switch_state')
    .select('*')
    .order('activated_at', { ascending: false }) as any);

  if (error) throw error;
  return (data || []) as unknown as AIKillSwitchState[];
}

export async function activateKillSwitch(
  scope: 'global' | 'worker' | 'playbook',
  reason: string,
  targetId?: string,
  userId?: string
): Promise<void> {
  const insertData = {
    is_active: true,
    scope,
    activation_reason: reason,
    activated_by: userId,
    activated_at: new Date().toISOString(),
    target_worker_id: scope === 'worker' ? targetId : null,
    target_playbook_id: scope === 'playbook' ? targetId : null,
  };

  const { error } = await (supabase
    .from('ai_kill_switch_state')
    .insert(insertData) as any);

  if (error) throw error;
}

export async function deactivateKillSwitch(switchId: string, userId?: string): Promise<void> {
  const { error } = await supabase
    .from('ai_kill_switch_state')
    .update({
      is_active: false,
      deactivated_at: new Date().toISOString(),
      deactivated_by: userId,
    })
    .eq('id', switchId);

  if (error) throw error;
}

// ============= STATS & HEALTH =============

export async function getWorkforceStats(): Promise<WorkforceStats> {
  const today = new Date().toISOString().split('T')[0];

  const [workersResult, tasksResult, todayTasksResult, actionQueueResult] = await Promise.all([
    supabase.from('ai_workers').select('status'),
    supabase.from('ai_work_tasks').select('status'),
    supabase.from('ai_work_tasks').select('id').gte('created_at', today),
    supabase.from('ai_action_queue').select('id').eq('status', 'pending'),
  ]);

  const workers = workersResult.data || [];
  const tasks = tasksResult.data || [];

  return {
    total_workers: workers.length,
    active_workers: workers.filter(w => w.status === 'active').length,
    busy_workers: workers.filter(w => w.status === 'busy').length,
    sleeping_workers: workers.filter(w => w.status === 'sleeping').length,
    error_workers: workers.filter(w => w.status === 'error').length,
    total_tasks: tasks.length,
    pending_tasks: tasks.filter(t => t.status === 'pending').length,
    processing_tasks: tasks.filter(t => t.status === 'processing').length,
    completed_tasks: tasks.filter(t => t.status === 'completed').length,
    failed_tasks: tasks.filter(t => t.status === 'failed').length,
    escalated_tasks: tasks.filter(t => t.status === 'escalated').length,
    tasks_today: todayTasksResult.data?.length || 0,
    pending_actions: actionQueueResult.data?.length || 0,
    avg_confidence: 85, // TODO: Calculate from instinct logs
  };
}

export async function getAIHealthMetrics(): Promise<AIHealthMetrics> {
  const [killSwitchResult, actionQueueResult] = await Promise.all([
    supabase.from('ai_kill_switch_state').select('id').eq('is_active', true),
    supabase.from('ai_action_queue').select('id').eq('status', 'pending').eq('risk_level', 'high'),
  ]);

  return {
    overall_health: 95,
    uptime_percentage: 99.8,
    avg_response_time_ms: 245,
    error_rate: 0.02,
    confidence_trend: 'stable',
    active_kill_switches: killSwitchResult.data?.length || 0,
    pending_escalations: actionQueueResult.data?.length || 0,
  };
}

// ============= DEPARTMENTS =============

export function getDepartments(): string[] {
  return [
    'Sales/CRM',
    'Operations',
    'Wholesale',
    'Finance',
    'Intelligence',
    'Delivery',
    'Communication',
    'Ambassadors',
  ];
}

export function getPlaybookDomains(): string[] {
  return [
    'finance',
    'deliveries',
    'crm',
    'wholesale',
    'production',
    'communication',
    'inventory',
    'ambassadors',
    'general',
  ];
}
