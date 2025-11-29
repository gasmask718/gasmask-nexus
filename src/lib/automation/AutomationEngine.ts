// ═══════════════════════════════════════════════════════════════════════════════
// GRABBA AUTOMATION ENGINE — Cross-Floor Automation Network
// ═══════════════════════════════════════════════════════════════════════════════

import { GrabbaBrandId } from '@/config/grabbaSkyscraper';

export type AutomationTrigger =
  | 'new_store_created'
  | 'new_order_created'
  | 'inventory_low'
  | 'delivery_route_needed'
  | 'invoice_overdue'
  | 'wholesale_item_uploaded'
  | 'new_ambassador'
  | 'driver_payment_due'
  | 'high_unpaid_balance'
  | 'production_batch_completed'
  | 'communication_spike'
  | 'store_no_response'
  | 'store_high_activity'
  | 'route_over_capacity'
  | 'ai_task_completed'
  | 'sms_sent'
  | 'call_made';

export type AutomationActionType =
  | 'assign_to_route'
  | 'create_follow_up'
  | 'send_notification'
  | 'create_task'
  | 'update_inventory'
  | 'escalate_invoice'
  | 'send_reminder'
  | 'link_ambassador'
  | 'push_to_marketplace'
  | 'generate_prediction'
  | 'tag_store'
  | 'create_production_task';

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: AutomationTrigger;
  actions: AutomationActionType[];
  isEnabled: boolean;
  conditions?: Record<string, unknown>;
  lastRun?: string;
  runCount: number;
  floorId: string;
  brand?: GrabbaBrandId;
}

export interface AutomationEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  trigger: AutomationTrigger;
  actions: AutomationActionType[];
  timestamp: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
}

// In-memory automation state
let rules: Map<string, AutomationRule> = new Map();
let events: AutomationEvent[] = [];
const MAX_EVENTS = 200;

// Event listeners
type AutomationListener = (event: AutomationEvent) => void;
const listeners: Set<AutomationListener> = new Set();

export function registerRule(rule: AutomationRule): void {
  rules.set(rule.id, rule);
  console.log(`⚡ Automation rule registered: ${rule.name}`);
}

export function enableRule(id: string): boolean {
  const rule = rules.get(id);
  if (rule) {
    rule.isEnabled = true;
    rules.set(id, rule);
    return true;
  }
  return false;
}

export function disableRule(id: string): boolean {
  const rule = rules.get(id);
  if (rule) {
    rule.isEnabled = false;
    rules.set(id, rule);
    return true;
  }
  return false;
}

export function getRule(id: string): AutomationRule | undefined {
  return rules.get(id);
}

export function getAllRules(): AutomationRule[] {
  return Array.from(rules.values());
}

export function getEnabledRules(): AutomationRule[] {
  return Array.from(rules.values()).filter((r) => r.isEnabled);
}

export async function runRule(
  ruleId: string,
  payload?: Record<string, unknown>
): Promise<AutomationEvent | null> {
  const rule = rules.get(ruleId);
  if (!rule || !rule.isEnabled) return null;

  const event: AutomationEvent = {
    id: crypto.randomUUID(),
    ruleId: rule.id,
    ruleName: rule.name,
    trigger: rule.trigger,
    actions: rule.actions,
    timestamp: new Date().toISOString(),
    status: 'running',
    payload,
  };

  // Add to events
  events.unshift(event);
  if (events.length > MAX_EVENTS) {
    events = events.slice(0, MAX_EVENTS);
  }

  // Notify listeners
  listeners.forEach((listener) => listener(event));

  try {
    // Execute actions (simulated - in production would call actual services)
    await executeActions(rule.actions, payload);

    // Update event status
    event.status = 'completed';
    event.result = { success: true, actionsExecuted: rule.actions.length };

    // Update rule stats
    rule.lastRun = event.timestamp;
    rule.runCount++;
    rules.set(ruleId, rule);

    // Dispatch browser event
    window.dispatchEvent(
      new CustomEvent('grabba-automation', { detail: event })
    );

    console.log(`✅ Automation completed: ${rule.name}`);
  } catch (error) {
    event.status = 'failed';
    event.error = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Automation failed: ${rule.name}`, error);
  }

  // Notify listeners of update
  listeners.forEach((listener) => listener(event));

  return event;
}

async function executeActions(
  actions: AutomationActionType[],
  payload?: Record<string, unknown>
): Promise<void> {
  // Simulate action execution
  for (const action of actions) {
    console.log(`  → Executing action: ${action}`, payload);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

export function triggerAutomation(
  trigger: AutomationTrigger,
  payload?: Record<string, unknown>
): void {
  const matchingRules = Array.from(rules.values()).filter(
    (r) => r.trigger === trigger && r.isEnabled
  );

  matchingRules.forEach((rule) => {
    runRule(rule.id, payload);
  });
}

export function getAutomationEvents(options?: {
  ruleId?: string;
  status?: AutomationEvent['status'];
  limit?: number;
}): AutomationEvent[] {
  let filtered = [...events];

  if (options?.ruleId) {
    filtered = filtered.filter((e) => e.ruleId === options.ruleId);
  }
  if (options?.status) {
    filtered = filtered.filter((e) => e.status === options.status);
  }

  return filtered.slice(0, options?.limit || 50);
}

export function subscribeToAutomation(listener: AutomationListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAutomationStats(): {
  totalRules: number;
  enabledRules: number;
  totalEvents: number;
  completedEvents: number;
  failedEvents: number;
} {
  return {
    totalRules: rules.size,
    enabledRules: Array.from(rules.values()).filter((r) => r.isEnabled).length,
    totalEvents: events.length,
    completedEvents: events.filter((e) => e.status === 'completed').length,
    failedEvents: events.filter((e) => e.status === 'failed').length,
  };
}
