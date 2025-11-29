// ═══════════════════════════════════════════════════════════════════════════════
// FOLLOW-UP ENGINE SERVICE — Automated monitoring and action system
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';
import {
  FollowUpSettings,
  fetchFollowUpSettings,
  sendInvoiceReminder,
  escalateInvoice,
  sendStoreRecoveryMessage,
  addStoreToRecoveryRoute,
  createStoreCheckInTask,
  createReorderAlert,
  notifyDriverLateness,
  alertOperationsAboutDriver,
  sendAmbassadorMotivation,
  createAmbassadorCheckInTask,
  logFollowUpAction,
  FollowUpActionResult,
} from './followUpActions';

export interface FollowUpEngineResult {
  success: boolean;
  timestamp: Date;
  invoicesProcessed: number;
  storesProcessed: number;
  inventoryProcessed: number;
  driversProcessed: number;
  ambassadorsProcessed: number;
  actionsTriggered: number;
  errors: string[];
}

export interface DailyBriefingContent {
  date: string;
  type: 'morning' | 'evening';
  summary: {
    newRisks: number;
    storesNeedingVisits: number;
    unpaidInvoices: number;
    lowStockItems: number;
    driverIssues: number;
    ambassadorIssues: number;
  };
  actionsTaken: {
    invoicesEmailed: number;
    storesTexted: number;
    tasksCreated: number;
    routesGenerated: number;
    ambassadorsMessaged: number;
    reorderAlertsSent: number;
  };
  escalations: Array<{
    entityType: string;
    entityId: string;
    reason: string;
    urgency: number;
  }>;
  recommendations: string[];
  tomorrowPlan?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ENGINE: RUN ALL FOLLOW-UPS
// ═══════════════════════════════════════════════════════════════════════════════

export async function runFollowUpEngine(): Promise<FollowUpEngineResult> {
  const result: FollowUpEngineResult = {
    success: true,
    timestamp: new Date(),
    invoicesProcessed: 0,
    storesProcessed: 0,
    inventoryProcessed: 0,
    driversProcessed: 0,
    ambassadorsProcessed: 0,
    actionsTriggered: 0,
    errors: [],
  };

  try {
    const settings = await fetchFollowUpSettings();
    if (!settings) {
      result.errors.push('Failed to fetch follow-up settings');
      result.success = false;
      return result;
    }

    // Process all categories in parallel
    const [invoiceResult, storeResult, inventoryResult, driverResult, ambassadorResult] = 
      await Promise.all([
        processInvoiceFollowUps(settings.invoice),
        processStoreFollowUps(settings.store),
        processInventoryFollowUps(settings.inventory),
        processDriverFollowUps(settings.driver),
        processAmbassadorFollowUps(settings.ambassador),
      ]);

    result.invoicesProcessed = invoiceResult.processed;
    result.storesProcessed = storeResult.processed;
    result.inventoryProcessed = inventoryResult.processed;
    result.driversProcessed = driverResult.processed;
    result.ambassadorsProcessed = ambassadorResult.processed;

    result.actionsTriggered = 
      invoiceResult.actions +
      storeResult.actions +
      inventoryResult.actions +
      driverResult.actions +
      ambassadorResult.actions;

    result.errors.push(...invoiceResult.errors);
    result.errors.push(...storeResult.errors);
    result.errors.push(...inventoryResult.errors);
    result.errors.push(...driverResult.errors);
    result.errors.push(...ambassadorResult.errors);

  } catch (error) {
    result.success = false;
    result.errors.push(String(error));
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE FOLLOW-UPS
// ═══════════════════════════════════════════════════════════════════════════════

async function processInvoiceFollowUps(settings: FollowUpSettings['invoice']): Promise<{ processed: number; actions: number; errors: string[] }> {
  const result = { processed: 0, actions: 0, errors: [] as string[] };

  if (!settings.auto_reminder_enabled) return result;

  try {
    const client = supabase as any;
    
    // Get overdue invoices
    const { data: invoices, error } = await client
      .from('invoices')
      .select('id, invoice_number, due_date, total_amount, status')
      .in('status', ['sent', 'overdue'])
      .order('due_date', { ascending: true });

    if (error || !invoices) {
      result.errors.push('Failed to fetch invoices');
      return result;
    }

    const today = new Date();

    for (const invoice of invoices) {
      result.processed++;
      
      const dueDate = new Date(invoice.due_date);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysOverdue <= 0) continue;

      // Check if we already sent a reminder recently
      const { data: recentLog } = await client
        .from('ai_follow_up_log')
        .select('id, created_at')
        .eq('entity_type', 'invoice')
        .eq('entity_id', invoice.id)
        .eq('action_taken', 'send_reminder')
        .gte('created_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (recentLog && recentLog.length > 0) continue;

      // Check reminder count
      const { count: reminderCount } = await client
        .from('ai_follow_up_log')
        .select('id', { count: 'exact', head: true })
        .eq('entity_type', 'invoice')
        .eq('entity_id', invoice.id)
        .eq('action_taken', 'send_reminder');

      if ((reminderCount || 0) >= settings.max_reminders) {
        // Escalate instead
        if (daysOverdue >= settings.escalation_after_days) {
          await escalateInvoice(invoice.id);
          result.actions++;
        }
      } else {
        await sendInvoiceReminder(invoice.id, daysOverdue, settings);
        result.actions++;
      }
    }
  } catch (error) {
    result.errors.push(`Invoice processing error: ${error}`);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STORE FOLLOW-UPS
// ═══════════════════════════════════════════════════════════════════════════════

async function processStoreFollowUps(settings: FollowUpSettings['store']): Promise<{ processed: number; actions: number; errors: string[] }> {
  const result = { processed: 0, actions: 0, errors: [] as string[] };

  try {
    const client = supabase as any;
    
    // Get stores with churn risk from ai_risk_insights
    const { data: riskInsights, error } = await client
      .from('ai_risk_insights')
      .select('id, entity_id, risk_score, risk_level, source_data')
      .eq('entity_type', 'store')
      .eq('risk_type', 'churn')
      .eq('status', 'open')
      .in('risk_level', ['medium', 'high', 'critical']);

    if (error || !riskInsights) {
      result.errors.push('Failed to fetch store risks');
      return result;
    }

    for (const insight of riskInsights) {
      result.processed++;
      
      const daysSinceVisit = insight.source_data?.days_since_last_order || 0;

      // Check if we already contacted this store recently
      const { data: recentLog } = await client
        .from('ai_follow_up_log')
        .select('id')
        .eq('entity_type', 'store')
        .eq('entity_id', insight.entity_id)
        .gte('created_at', new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (recentLog && recentLog.length > 0) continue;

      // Send recovery message
      await sendStoreRecoveryMessage(insight.entity_id, daysSinceVisit, settings);
      result.actions++;

      // Add to recovery route if enabled and critical
      if (settings.auto_route_enabled && insight.risk_level === 'critical') {
        await addStoreToRecoveryRoute(insight.entity_id);
        result.actions++;
      }

      // Create check-in task for high/critical
      if (insight.risk_level === 'high' || insight.risk_level === 'critical') {
        await createStoreCheckInTask(insight.entity_id);
        result.actions++;
      }
    }
  } catch (error) {
    result.errors.push(`Store processing error: ${error}`);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY FOLLOW-UPS
// ═══════════════════════════════════════════════════════════════════════════════

async function processInventoryFollowUps(settings: FollowUpSettings['inventory']): Promise<{ processed: number; actions: number; errors: string[] }> {
  const result = { processed: 0, actions: 0, errors: [] as string[] };

  try {
    const client = supabase as any;
    
    // Get low stock items from risk insights
    const { data: riskInsights, error } = await client
      .from('ai_risk_insights')
      .select('id, entity_id, headline, source_data')
      .eq('entity_type', 'inventory')
      .eq('risk_type', 'low_stock')
      .eq('status', 'open');

    if (error || !riskInsights) {
      result.errors.push('Failed to fetch inventory risks');
      return result;
    }

    for (const insight of riskInsights) {
      result.processed++;

      // Check if we already alerted for this item recently
      const { data: recentLog } = await client
        .from('ai_follow_up_log')
        .select('id')
        .eq('entity_type', 'inventory')
        .eq('entity_id', insight.entity_id)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (recentLog && recentLog.length > 0) continue;

      const currentQty = insight.source_data?.quantity || 0;
      const reorderPoint = insight.source_data?.reorder_point || 10;
      const itemName = insight.source_data?.product_name || 'Unknown Item';

      await createReorderAlert(insight.entity_id, itemName, currentQty, reorderPoint);
      result.actions++;
    }
  } catch (error) {
    result.errors.push(`Inventory processing error: ${error}`);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DRIVER FOLLOW-UPS
// ═══════════════════════════════════════════════════════════════════════════════

async function processDriverFollowUps(settings: FollowUpSettings['driver']): Promise<{ processed: number; actions: number; errors: string[] }> {
  const result = { processed: 0, actions: 0, errors: [] as string[] };

  try {
    const client = supabase as any;
    
    // Get driver risks from risk insights
    const { data: riskInsights, error } = await client
      .from('ai_risk_insights')
      .select('id, entity_id, risk_type, risk_level, headline, source_data')
      .eq('entity_type', 'driver')
      .eq('status', 'open');

    if (error || !riskInsights) {
      result.errors.push('Failed to fetch driver risks');
      return result;
    }

    for (const insight of riskInsights) {
      result.processed++;

      const lateMinutes = insight.source_data?.late_minutes || 0;

      if (lateMinutes >= settings.late_threshold_minutes) {
        await notifyDriverLateness(insight.entity_id, lateMinutes);
        result.actions++;
      }

      if (settings.alert_operations && (insight.risk_level === 'high' || insight.risk_level === 'critical')) {
        await alertOperationsAboutDriver(insight.entity_id, insight.headline);
        result.actions++;
      }
    }
  } catch (error) {
    result.errors.push(`Driver processing error: ${error}`);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AMBASSADOR FOLLOW-UPS
// ═══════════════════════════════════════════════════════════════════════════════

async function processAmbassadorFollowUps(settings: FollowUpSettings['ambassador']): Promise<{ processed: number; actions: number; errors: string[] }> {
  const result = { processed: 0, actions: 0, errors: [] as string[] };

  if (!settings.auto_reactivation_enabled) return result;

  try {
    const client = supabase as any;
    
    // Get inactive ambassador risks
    const { data: riskInsights, error } = await client
      .from('ai_risk_insights')
      .select('id, entity_id, risk_level, source_data')
      .eq('entity_type', 'ambassador')
      .eq('risk_type', 'inactive_ambassador')
      .eq('status', 'open');

    if (error || !riskInsights) {
      result.errors.push('Failed to fetch ambassador risks');
      return result;
    }

    for (const insight of riskInsights) {
      result.processed++;

      // Check if we already contacted this ambassador recently
      const { data: recentLog } = await client
        .from('ai_follow_up_log')
        .select('id')
        .eq('entity_type', 'ambassador')
        .eq('entity_id', insight.entity_id)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (recentLog && recentLog.length > 0) continue;

      const daysSinceActivity = insight.source_data?.days_since_commission || 0;

      await sendAmbassadorMotivation(insight.entity_id, daysSinceActivity, settings);
      result.actions++;

      if (insight.risk_level === 'critical') {
        await createAmbassadorCheckInTask(insight.entity_id);
        result.actions++;
      }
    }
  } catch (error) {
    result.errors.push(`Ambassador processing error: ${error}`);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DAILY BRIEFING GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

export async function generateDailyBriefing(type: 'morning' | 'evening'): Promise<DailyBriefingContent> {
  const client = supabase as any;
  const today = new Date().toISOString().split('T')[0];

  // Get risk summary
  const { data: risks } = await client
    .from('ai_risk_insights')
    .select('entity_type, risk_level, risk_type')
    .eq('status', 'open');

  // Get today's follow-up actions
  const { data: todayActions } = await client
    .from('ai_follow_up_log')
    .select('action_category, action_taken')
    .gte('created_at', `${today}T00:00:00`);

  // Get escalations
  const { data: escalations } = await client
    .from('ai_communication_queue')
    .select('entity_type, entity_id, reason, urgency')
    .eq('status', 'pending')
    .gte('urgency', 70)
    .order('urgency', { ascending: false })
    .limit(10);

  // Calculate summaries
  const riskCounts = {
    newRisks: risks?.length || 0,
    storesNeedingVisits: risks?.filter((r: any) => r.entity_type === 'store' && r.risk_type === 'churn').length || 0,
    unpaidInvoices: risks?.filter((r: any) => r.entity_type === 'invoice').length || 0,
    lowStockItems: risks?.filter((r: any) => r.risk_type === 'low_stock').length || 0,
    driverIssues: risks?.filter((r: any) => r.entity_type === 'driver').length || 0,
    ambassadorIssues: risks?.filter((r: any) => r.entity_type === 'ambassador').length || 0,
  };

  const actionCounts = {
    invoicesEmailed: todayActions?.filter((a: any) => a.action_category === 'invoice').length || 0,
    storesTexted: todayActions?.filter((a: any) => a.action_category === 'store').length || 0,
    tasksCreated: todayActions?.filter((a: any) => a.action_taken?.includes('task')).length || 0,
    routesGenerated: todayActions?.filter((a: any) => a.action_taken?.includes('route')).length || 0,
    ambassadorsMessaged: todayActions?.filter((a: any) => a.action_category === 'ambassador').length || 0,
    reorderAlertsSent: todayActions?.filter((a: any) => a.action_category === 'inventory').length || 0,
  };

  // Generate recommendations
  const recommendations: string[] = [];
  if (riskCounts.storesNeedingVisits > 10) {
    recommendations.push(`Consider creating a bulk recovery route for ${riskCounts.storesNeedingVisits} at-risk stores`);
  }
  if (riskCounts.unpaidInvoices > 5) {
    recommendations.push(`${riskCounts.unpaidInvoices} unpaid invoices need attention - consider a collections push`);
  }
  if (riskCounts.lowStockItems > 0) {
    recommendations.push(`Review ${riskCounts.lowStockItems} low-stock items for potential reorders`);
  }

  const briefing: DailyBriefingContent = {
    date: today,
    type,
    summary: riskCounts,
    actionsTaken: actionCounts,
    escalations: (escalations || []).map((e: any) => ({
      entityType: e.entity_type,
      entityId: e.entity_id,
      reason: e.reason,
      urgency: e.urgency,
    })),
    recommendations,
    tomorrowPlan: type === 'evening' ? [
      'Run morning risk scan at 8 AM',
      'Process follow-ups for high-priority items',
      'Generate optimized routes for recovery visits',
    ] : undefined,
  };

  // Save briefing
  await client.from('ai_daily_briefings').insert({
    briefing_type: type,
    briefing_date: today,
    content: briefing,
  });

  return briefing;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FETCH FOLLOW-UP STATS
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchFollowUpStats(): Promise<{
  todayActions: number;
  escalations: number;
  pending: number;
  byCategory: Record<string, number>;
}> {
  const client = supabase as any;
  const today = new Date().toISOString().split('T')[0];

  const { data: todayLogs } = await client
    .from('ai_follow_up_log')
    .select('action_category')
    .gte('created_at', `${today}T00:00:00`);

  const { count: escalationCount } = await client
    .from('ai_follow_up_log')
    .select('id', { count: 'exact', head: true })
    .eq('escalated', true)
    .gte('created_at', `${today}T00:00:00`);

  const { count: pendingCount } = await client
    .from('ai_communication_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  const byCategory: Record<string, number> = {};
  for (const log of todayLogs || []) {
    byCategory[log.action_category] = (byCategory[log.action_category] || 0) + 1;
  }

  return {
    todayActions: todayLogs?.length || 0,
    escalations: escalationCount || 0,
    pending: pendingCount || 0,
    byCategory,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FETCH RECENT FOLLOW-UP LOGS
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchRecentFollowUpLogs(limit: number = 50): Promise<any[]> {
  const client = supabase as any;
  const { data } = await client
    .from('ai_follow_up_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  return data || [];
}
