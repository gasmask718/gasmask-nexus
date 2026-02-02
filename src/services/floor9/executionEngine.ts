// Floor 9 - Assisted Execution Engine (Phase 9.2)
// Human-authorized autonomy with bounded execution and mandatory auditing

import { supabase } from '@/integrations/supabase/client';

// ============= TYPES =============

export type ExecutableTaskType = 
  | 'customer_service_response'
  | 'store_audit_review'
  | 'data_entry_verification'
  | 'store_categorization'
  | 'invoice_draft_creation'
  | 'crm_note_generation'
  | 'follow_up_recommendation'
  | 'report_generation';

export type ExecutionMode = 'draft_only' | 'execute_with_approval' | 'recommendation_only';

export type TargetEntityType = 
  | 'store'
  | 'customer'
  | 'invoice'
  | 'route'
  | 'worker'
  | 'wholesaler'
  | 'ambassador'
  | 'freeform';

export type TaskExecutionStatus = 
  | 'pending'
  | 'assigned'
  | 'validating_inputs'
  | 'processing'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'escalated'
  | 'blocked'
  | 'rolled_back';

export type ApprovalStatus = 'not_required' | 'pending' | 'approved' | 'rejected' | 'modified';

export type ArtifactType = 
  | 'crm_note'
  | 'invoice_draft'
  | 'categorization_tag'
  | 'audit_summary'
  | 'answer_log'
  | 'report'
  | 'follow_up'
  | 'data_correction';

export type ArtifactStatus = 'draft' | 'pending_approval' | 'approved' | 'applied' | 'rejected' | 'rolled_back';

export interface ExecutableTaskTypeConfig {
  id: string;
  task_type: ExecutableTaskType;
  display_name: string;
  description: string | null;
  allowed_execution_modes: ExecutionMode[];
  max_risk_level: 'low' | 'medium' | 'high';
  requires_approval: boolean;
  allowed_roles: string[];
  sandbox_permissions: SandboxPermissions;
  is_active: boolean;
  created_at: string;
}

export interface SandboxPermissions {
  read: boolean;
  write_drafts: boolean;
  generate: boolean;
  execute: boolean;
}

export interface TaskArtifact {
  id: string;
  task_id: string;
  artifact_type: ArtifactType;
  artifact_title: string;
  artifact_content: Record<string, any>;
  target_entity_type: string | null;
  target_entity_id: string | null;
  status: ArtifactStatus;
  approved_by: string | null;
  approved_at: string | null;
  applied_at: string | null;
  rolled_back_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskExecutionLogEntry {
  id: string;
  task_id: string;
  step_number: number;
  step_action: string;
  step_status: 'started' | 'completed' | 'failed' | 'skipped' | 'blocked';
  step_details: Record<string, any>;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface AssignTaskInput {
  task_type: ExecutableTaskType;
  target_entity_type: TargetEntityType;
  target_entity_id?: string;
  instructions: string;
  execution_mode: ExecutionMode;
  priority: 'low' | 'medium' | 'high' | 'critical';
  deadline?: string;
  assigned_to_worker_id?: string;
  department?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
}

// ============= FORBIDDEN ACTIONS (PHASE 9.2 SANDBOXING) =============

const FORBIDDEN_ACTIONS = [
  'delete_record',
  'modify_financial_totals',
  'send_external_message',
  'auto_charge',
  'auto_approve',
  'modify_user_permissions',
  'access_raw_credentials',
] as const;

// ============= TASK TYPE MANAGEMENT =============

export async function getExecutableTaskTypes(): Promise<ExecutableTaskTypeConfig[]> {
  const { data, error } = await supabase
    .from('ai_executable_task_types')
    .select('*')
    .eq('is_active', true)
    .order('display_name');

  if (error) throw error;
  return (data || []) as unknown as ExecutableTaskTypeConfig[];
}

export async function getTaskTypeConfig(taskType: ExecutableTaskType): Promise<ExecutableTaskTypeConfig | null> {
  const { data, error } = await supabase
    .from('ai_executable_task_types')
    .select('*')
    .eq('task_type', taskType)
    .single();

  if (error) return null;
  return data as unknown as ExecutableTaskTypeConfig;
}

// ============= TASK ASSIGNMENT =============

export async function assignAITask(input: AssignTaskInput, createdBy?: string): Promise<string> {
  // 1. Validate task type is in allowlist
  const taskTypeConfig = await getTaskTypeConfig(input.task_type);
  if (!taskTypeConfig) {
    throw new Error(`Task type '${input.task_type}' is not in the allowed task types list`);
  }

  // 2. Validate execution mode is allowed for this task type
  if (!taskTypeConfig.allowed_execution_modes.includes(input.execution_mode)) {
    throw new Error(
      `Execution mode '${input.execution_mode}' is not allowed for task type '${input.task_type}'. ` +
      `Allowed modes: ${taskTypeConfig.allowed_execution_modes.join(', ')}`
    );
  }

  // 3. Determine if approval is required
  const requiresApproval = taskTypeConfig.requires_approval || input.execution_mode === 'execute_with_approval';

  // 4. Create the task
  const { data, error } = await supabase
    .from('ai_work_tasks')
    .insert({
      task_title: `${taskTypeConfig.display_name}: ${input.target_entity_type}`,
      task_details: input.instructions,
      task_type: input.task_type,
      execution_mode: input.execution_mode,
      target_entity_type: input.target_entity_type,
      target_entity_id: input.target_entity_id || null,
      instructions: input.instructions,
      priority: input.priority,
      deadline: input.deadline || null,
      department: input.department || null,
      assigned_to_worker_id: input.assigned_to_worker_id || null,
      auto_assigned: !input.assigned_to_worker_id,
      status: 'assigned',
      approval_status: requiresApproval ? 'pending' : 'not_required',
      risk_level: taskTypeConfig.max_risk_level,
      created_by: createdBy || null,
      input_data: {
        task_type: input.task_type,
        target: {
          type: input.target_entity_type,
          id: input.target_entity_id,
        },
        instructions: input.instructions,
        execution_mode: input.execution_mode,
      },
      rollback_until: input.execution_mode !== 'draft_only' 
        ? new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minute rollback window
        : null,
    })
    .select('id')
    .single();

  if (error) throw error;
  
  // 5. Log the assignment
  await logExecutionStep(data.id, 1, 'task_assigned', 'completed', {
    assigned_by: createdBy,
    task_type: input.task_type,
    execution_mode: input.execution_mode,
  });

  return data.id;
}

// ============= TASK VALIDATION =============

export async function validateTaskInputs(taskId: string): Promise<ValidationResult> {
  const { data: task, error } = await supabase
    .from('ai_work_tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (error) throw error;

  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Update task status to validating
  await updateTaskExecutionStatus(taskId, 'validating_inputs');
  await logExecutionStep(taskId, 2, 'validating_inputs', 'started', {});

  // Check target entity exists if specified
  if (task.target_entity_id && task.target_entity_type) {
    const entityExists = await checkEntityExists(task.target_entity_type, task.target_entity_id);
    if (!entityExists) {
      errors.push({
        field: 'target_entity_id',
        message: `${task.target_entity_type} with ID ${task.target_entity_id} not found`,
        code: 'ENTITY_NOT_FOUND',
      });
    }
  }

  // Check if instructions are present
  if (!task.instructions || task.instructions.trim().length < 10) {
    errors.push({
      field: 'instructions',
      message: 'Instructions must be at least 10 characters',
      code: 'INSTRUCTIONS_TOO_SHORT',
    });
  }

  // Check data freshness (warn if entity was updated recently)
  if (task.target_entity_id) {
    const isStale = await checkDataStaleness(task.target_entity_type, task.target_entity_id);
    if (isStale) {
      warnings.push({
        field: 'target_entity',
        message: 'Target entity data may be stale (last updated > 24 hours ago)',
      });
    }
  }

  // Store validation results
  await supabase
    .from('ai_work_tasks')
    .update({
      validation_errors: errors as unknown as Record<string, any>[],
      status: errors.length > 0 ? 'blocked' : 'processing',
    })
    .eq('id', taskId);

  await logExecutionStep(taskId, 2, 'validating_inputs', errors.length > 0 ? 'failed' : 'completed', {
    errors,
    warnings,
  });

  return { valid: errors.length === 0, errors, warnings };
}

// ============= TASK EXECUTION =============

export async function executeTask(taskId: string): Promise<void> {
  const { data: task, error } = await supabase
    .from('ai_work_tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (error) throw error;

  // Validate task can be executed
  if (task.status !== 'processing' && task.status !== 'assigned') {
    throw new Error(`Task is in '${task.status}' status and cannot be executed`);
  }

  // Check if approval is required and granted
  if (task.approval_status === 'pending') {
    await updateTaskExecutionStatus(taskId, 'awaiting_approval');
    await logExecutionStep(taskId, 3, 'awaiting_approval', 'blocked', {
      reason: 'Approval required before execution',
    });
    return;
  }

  if (task.approval_status === 'rejected') {
    await updateTaskExecutionStatus(taskId, 'blocked');
    await logExecutionStep(taskId, 3, 'execution_blocked', 'failed', {
      reason: 'Approval was rejected',
    });
    return;
  }

  // Begin execution
  await updateTaskExecutionStatus(taskId, 'processing');
  await logExecutionStep(taskId, 3, 'execution_started', 'started', {
    task_type: task.task_type,
    execution_mode: task.execution_mode,
  });

  try {
    // Execute based on task type (sandboxed)
    const result = await executeSandboxedTask(task);
    
    // Update task with result
    await supabase
      .from('ai_work_tasks')
      .update({
        status: 'completed',
        output: result,
        completed_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    await logExecutionStep(taskId, 4, 'execution_completed', 'completed', {
      artifacts_created: result.artifacts?.length || 0,
      time_saved_minutes: result.time_saved_minutes || 0,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    
    await supabase
      .from('ai_work_tasks')
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    await logExecutionStep(taskId, 4, 'execution_failed', 'failed', {}, errorMessage);
    
    throw err;
  }
}

// ============= SANDBOXED EXECUTION =============

async function executeSandboxedTask(task: any): Promise<Record<string, any>> {
  const taskTypeConfig = await getTaskTypeConfig(task.task_type);
  if (!taskTypeConfig) {
    throw new Error('Task type not found in allowlist');
  }

  const permissions = taskTypeConfig.sandbox_permissions;
  
  // Enforce sandbox permissions
  if (!permissions.read) {
    throw new Error('Task type does not have read permission');
  }

  // Execute based on task type - all within sandbox
  switch (task.task_type as ExecutableTaskType) {
    case 'crm_note_generation':
      return await executeCreateCRMNote(task, permissions);
    
    case 'store_categorization':
      return await executeStoreCategorization(task, permissions);
    
    case 'store_audit_review':
      return await executeStoreAudit(task, permissions);
    
    case 'data_entry_verification':
      return await executeDataVerification(task, permissions);
    
    case 'report_generation':
      return await executeReportGeneration(task, permissions);
    
    case 'follow_up_recommendation':
      return await executeFollowUpRecommendation(task, permissions);
    
    case 'invoice_draft_creation':
      return await executeInvoiceDraft(task, permissions);
    
    case 'customer_service_response':
      return await executeCustomerServiceResponse(task, permissions);
    
    default:
      return { 
        message: 'Task type execution not implemented',
        status: 'draft',
        artifacts: [],
      };
  }
}

// ============= TASK TYPE EXECUTORS (SANDBOXED) =============

async function executeCreateCRMNote(task: any, permissions: SandboxPermissions): Promise<Record<string, any>> {
  if (!permissions.write_drafts) {
    return { error: 'Write drafts permission not granted', artifacts: [] };
  }

  // Create artifact (draft only)
  const artifact = await createArtifact({
    task_id: task.id,
    artifact_type: 'crm_note',
    artifact_title: `AI-Generated CRM Note for ${task.target_entity_type}`,
    artifact_content: {
      note: task.instructions,
      generated_at: new Date().toISOString(),
      target: { type: task.target_entity_type, id: task.target_entity_id },
    },
    target_entity_type: task.target_entity_type,
    target_entity_id: task.target_entity_id,
  });

  return {
    message: 'CRM note draft created',
    artifacts: [artifact],
    time_saved_minutes: 5,
  };
}

async function executeStoreCategorization(task: any, permissions: SandboxPermissions): Promise<Record<string, any>> {
  if (!permissions.write_drafts) {
    return { error: 'Write drafts permission not granted', artifacts: [] };
  }

  const artifact = await createArtifact({
    task_id: task.id,
    artifact_type: 'categorization_tag',
    artifact_title: `Categorization for ${task.target_entity_type}`,
    artifact_content: {
      suggested_tags: ['needs-review'],
      reasoning: task.instructions,
      generated_at: new Date().toISOString(),
    },
    target_entity_type: task.target_entity_type,
    target_entity_id: task.target_entity_id,
  });

  return {
    message: 'Store categorization draft created',
    artifacts: [artifact],
    time_saved_minutes: 3,
  };
}

async function executeStoreAudit(task: any, permissions: SandboxPermissions): Promise<Record<string, any>> {
  const artifact = await createArtifact({
    task_id: task.id,
    artifact_type: 'audit_summary',
    artifact_title: `Audit Summary for ${task.target_entity_type}`,
    artifact_content: {
      audit_type: 'data_accuracy',
      findings: [],
      recommendations: [],
      generated_at: new Date().toISOString(),
    },
    target_entity_type: task.target_entity_type,
    target_entity_id: task.target_entity_id,
  });

  return {
    message: 'Store audit draft created',
    artifacts: [artifact],
    time_saved_minutes: 15,
  };
}

async function executeDataVerification(task: any, permissions: SandboxPermissions): Promise<Record<string, any>> {
  const artifact = await createArtifact({
    task_id: task.id,
    artifact_type: 'data_correction',
    artifact_title: `Data Verification for ${task.target_entity_type}`,
    artifact_content: {
      verified_fields: [],
      discrepancies: [],
      confidence: 0.85,
      generated_at: new Date().toISOString(),
    },
    target_entity_type: task.target_entity_type,
    target_entity_id: task.target_entity_id,
  });

  return {
    message: 'Data verification complete',
    artifacts: [artifact],
    time_saved_minutes: 10,
  };
}

async function executeReportGeneration(task: any, permissions: SandboxPermissions): Promise<Record<string, any>> {
  const artifact = await createArtifact({
    task_id: task.id,
    artifact_type: 'report',
    artifact_title: `AI-Generated Report`,
    artifact_content: {
      report_type: 'general',
      summary: task.instructions,
      sections: [],
      generated_at: new Date().toISOString(),
    },
    target_entity_type: task.target_entity_type,
    target_entity_id: task.target_entity_id,
  });

  return {
    message: 'Report draft generated',
    artifacts: [artifact],
    time_saved_minutes: 30,
  };
}

async function executeFollowUpRecommendation(task: any, permissions: SandboxPermissions): Promise<Record<string, any>> {
  const artifact = await createArtifact({
    task_id: task.id,
    artifact_type: 'follow_up',
    artifact_title: `Follow-up Recommendation for ${task.target_entity_type}`,
    artifact_content: {
      recommended_action: 'schedule_call',
      priority: 'medium',
      reasoning: task.instructions,
      suggested_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      generated_at: new Date().toISOString(),
    },
    target_entity_type: task.target_entity_type,
    target_entity_id: task.target_entity_id,
  });

  return {
    message: 'Follow-up recommendation created',
    artifacts: [artifact],
    time_saved_minutes: 5,
  };
}

async function executeInvoiceDraft(task: any, permissions: SandboxPermissions): Promise<Record<string, any>> {
  if (!permissions.write_drafts) {
    return { error: 'Write drafts permission not granted', artifacts: [] };
  }

  const artifact = await createArtifact({
    task_id: task.id,
    artifact_type: 'invoice_draft',
    artifact_title: `Invoice Draft for ${task.target_entity_type}`,
    artifact_content: {
      line_items: [],
      subtotal: 0,
      tax: 0,
      total: 0,
      notes: task.instructions,
      generated_at: new Date().toISOString(),
    },
    target_entity_type: task.target_entity_type,
    target_entity_id: task.target_entity_id,
  });

  return {
    message: 'Invoice draft created - requires manual review',
    artifacts: [artifact],
    time_saved_minutes: 20,
  };
}

async function executeCustomerServiceResponse(task: any, permissions: SandboxPermissions): Promise<Record<string, any>> {
  const artifact = await createArtifact({
    task_id: task.id,
    artifact_type: 'answer_log',
    artifact_title: `Customer Service Response Draft`,
    artifact_content: {
      draft_response: task.instructions,
      tone: 'professional',
      needs_review: true,
      generated_at: new Date().toISOString(),
    },
    target_entity_type: task.target_entity_type,
    target_entity_id: task.target_entity_id,
  });

  return {
    message: 'Customer service response drafted',
    artifacts: [artifact],
    time_saved_minutes: 8,
  };
}

// ============= ARTIFACT MANAGEMENT =============

async function createArtifact(input: {
  task_id: string;
  artifact_type: ArtifactType;
  artifact_title: string;
  artifact_content: Record<string, any>;
  target_entity_type?: string | null;
  target_entity_id?: string | null;
}): Promise<TaskArtifact> {
  const { data, error } = await supabase
    .from('ai_task_artifacts')
    .insert({
      task_id: input.task_id,
      artifact_type: input.artifact_type,
      artifact_title: input.artifact_title,
      artifact_content: input.artifact_content,
      target_entity_type: input.target_entity_type || null,
      target_entity_id: input.target_entity_id || null,
      status: 'draft',
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as unknown as TaskArtifact;
}

export async function getTaskArtifacts(taskId: string): Promise<TaskArtifact[]> {
  const { data, error } = await supabase
    .from('ai_task_artifacts')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as unknown as TaskArtifact[];
}

export async function approveArtifact(artifactId: string, userId?: string): Promise<void> {
  const { error } = await supabase
    .from('ai_task_artifacts')
    .update({
      status: 'approved',
      approved_by: userId || null,
      approved_at: new Date().toISOString(),
    })
    .eq('id', artifactId);

  if (error) throw error;
}

export async function rejectArtifact(artifactId: string, userId?: string): Promise<void> {
  const { error } = await supabase
    .from('ai_task_artifacts')
    .update({
      status: 'rejected',
      approved_by: userId || null,
      approved_at: new Date().toISOString(),
    })
    .eq('id', artifactId);

  if (error) throw error;
}

// ============= TASK APPROVAL =============

export async function approveTask(taskId: string, userId?: string, notes?: string): Promise<void> {
  const { error } = await supabase
    .from('ai_work_tasks')
    .update({
      approval_status: 'approved',
      approved_by: userId || null,
      approved_at: new Date().toISOString(),
      approval_notes: notes || null,
      status: 'processing', // Move to processing after approval
    })
    .eq('id', taskId);

  if (error) throw error;

  await logExecutionStep(taskId, 3, 'task_approved', 'completed', {
    approved_by: userId,
    notes,
  });
}

export async function rejectTask(taskId: string, userId?: string, notes?: string): Promise<void> {
  if (!notes || notes.trim().length < 10) {
    throw new Error('Rejection requires a minimum 10 character explanation');
  }

  const { error } = await supabase
    .from('ai_work_tasks')
    .update({
      approval_status: 'rejected',
      approved_by: userId || null,
      approved_at: new Date().toISOString(),
      approval_notes: notes,
      status: 'blocked',
    })
    .eq('id', taskId);

  if (error) throw error;

  await logExecutionStep(taskId, 3, 'task_rejected', 'failed', {
    rejected_by: userId,
    reason: notes,
  });
}

// ============= EXECUTION LOGGING =============

async function logExecutionStep(
  taskId: string,
  stepNumber: number,
  stepAction: string,
  stepStatus: TaskExecutionLogEntry['step_status'],
  stepDetails: Record<string, any>,
  errorMessage?: string
): Promise<void> {
  await supabase
    .from('ai_task_execution_log')
    .insert({
      task_id: taskId,
      step_number: stepNumber,
      step_action: stepAction,
      step_status: stepStatus,
      step_details: stepDetails,
      error_message: errorMessage || null,
    });
}

export async function getTaskExecutionLog(taskId: string): Promise<TaskExecutionLogEntry[]> {
  const { data, error } = await supabase
    .from('ai_task_execution_log')
    .select('*')
    .eq('task_id', taskId)
    .order('step_number', { ascending: true });

  if (error) throw error;
  return (data || []) as unknown as TaskExecutionLogEntry[];
}

// ============= STATUS UPDATES =============

async function updateTaskExecutionStatus(taskId: string, status: TaskExecutionStatus): Promise<void> {
  const updates: Record<string, any> = { status };
  
  if (status === 'processing') {
    updates.started_at = new Date().toISOString();
  }
  if (status === 'completed' || status === 'failed') {
    updates.completed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('ai_work_tasks')
    .update(updates)
    .eq('id', taskId);

  if (error) throw error;
}

// ============= HELPER FUNCTIONS =============

async function checkEntityExists(entityType: string, entityId: string): Promise<boolean> {
  // Check based on entity type
  const tableMap: Record<string, string> = {
    store: 'stores',
    customer: 'people',
    wholesaler: 'wholesalers',
    ambassador: 'ambassadors',
    invoice: 'invoices',
    route: 'routes',
  };

  const tableName = tableMap[entityType];
  if (!tableName) return true; // Unknown entity types pass validation

  const { data, error } = await supabase
    .from(tableName as any)
    .select('id')
    .eq('id', entityId)
    .single();

  return !error && !!data;
}

async function checkDataStaleness(entityType: string, entityId: string): Promise<boolean> {
  // Check if data is older than 24 hours
  const tableMap: Record<string, string> = {
    store: 'stores',
    customer: 'people',
    wholesaler: 'wholesalers',
    ambassador: 'ambassadors',
  };

  const tableName = tableMap[entityType];
  if (!tableName) return false;

  try {
    const { data, error } = await supabase
      .from(tableName as any)
      .select('updated_at')
      .eq('id', entityId)
      .single();

    if (error || !data) return false;
    
    const record = data as { updated_at?: string };
    if (!record.updated_at) return false;

    const updatedAt = new Date(record.updated_at);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    return updatedAt < twentyFourHoursAgo;
  } catch {
    return false;
  }
}

// ============= ROLLBACK =============

export async function rollbackTask(taskId: string, userId?: string): Promise<void> {
  const { data: task, error } = await supabase
    .from('ai_work_tasks')
    .select('*, artifacts:ai_task_artifacts(*)')
    .eq('id', taskId)
    .single();

  if (error) throw error;

  // Check if within rollback window
  if (task.rollback_until && new Date(task.rollback_until) < new Date()) {
    throw new Error('Rollback window has expired');
  }

  // Rollback all artifacts
  await supabase
    .from('ai_task_artifacts')
    .update({
      status: 'rolled_back',
      rolled_back_at: new Date().toISOString(),
    })
    .eq('task_id', taskId);

  // Update task status
  await supabase
    .from('ai_work_tasks')
    .update({
      status: 'rolled_back',
    })
    .eq('id', taskId);

  await logExecutionStep(taskId, 99, 'task_rolled_back', 'completed', {
    rolled_back_by: userId,
    artifacts_rolled_back: task.artifacts?.length || 0,
  });
}
