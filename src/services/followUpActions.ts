// ═══════════════════════════════════════════════════════════════════════════════
// FOLLOW-UP ACTIONS LIBRARY — Callable actions for the automated follow-up engine
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';

export type FollowUpActionResult = {
  success: boolean;
  action: string;
  entityId?: string;
  message?: string;
  error?: string;
};

export interface FollowUpSettings {
  invoice: {
    day1_message: string;
    day5_message: string;
    day10_message: string;
    day15_message: string;
    max_reminders: number;
    escalation_after_days: number;
    auto_reminder_enabled: boolean;
  };
  store: {
    churn_threshold_days: number;
    critical_churn_days: number;
    auto_reminder_message: string;
    auto_route_enabled: boolean;
    recovery_message: string;
  };
  inventory: {
    low_stock_threshold_percent: number;
    auto_reorder_enabled: boolean;
    notify_supplier: boolean;
    reorder_lead_days: number;
  };
  driver: {
    late_threshold_minutes: number;
    missed_stop_threshold: number;
    auto_reassign_enabled: boolean;
    alert_operations: boolean;
    performance_review_days: number;
  };
  ambassador: {
    inactivity_threshold_days: number;
    critical_inactivity_days: number;
    motivational_message: string;
    weekly_tips_enabled: boolean;
    auto_reactivation_enabled: boolean;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE FOLLOW-UP ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function sendInvoiceReminder(
  invoiceId: string,
  daysOverdue: number,
  settings: FollowUpSettings['invoice']
): Promise<FollowUpActionResult> {
  try {
    let message = settings.day1_message;
    let escalationLevel = 0;

    if (daysOverdue >= 15) {
      message = settings.day15_message;
      escalationLevel = 3;
    } else if (daysOverdue >= 10) {
      message = settings.day10_message;
      escalationLevel = 2;
    } else if (daysOverdue >= 5) {
      message = settings.day5_message;
      escalationLevel = 1;
    }

    // Log to communication queue
    const client = supabase as any;
    await client.from('ai_communication_queue').insert({
      entity_type: 'invoice',
      entity_id: invoiceId,
      suggested_action: 'send_reminder',
      reason: `Invoice ${daysOverdue} days overdue - automated reminder`,
      urgency: Math.min(90, 50 + daysOverdue * 2),
      status: 'pending',
    });

    // Log follow-up action
    await logFollowUpAction({
      entityType: 'invoice',
      entityId: invoiceId,
      actionTaken: 'send_reminder',
      actionCategory: 'invoice',
      result: 'success',
      messageSent: message,
      escalated: escalationLevel >= 2,
      escalationLevel,
      nextFollowUpDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });

    return { success: true, action: 'send_reminder', entityId: invoiceId, message };
  } catch (error) {
    return { success: false, action: 'send_reminder', error: String(error) };
  }
}

export async function escalateInvoice(invoiceId: string): Promise<FollowUpActionResult> {
  try {
    const client = supabase as any;
    
    // Create escalation task
    await client.from('scheduled_tasks').insert({
      task_type: 'invoice_escalation',
      entity_type: 'invoice',
      entity_id: invoiceId,
      title: 'Escalated Invoice - Requires Attention',
      description: 'Invoice has exceeded maximum reminder attempts. Manual intervention required.',
      priority: 'high',
      status: 'pending',
    });

    await logFollowUpAction({
      entityType: 'invoice',
      entityId: invoiceId,
      actionTaken: 'escalate',
      actionCategory: 'invoice',
      result: 'escalated',
      escalated: true,
      escalationLevel: 4,
    });

    return { success: true, action: 'escalate', entityId: invoiceId };
  } catch (error) {
    return { success: false, action: 'escalate', error: String(error) };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STORE FOLLOW-UP ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function sendStoreRecoveryMessage(
  storeId: string,
  daysSinceVisit: number,
  settings: FollowUpSettings['store']
): Promise<FollowUpActionResult> {
  try {
    const message = daysSinceVisit >= settings.critical_churn_days
      ? settings.recovery_message
      : settings.auto_reminder_message;

    const client = supabase as any;
    await client.from('ai_communication_queue').insert({
      entity_type: 'store',
      entity_id: storeId,
      suggested_action: 'send_recovery',
      reason: `Store not visited in ${daysSinceVisit} days`,
      urgency: Math.min(95, 40 + daysSinceVisit * 2),
      status: 'pending',
    });

    await logFollowUpAction({
      entityType: 'store',
      entityId: storeId,
      actionTaken: 'send_recovery_message',
      actionCategory: 'store',
      result: 'success',
      messageSent: message,
      escalated: daysSinceVisit >= settings.critical_churn_days,
      nextFollowUpDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });

    return { success: true, action: 'send_recovery_message', entityId: storeId, message };
  } catch (error) {
    return { success: false, action: 'send_recovery_message', error: String(error) };
  }
}

export async function addStoreToRecoveryRoute(storeId: string): Promise<FollowUpActionResult> {
  try {
    const client = supabase as any;
    
    // Add to route planning queue
    await client.from('scheduled_tasks').insert({
      task_type: 'recovery_visit',
      entity_type: 'store',
      entity_id: storeId,
      title: 'Recovery Visit Required',
      description: 'Store flagged for recovery route - schedule visit',
      priority: 'high',
      status: 'pending',
    });

    await logFollowUpAction({
      entityType: 'store',
      entityId: storeId,
      actionTaken: 'add_to_recovery_route',
      actionCategory: 'store',
      result: 'success',
    });

    return { success: true, action: 'add_to_recovery_route', entityId: storeId };
  } catch (error) {
    return { success: false, action: 'add_to_recovery_route', error: String(error) };
  }
}

export async function createStoreCheckInTask(storeId: string): Promise<FollowUpActionResult> {
  try {
    const client = supabase as any;
    
    await client.from('scheduled_tasks').insert({
      task_type: 'store_checkin',
      entity_type: 'store',
      entity_id: storeId,
      title: 'Store Check-In Task',
      description: 'Follow up with this store - automated task',
      priority: 'medium',
      status: 'pending',
    });

    await logFollowUpAction({
      entityType: 'store',
      entityId: storeId,
      actionTaken: 'create_checkin_task',
      actionCategory: 'store',
      result: 'success',
    });

    return { success: true, action: 'create_checkin_task', entityId: storeId };
  } catch (error) {
    return { success: false, action: 'create_checkin_task', error: String(error) };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY FOLLOW-UP ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function createReorderAlert(
  itemId: string,
  itemName: string,
  currentQty: number,
  reorderPoint: number
): Promise<FollowUpActionResult> {
  try {
    const client = supabase as any;
    
    await client.from('ai_communication_queue').insert({
      entity_type: 'inventory',
      entity_id: itemId,
      suggested_action: 'reorder_alert',
      reason: `${itemName} is low (${currentQty}/${reorderPoint})`,
      urgency: currentQty === 0 ? 100 : Math.min(90, 70 + (reorderPoint - currentQty) * 5),
      status: 'pending',
    });

    await client.from('scheduled_tasks').insert({
      task_type: 'inventory_reorder',
      entity_type: 'inventory',
      entity_id: itemId,
      title: `Reorder: ${itemName}`,
      description: `Current: ${currentQty}, Reorder Point: ${reorderPoint}`,
      priority: currentQty === 0 ? 'critical' : 'high',
      status: 'pending',
    });

    await logFollowUpAction({
      entityType: 'inventory',
      entityId: itemId,
      actionTaken: 'create_reorder_alert',
      actionCategory: 'inventory',
      result: 'success',
      metadata: { currentQty, reorderPoint, itemName },
    });

    return { success: true, action: 'create_reorder_alert', entityId: itemId };
  } catch (error) {
    return { success: false, action: 'create_reorder_alert', error: String(error) };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DRIVER FOLLOW-UP ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function notifyDriverLateness(
  driverId: string,
  lateMinutes: number
): Promise<FollowUpActionResult> {
  try {
    const client = supabase as any;
    
    await client.from('ai_communication_queue').insert({
      entity_type: 'driver',
      entity_id: driverId,
      suggested_action: 'notify_lateness',
      reason: `Driver is ${lateMinutes} minutes behind schedule`,
      urgency: Math.min(85, 50 + lateMinutes),
      status: 'pending',
    });

    await logFollowUpAction({
      entityType: 'driver',
      entityId: driverId,
      actionTaken: 'notify_lateness',
      actionCategory: 'driver',
      result: 'success',
      metadata: { lateMinutes },
    });

    return { success: true, action: 'notify_lateness', entityId: driverId };
  } catch (error) {
    return { success: false, action: 'notify_lateness', error: String(error) };
  }
}

export async function alertOperationsAboutDriver(
  driverId: string,
  issue: string
): Promise<FollowUpActionResult> {
  try {
    const client = supabase as any;
    
    await client.from('ai_communication_queue').insert({
      entity_type: 'driver',
      entity_id: driverId,
      suggested_action: 'alert_operations',
      reason: `Driver issue: ${issue}`,
      urgency: 80,
      status: 'pending',
    });

    await logFollowUpAction({
      entityType: 'driver',
      entityId: driverId,
      actionTaken: 'alert_operations',
      actionCategory: 'driver',
      result: 'success',
      metadata: { issue },
    });

    return { success: true, action: 'alert_operations', entityId: driverId };
  } catch (error) {
    return { success: false, action: 'alert_operations', error: String(error) };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AMBASSADOR FOLLOW-UP ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function sendAmbassadorMotivation(
  ambassadorId: string,
  daysSinceActivity: number,
  settings: FollowUpSettings['ambassador']
): Promise<FollowUpActionResult> {
  try {
    const client = supabase as any;
    
    await client.from('ai_communication_queue').insert({
      entity_type: 'ambassador',
      entity_id: ambassadorId,
      suggested_action: 'send_motivation',
      reason: `Ambassador inactive for ${daysSinceActivity} days`,
      urgency: Math.min(70, 30 + daysSinceActivity),
      status: 'pending',
    });

    await logFollowUpAction({
      entityType: 'ambassador',
      entityId: ambassadorId,
      actionTaken: 'send_motivation',
      actionCategory: 'ambassador',
      result: 'success',
      messageSent: settings.motivational_message,
      nextFollowUpDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return { success: true, action: 'send_motivation', entityId: ambassadorId, message: settings.motivational_message };
  } catch (error) {
    return { success: false, action: 'send_motivation', error: String(error) };
  }
}

export async function createAmbassadorCheckInTask(ambassadorId: string): Promise<FollowUpActionResult> {
  try {
    const client = supabase as any;
    
    await client.from('scheduled_tasks').insert({
      task_type: 'ambassador_checkin',
      entity_type: 'ambassador',
      entity_id: ambassadorId,
      title: 'Ambassador Check-In Required',
      description: 'Follow up with inactive ambassador',
      priority: 'medium',
      status: 'pending',
    });

    await logFollowUpAction({
      entityType: 'ambassador',
      entityId: ambassadorId,
      actionTaken: 'create_checkin_task',
      actionCategory: 'ambassador',
      result: 'success',
    });

    return { success: true, action: 'create_checkin_task', entityId: ambassadorId };
  } catch (error) {
    return { success: false, action: 'create_checkin_task', error: String(error) };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: LOG FOLLOW-UP ACTION
// ═══════════════════════════════════════════════════════════════════════════════

interface LogFollowUpParams {
  entityType: string;
  entityId?: string;
  actionTaken: string;
  actionCategory: string;
  result: string;
  messageSent?: string;
  escalated?: boolean;
  escalationLevel?: number;
  nextFollowUpDate?: Date;
  metadata?: Record<string, any>;
}

export async function logFollowUpAction(params: LogFollowUpParams): Promise<void> {
  try {
    const client = supabase as any;
    await client.from('ai_follow_up_log').insert({
      entity_type: params.entityType,
      entity_id: params.entityId,
      action_taken: params.actionTaken,
      action_category: params.actionCategory,
      result: params.result,
      message_sent: params.messageSent,
      escalated: params.escalated || false,
      escalation_level: params.escalationLevel || 0,
      next_follow_up_date: params.nextFollowUpDate?.toISOString().split('T')[0],
      metadata: params.metadata || {},
    });
  } catch (error) {
    console.error('Failed to log follow-up action:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FETCH SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchFollowUpSettings(): Promise<FollowUpSettings | null> {
  try {
    const client = supabase as any;
    const { data, error } = await client
      .from('ai_follow_up_settings')
      .select('*');

    if (error || !data) return null;

    const settings: any = {};
    for (const row of data) {
      settings[row.category] = row.settings;
    }
    return settings as FollowUpSettings;
  } catch {
    return null;
  }
}

export async function updateFollowUpSettings(
  category: string,
  settings: Record<string, any>
): Promise<boolean> {
  try {
    const client = supabase as any;
    const { error } = await client
      .from('ai_follow_up_settings')
      .update({ settings, updated_at: new Date().toISOString() })
      .eq('category', category);

    return !error;
  } catch {
    return false;
  }
}
