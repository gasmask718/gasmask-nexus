// Floor 9 - AI Results & Outcomes Ledger Hook
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays, startOfDay, endOfDay } from 'date-fns';

export interface AIResultFilters {
  dateRange?: { from: Date; to: Date };
  taskType?: string;
  entityType?: string;
  executionMode?: string;
  status?: string;
  confidenceMin?: number;
  confidenceMax?: number;
  humanDecision?: string;
  department?: string;
  workerId?: string;
  limit?: number;
}

export interface AIResultItem {
  id: string;
  task_title: string;
  task_details: string | null;
  task_type: string | null;
  target_entity_type: string | null;
  target_entity_id: string | null;
  execution_mode: string | null;
  status: string;
  priority: string;
  department: string | null;
  instructions: string | null;
  confidence_score: number | null;
  risk_level: string | null;
  time_saved_minutes: number | null;
  error_message: string | null;
  approval_status: string | null;
  approved_by: string | null;
  approved_at: string | null;
  approval_notes: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  assigned_to_worker_id: string | null;
  execution_log: any[] | null;
  validation_errors: any[] | null;
  rollback_until: string | null;
  worker?: {
    id: string;
    worker_name: string;
    worker_role: string;
    worker_department: string;
  } | null;
  artifacts?: AIResultArtifact[];
  execution_steps?: AIExecutionStep[];
}

export interface AIResultArtifact {
  id: string;
  task_id: string;
  artifact_type: string;
  artifact_title: string;
  artifact_content: any;
  target_entity_type: string | null;
  target_entity_id: string | null;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  applied_at: string | null;
  rolled_back_at: string | null;
  created_at: string;
}

export interface AIExecutionStep {
  id: string;
  task_id: string;
  step_number: number;
  step_action: string;
  step_status: string;
  step_details: any;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface AIResultsMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  rolledBackTasks: number;
  awaitingApproval: number;
  artifactsGenerated: number;
  totalTimeSavedMinutes: number;
  humanAcceptanceRate: number;
  humanRejectionRate: number;
  avgConfidence: number;
  activeKillSwitches: number;
}

// Get finalized results (completed or failed tasks)
export async function getAIResults(filters?: AIResultFilters): Promise<AIResultItem[]> {
  const defaultFrom = subDays(new Date(), 30);
  const defaultTo = new Date();
  
  const from = filters?.dateRange?.from || defaultFrom;
  const to = filters?.dateRange?.to || defaultTo;

  let query = supabase
    .from('ai_work_tasks')
    .select('*, worker:ai_workers(id, worker_name, worker_role, worker_department)')
    .in('status', ['completed', 'failed', 'escalated', 'blocked'])
    .gte('created_at', startOfDay(from).toISOString())
    .lte('created_at', endOfDay(to).toISOString())
    .order('completed_at', { ascending: false, nullsFirst: false });

  if (filters?.taskType) query = query.eq('task_type', filters.taskType);
  if (filters?.entityType) query = query.eq('target_entity_type', filters.entityType);
  if (filters?.executionMode) query = query.eq('execution_mode', filters.executionMode);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.department) query = query.eq('department', filters.department);
  if (filters?.workerId) query = query.eq('assigned_to_worker_id', filters.workerId);
  if (filters?.confidenceMin) query = query.gte('confidence_score', filters.confidenceMin);
  if (filters?.confidenceMax) query = query.lte('confidence_score', filters.confidenceMax);
  if (filters?.humanDecision) query = query.eq('approval_status', filters.humanDecision);
  if (filters?.limit) query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as AIResultItem[];
}

// Get result details with artifacts and execution steps
export async function getResultDetail(taskId: string): Promise<AIResultItem | null> {
  const [taskResult, artifactsResult, stepsResult] = await Promise.all([
    supabase
      .from('ai_work_tasks')
      .select('*, worker:ai_workers(id, worker_name, worker_role, worker_department)')
      .eq('id', taskId)
      .single(),
    supabase
      .from('ai_task_artifacts')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true }),
    supabase
      .from('ai_task_execution_log')
      .select('*')
      .eq('task_id', taskId)
      .order('step_number', { ascending: true }),
  ]);

  if (taskResult.error) return null;

  return {
    ...(taskResult.data as unknown as AIResultItem),
    artifacts: (artifactsResult.data || []) as unknown as AIResultArtifact[],
    execution_steps: (stepsResult.data || []) as unknown as AIExecutionStep[],
  };
}

// Get aggregated metrics for the Results dashboard
export async function getResultsMetrics(days: number = 30): Promise<AIResultsMetrics> {
  const since = subDays(new Date(), days);
  
  const [
    tasksResult,
    artifactsResult,
    killSwitchResult,
    actionQueueResult,
  ] = await Promise.all([
    supabase
      .from('ai_work_tasks')
      .select('status, confidence_score, time_saved_minutes, approval_status')
      .gte('created_at', since.toISOString()),
    supabase
      .from('ai_task_artifacts')
      .select('id')
      .gte('created_at', since.toISOString()),
    supabase
      .from('ai_kill_switch_state')
      .select('id')
      .eq('is_active', true),
    supabase
      .from('ai_action_queue')
      .select('status')
      .in('status', ['pending', 'accepted', 'rejected', 'modified']),
  ]);

  const tasks = tasksResult.data || [];
  const artifacts = artifactsResult.data || [];
  const killSwitches = killSwitchResult.data || [];
  const actionQueue = actionQueueResult.data || [];

  const completed = tasks.filter(t => t.status === 'completed').length;
  const failed = tasks.filter(t => t.status === 'failed').length;
  const rolledBack = tasks.filter(t => t.status === 'rolled_back').length;
  const awaiting = tasks.filter(t => t.approval_status === 'pending').length;

  const approved = actionQueue.filter(a => a.status === 'accepted').length;
  const rejected = actionQueue.filter(a => a.status === 'rejected').length;
  const totalDecisions = approved + rejected;

  const confidenceSum = tasks.reduce((sum, t) => sum + (t.confidence_score || 0), 0);
  const tasksWithConfidence = tasks.filter(t => t.confidence_score != null).length;
  
  const timeSaved = tasks.reduce((sum, t) => sum + (t.time_saved_minutes || 0), 0);

  return {
    totalTasks: tasks.length,
    completedTasks: completed,
    failedTasks: failed,
    rolledBackTasks: rolledBack,
    awaitingApproval: awaiting,
    artifactsGenerated: artifacts.length,
    totalTimeSavedMinutes: timeSaved,
    humanAcceptanceRate: totalDecisions > 0 ? Math.round((approved / totalDecisions) * 100) : 0,
    humanRejectionRate: totalDecisions > 0 ? Math.round((rejected / totalDecisions) * 100) : 0,
    avgConfidence: tasksWithConfidence > 0 ? Math.round(confidenceSum / tasksWithConfidence) : 0,
    activeKillSwitches: killSwitches.length,
  };
}

// Get unique task types for filter dropdown
export async function getTaskTypes(): Promise<string[]> {
  const { data } = await supabase
    .from('ai_work_tasks')
    .select('task_type')
    .not('task_type', 'is', null);
  
  const types = [...new Set((data || []).map(t => t.task_type).filter(Boolean))];
  return types as string[];
}

// Get entity types for filter dropdown
export async function getEntityTypes(): Promise<string[]> {
  const { data } = await supabase
    .from('ai_work_tasks')
    .select('target_entity_type')
    .not('target_entity_type', 'is', null);
  
  const types = [...new Set((data || []).map(t => t.target_entity_type).filter(Boolean))];
  return types as string[];
}

// ============= HOOKS =============

export function useAIResults(filters?: AIResultFilters) {
  return useQuery({
    queryKey: ['floor9', 'results', filters],
    queryFn: () => getAIResults(filters),
    refetchInterval: 30000,
  });
}

export function useResultDetail(taskId: string | null) {
  return useQuery({
    queryKey: ['floor9', 'result-detail', taskId],
    queryFn: () => (taskId ? getResultDetail(taskId) : null),
    enabled: !!taskId,
  });
}

export function useResultsMetrics(days: number = 30) {
  return useQuery({
    queryKey: ['floor9', 'results-metrics', days],
    queryFn: () => getResultsMetrics(days),
    refetchInterval: 60000,
  });
}

export function useTaskTypes() {
  return useQuery({
    queryKey: ['floor9', 'task-types'],
    queryFn: getTaskTypes,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useEntityTypes() {
  return useQuery({
    queryKey: ['floor9', 'entity-types'],
    queryFn: getEntityTypes,
    staleTime: 5 * 60 * 1000,
  });
}
