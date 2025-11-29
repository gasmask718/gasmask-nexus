import { supabase } from '@/integrations/supabase/client';

export interface AIWorker {
  id: string;
  worker_name: string;
  worker_role: string;
  worker_department: string;
  description: string | null;
  kpi_metrics: Record<string, any>;
  memory: Record<string, any>;
  status: 'active' | 'sleeping' | 'busy' | 'error';
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
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'escalated';
  priority: 'low' | 'medium' | 'high' | 'critical';
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

export interface WorkforceStats {
  total_workers: number;
  active_workers: number;
  busy_workers: number;
  total_tasks: number;
  pending_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  tasks_today: number;
}

// Get all AI workers
export async function getAIWorkers(): Promise<AIWorker[]> {
  const { data, error } = await supabase
    .from('ai_workers')
    .select('*')
    .order('worker_department', { ascending: true });

  if (error) throw error;
  return (data || []) as AIWorker[];
}

// Get workers by department
export async function getWorkersByDepartment(department: string): Promise<AIWorker[]> {
  const { data, error } = await supabase
    .from('ai_workers')
    .select('*')
    .eq('worker_department', department);

  if (error) throw error;
  return (data || []) as AIWorker[];
}

// Get a single worker
export async function getWorker(workerId: string): Promise<AIWorker | null> {
  const { data, error } = await supabase
    .from('ai_workers')
    .select('*')
    .eq('id', workerId)
    .single();

  if (error) return null;
  return data as AIWorker;
}

// Update worker memory
export async function updateWorkerMemory(workerId: string, memory: Record<string, any>): Promise<void> {
  const { error } = await supabase
    .from('ai_workers')
    .update({ memory })
    .eq('id', workerId);

  if (error) throw error;
}

// Get all tasks
export async function getAITasks(params?: {
  status?: string;
  workerId?: string;
  priority?: string;
  limit?: number;
}): Promise<AIWorkTask[]> {
  let query = supabase
    .from('ai_work_tasks')
    .select('*, worker:ai_workers(*)')
    .order('created_at', { ascending: false });

  if (params?.status) {
    query = query.eq('status', params.status);
  }
  if (params?.workerId) {
    query = query.eq('assigned_to_worker_id', params.workerId);
  }
  if (params?.priority) {
    query = query.eq('priority', params.priority);
  }
  if (params?.limit) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as AIWorkTask[];
}

// Create a new task (manual)
export async function createTask(params: {
  title: string;
  details?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  department?: string;
  inputData?: Record<string, any>;
  tags?: string[];
}): Promise<AIWorkTask> {
  const { data, error } = await supabase
    .from('ai_work_tasks')
    .insert({
      task_title: params.title,
      task_details: params.details,
      priority: params.priority || 'medium',
      department: params.department,
      input_data: params.inputData || {},
      tags: params.tags || [],
    })
    .select()
    .single();

  if (error) throw error;
  return data as AIWorkTask;
}

// Submit command to AI workforce
export async function submitCommand(command: string, options?: {
  priority?: 'low' | 'medium' | 'high' | 'critical';
  details?: string;
  inputData?: Record<string, any>;
}): Promise<{ success: boolean; task?: AIWorkTask; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('ai-worker-engine', {
      body: {
        mode: 'create_task',
        command,
        priority: options?.priority || 'medium',
        details: options?.details,
        inputData: options?.inputData,
      },
    });

    if (error) throw error;
    return { success: true, task: data.task };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

// Run the worker engine manually
export async function runWorkerEngine(): Promise<{ success: boolean; results?: any[]; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('ai-worker-engine', {
      body: { mode: 'process' },
    });

    if (error) throw error;
    return { success: true, results: data.results };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

// Get workforce statistics
export async function getWorkforceStats(): Promise<WorkforceStats> {
  const today = new Date().toISOString().split('T')[0];

  const [workersResult, tasksResult, todayTasksResult] = await Promise.all([
    supabase.from('ai_workers').select('status'),
    supabase.from('ai_work_tasks').select('status'),
    supabase.from('ai_work_tasks').select('id').gte('created_at', today),
  ]);

  const workers = workersResult.data || [];
  const tasks = tasksResult.data || [];

  return {
    total_workers: workers.length,
    active_workers: workers.filter(w => w.status === 'active').length,
    busy_workers: workers.filter(w => w.status === 'busy').length,
    total_tasks: tasks.length,
    pending_tasks: tasks.filter(t => t.status === 'pending').length,
    completed_tasks: tasks.filter(t => t.status === 'completed').length,
    failed_tasks: tasks.filter(t => t.status === 'failed').length,
    tasks_today: todayTasksResult.data?.length || 0,
  };
}

// Update task status
export async function updateTaskStatus(
  taskId: string, 
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'escalated'
): Promise<void> {
  const updates: Record<string, any> = { status };
  
  if (status === 'completed' || status === 'failed') {
    updates.completed_at = new Date().toISOString();
  }
  if (status === 'processing') {
    updates.started_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('ai_work_tasks')
    .update(updates)
    .eq('id', taskId);

  if (error) throw error;
}

// Delete a task
export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await supabase
    .from('ai_work_tasks')
    .delete()
    .eq('id', taskId);

  if (error) throw error;
}

// Get task by ID
export async function getTask(taskId: string): Promise<AIWorkTask | null> {
  const { data, error } = await supabase
    .from('ai_work_tasks')
    .select('*, worker:ai_workers(*)')
    .eq('id', taskId)
    .single();

  if (error) return null;
  return data as AIWorkTask;
}

// Get department list
export function getDepartments(): string[] {
  return [
    'Sales/CRM',
    'Operations', 
    'Wholesale',
    'Finance',
    'Intelligence',
    'Global OS',
  ];
}
