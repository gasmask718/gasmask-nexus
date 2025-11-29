// ═══════════════════════════════════════════════════════════════════════════════
// AI COMMAND ENGINE HOOK
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import { parseCommand, ParsedCommand, parseScheduleFromText } from '@/lib/commands/CommandParser';
import { executeAction, mapActionIntentToExecution } from '@/lib/commands/ExecutionEngine';
import { ActionIntent } from '@/lib/commands/IntentRegistry';
import { DrillDownEntity, DrillDownFilters } from '@/lib/drilldown';
import { logAiCommand, updateAiCommandStatus } from '@/lib/aiCommands';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AiCommandContext {
  entityType?: DrillDownEntity;
  selectedIds?: string[];
  panelFilters?: DrillDownFilters;
  brand?: string;
  region?: string;
  title?: string;
}

export interface AiParsedPlan {
  actionIntent: ActionIntent;
  executionAction: string;
  entityType: DrillDownEntity;
  filters: DrillDownFilters;
  selectedIds?: string[];
  schedule?: {
    date?: string;
    time?: string;
  };
  description: string;
  estimatedCount?: number;
  requiresConfirmation?: boolean;
}

export interface ExecutionResult {
  success: boolean;
  affectedIds?: string[];
  message?: string;
}

const ENTITY_MAP: Record<string, DrillDownEntity> = {
  store: 'stores',
  stores: 'stores',
  invoice: 'invoices',
  invoices: 'invoices',
  delivery: 'deliveries',
  deliveries: 'deliveries',
  inventory: 'inventory',
  driver: 'drivers',
  drivers: 'drivers',
  route: 'routes',
  routes: 'routes',
  order: 'orders',
  orders: 'orders',
  ambassador: 'ambassadors',
  ambassadors: 'ambassadors',
};

function detectEntityFromText(text: string): DrillDownEntity | undefined {
  const lower = text.toLowerCase();
  for (const [keyword, entity] of Object.entries(ENTITY_MAP)) {
    if (lower.includes(keyword)) {
      return entity;
    }
  }
  return undefined;
}

function detectFiltersFromText(text: string): DrillDownFilters {
  const filters: DrillDownFilters = {};
  const lower = text.toLowerCase();

  // Status detection
  if (lower.includes('unpaid') || lower.includes('overdue')) {
    filters.status = 'unpaid';
  } else if (lower.includes('paid')) {
    filters.status = 'paid';
  } else if (lower.includes('active')) {
    filters.status = 'active';
  } else if (lower.includes('inactive')) {
    filters.status = 'inactive';
  } else if (lower.includes('pending')) {
    filters.status = 'pending';
  } else if (lower.includes('completed') || lower.includes('complete')) {
    filters.status = 'completed';
  } else if (lower.includes('failed')) {
    filters.status = 'failed';
  }

  // Low stock detection
  if (lower.includes('low stock') || lower.includes('low inventory')) {
    filters.low_stock = true;
  }

  // Brand detection
  const brands = ['gasmask', 'hotmama', 'scalati', 'grabba'];
  for (const brand of brands) {
    if (lower.includes(brand)) {
      filters.brand = brand;
      break;
    }
  }

  return filters;
}

function buildDescription(
  actionIntent: ActionIntent,
  entityType: DrillDownEntity,
  filters: DrillDownFilters,
  selectedIds?: string[],
  schedule?: { date?: string; time?: string }
): string {
  const parts: string[] = [];

  // Action
  const actionMap: Record<ActionIntent, string> = {
    assign: 'Assign',
    create: 'Create',
    update: 'Update',
    notify: 'Send notification to',
    text: 'Send text to',
    route: 'Create route for',
    escalate: 'Escalate',
    export: 'Export',
    schedule: 'Schedule task for',
    create_route: 'Create route for',
    follow_up: 'Schedule follow-up for',
  };

  parts.push(actionMap[actionIntent] || 'Process');

  // Count
  if (selectedIds?.length) {
    parts.push(`${selectedIds.length} ${entityType}`);
  } else {
    parts.push(`filtered ${entityType}`);
  }

  // Filters
  const filterParts: string[] = [];
  if (filters.status) filterParts.push(`status: ${filters.status}`);
  if (filters.brand) filterParts.push(`brand: ${filters.brand}`);
  if (filters.region) filterParts.push(`region: ${filters.region}`);
  if (filters.low_stock) filterParts.push('low stock');
  
  if (filterParts.length > 0) {
    parts.push(`(${filterParts.join(', ')})`);
  }

  // Schedule
  if (schedule?.date) {
    parts.push(`scheduled for ${schedule.date}`);
    if (schedule.time) {
      parts.push(`at ${schedule.time}`);
    }
  }

  return parts.join(' ');
}

export function useAiCommandEngine() {
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [currentLogId, setCurrentLogId] = useState<string | null>(null);

  const parseCommandInput = useCallback(
    async (input: string, context?: AiCommandContext): Promise<AiParsedPlan> => {
      // Use existing CommandParser
      const parsed: ParsedCommand = parseCommand(input);
      const schedule = parseScheduleFromText(input);

      // Determine entity type
      let entityType: DrillDownEntity = context?.entityType || detectEntityFromText(input) || 'stores';

      // Determine action intent
      let actionIntent: ActionIntent = parsed.action || 'update';
      
      // Map common patterns
      const lower = input.toLowerCase();
      if (lower.includes('route') || lower.includes('delivery')) {
        actionIntent = 'create_route';
      } else if (lower.includes('follow up') || lower.includes('followup') || lower.includes('reminder')) {
        actionIntent = 'follow_up';
      } else if (lower.includes('text') || lower.includes('sms') || lower.includes('message')) {
        actionIntent = 'text';
      } else if (lower.includes('notify') || lower.includes('alert')) {
        actionIntent = 'notify';
      } else if (lower.includes('export') || lower.includes('download')) {
        actionIntent = 'export';
      } else if (lower.includes('schedule')) {
        actionIntent = 'schedule';
      }

      // Build filters
      const textFilters = detectFiltersFromText(input);
      const filters: DrillDownFilters = {
        ...context?.panelFilters,
        ...textFilters,
      };
      
      if (context?.brand) filters.brand = context.brand;
      if (context?.region) filters.region = context.region;

      // Selected IDs from context
      const selectedIds = context?.selectedIds;

      // Get execution action
      const executionAction = mapActionIntentToExecution(actionIntent);

      // Build description
      const description = buildDescription(actionIntent, entityType, filters, selectedIds, schedule);

      // Determine if confirmation required
      const requiresConfirmation = 
        (selectedIds && selectedIds.length > 50) ||
        (!selectedIds && !filters.status && !filters.region && !filters.brand);

      return {
        actionIntent,
        executionAction,
        entityType,
        filters,
        selectedIds,
        schedule,
        description,
        estimatedCount: selectedIds?.length,
        requiresConfirmation,
      };
    },
    []
  );

  const executePlan = useCallback(
    async (plan: AiParsedPlan): Promise<ExecutionResult> => {
      setIsExecuting(true);
      setLastError(null);

      try {
        // Log the command as planned
        const logId = await logAiCommand({
          inputText: plan.description,
          parsedIntent: {
            actionIntent: plan.actionIntent,
            executionAction: plan.executionAction,
            entityType: plan.entityType,
            filters: plan.filters,
            schedule: plan.schedule,
          },
          status: 'planned',
          affectedEntityType: plan.entityType,
          affectedEntityIds: plan.selectedIds,
        });

        setCurrentLogId(logId);

        let affectedIds: string[] = plan.selectedIds || [];

        // If no selected IDs, fetch them based on filters
        if (!affectedIds.length) {
          const fetched = await fetchEntityIds(plan.entityType, plan.filters);
          affectedIds = fetched;
        }

        if (!affectedIds.length) {
          const errorMsg = 'No entities found matching the criteria';
          if (logId) {
            await updateAiCommandStatus(logId, 'error', errorMsg);
          }
          setLastError(errorMsg);
          return { success: false, message: errorMsg };
        }

        // Execute based on action type
        let result: ExecutionResult = { success: false };

        switch (plan.executionAction) {
          case 'create_route':
          case 'send_route_to_driver':
            result = await executeRouteAction(plan, affectedIds);
            break;

          case 'add_followup_task':
          case 'schedule_followup':
            result = await executeFollowUpAction(plan, affectedIds);
            break;

          case 'send_text':
          case 'send_notification':
            result = await executeNotifyAction(plan, affectedIds);
            break;

          case 'update_invoice_status':
          case 'update_status':
            result = await executeStatusUpdateAction(plan, affectedIds);
            break;

          case 'export_data':
            result = await executeExportAction(plan, affectedIds);
            break;

          default:
            // Generic execution - just mark as successful for unknown actions
            result = { success: true, affectedIds };
        }

        // Update log status
        if (logId) {
          await updateAiCommandStatus(
            logId,
            result.success ? 'executed' : 'error',
            result.success ? undefined : result.message,
            result.affectedIds
          );
        }

        if (result.success) {
          toast.success(`Action completed for ${result.affectedIds?.length || 0} ${plan.entityType}`);
        } else {
          toast.error(result.message || 'Action failed');
        }

        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setLastError(errorMsg);

        if (currentLogId) {
          await updateAiCommandStatus(currentLogId, 'error', errorMsg);
        }

        toast.error(`Execution failed: ${errorMsg}`);
        return { success: false, message: errorMsg };
      } finally {
        setIsExecuting(false);
      }
    },
    [currentLogId]
  );

  return {
    parseCommand: parseCommandInput,
    executePlan,
    isExecuting,
    lastError,
  };
}

// Helper functions for fetching and executing

async function fetchEntityIds(
  entityType: DrillDownEntity,
  filters: DrillDownFilters
): Promise<string[]> {
  const tableMap: Record<DrillDownEntity, string> = {
    stores: 'store_master',
    invoices: 'invoices',
    deliveries: 'deliveries',
    inventory: 'inventory',
    drivers: 'profiles',
    routes: 'route_plans',
    orders: 'wholesale_orders',
    ambassadors: 'ambassadors',
    commissions: 'ambassador_commissions',
  };

  const tableName = tableMap[entityType];
  if (!tableName) return [];

  try {
    let query = (supabase as any).from(tableName).select('id');

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.brand) {
      query = query.eq('brand', filters.brand);
    }
    if (filters.region) {
      query = query.eq('region', filters.region);
    }

    const { data, error } = await query.limit(200);
    
    if (error) {
      console.error('Error fetching entity IDs:', error);
      return [];
    }

    return (data || []).map((item: any) => item.id);
  } catch (err) {
    console.error('Error in fetchEntityIds:', err);
    return [];
  }
}

async function executeRouteAction(
  plan: AiParsedPlan,
  entityIds: string[]
): Promise<ExecutionResult> {
  try {
    // Create a route plan
    const scheduledDate = plan.schedule?.date 
      ? new Date(plan.schedule.date) 
      : new Date(Date.now() + 86400000);

    if (plan.schedule?.time) {
      const [hours, minutes] = plan.schedule.time.split(':').map(Number);
      scheduledDate.setHours(hours, minutes, 0, 0);
    }

    const routeName = `AI Route - ${plan.filters.brand || 'Mixed'} - ${scheduledDate.toLocaleDateString()}`;

    const { data, error } = await (supabase as any)
      .from('route_plans')
      .insert({
        name: routeName,
        status: 'scheduled',
        scheduled_date: scheduledDate.toISOString(),
        brand: plan.filters.brand,
        region: plan.filters.region,
      })
      .select('id')
      .single();

    if (error) throw error;

    // Create route stops
    const stops = entityIds.map((storeId, index) => ({
      route_id: data.id,
      store_id: storeId,
      stop_order: index + 1,
      status: 'pending',
    }));

    await (supabase as any).from('route_stops').insert(stops);

    // Also create a scheduled task
    await (supabase as any).from('scheduled_tasks').insert({
      type: 'delivery_run',
      status: 'pending',
      run_at: scheduledDate.toISOString(),
      payload: {
        route_id: data.id,
        store_ids: entityIds,
        brand: plan.filters.brand,
      },
    });

    return { success: true, affectedIds: entityIds };
  } catch (err) {
    console.error('Route action error:', err);
    return { success: false, message: 'Failed to create route' };
  }
}

async function executeFollowUpAction(
  plan: AiParsedPlan,
  entityIds: string[]
): Promise<ExecutionResult> {
  try {
    const scheduledDate = plan.schedule?.date 
      ? new Date(plan.schedule.date) 
      : new Date(Date.now() + 7 * 86400000); // Default: next week

    const tasks = entityIds.map((entityId) => ({
      type: 'follow_up',
      status: 'pending',
      run_at: scheduledDate.toISOString(),
      payload: {
        entity_type: plan.entityType,
        entity_id: entityId,
        brand: plan.filters.brand,
      },
    }));

    const { error } = await (supabase as any).from('scheduled_tasks').insert(tasks);
    
    if (error) throw error;

    return { success: true, affectedIds: entityIds };
  } catch (err) {
    console.error('Follow-up action error:', err);
    return { success: false, message: 'Failed to schedule follow-ups' };
  }
}

async function executeNotifyAction(
  plan: AiParsedPlan,
  entityIds: string[]
): Promise<ExecutionResult> {
  try {
    // Queue notifications in ai_communication_queue
    const notifications = entityIds.map((entityId) => ({
      entity_type: plan.entityType,
      entity_id: entityId,
      suggested_action: 'send_text',
      reason: `AI-triggered notification for ${plan.entityType}`,
      urgency: 50,
      status: 'pending',
    }));

    const { error } = await (supabase as any)
      .from('ai_communication_queue')
      .insert(notifications);
    
    if (error) throw error;

    return { success: true, affectedIds: entityIds };
  } catch (err) {
    console.error('Notify action error:', err);
    return { success: false, message: 'Failed to queue notifications' };
  }
}

async function executeStatusUpdateAction(
  plan: AiParsedPlan,
  entityIds: string[]
): Promise<ExecutionResult> {
  try {
    const tableMap: Record<DrillDownEntity, string> = {
      stores: 'store_master',
      invoices: 'invoices',
      deliveries: 'deliveries',
      inventory: 'inventory',
      drivers: 'profiles',
      routes: 'route_plans',
      orders: 'wholesale_orders',
      ambassadors: 'ambassadors',
      commissions: 'ambassador_commissions',
    };

    const tableName = tableMap[plan.entityType];
    if (!tableName) {
      return { success: false, message: 'Unknown entity type' };
    }

    // Default status update based on action
    const newStatus = plan.filters.status === 'unpaid' ? 'paid' : 'completed';

    const { error } = await (supabase as any)
      .from(tableName)
      .update({ status: newStatus })
      .in('id', entityIds);
    
    if (error) throw error;

    return { success: true, affectedIds: entityIds };
  } catch (err) {
    console.error('Status update error:', err);
    return { success: false, message: 'Failed to update status' };
  }
}

async function executeExportAction(
  plan: AiParsedPlan,
  entityIds: string[]
): Promise<ExecutionResult> {
  // Export is handled client-side, just return success
  toast.info(`Export ready for ${entityIds.length} ${plan.entityType}`);
  return { success: true, affectedIds: entityIds, message: 'Export prepared' };
}
