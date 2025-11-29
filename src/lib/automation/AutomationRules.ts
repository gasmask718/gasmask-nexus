// ═══════════════════════════════════════════════════════════════════════════════
// GRABBA DEFAULT AUTOMATION RULES
// ═══════════════════════════════════════════════════════════════════════════════

import { AutomationRule, registerRule } from './AutomationEngine';

export const DEFAULT_AUTOMATION_RULES: AutomationRule[] = [
  // RULE 1 — Auto-Assign Store to Route
  {
    id: 'auto-assign-store-route',
    name: 'Auto-Assign Store to Route',
    description: 'When a new store is created, automatically assign to nearest driver route',
    trigger: 'new_store_created',
    actions: ['assign_to_route', 'send_notification'],
    isEnabled: true,
    runCount: 0,
    floorId: 'floor-4-delivery',
  },

  // RULE 2 — Auto-Follow-Up After Communication
  {
    id: 'auto-follow-up-communication',
    name: 'Auto-Follow-Up After Communication',
    description: 'Tag stores with no reply after 24 hours and add to follow-up queue',
    trigger: 'sms_sent',
    actions: ['tag_store', 'create_follow_up'],
    isEnabled: true,
    conditions: { noReplyHours: 24 },
    runCount: 0,
    floorId: 'floor-2-communication',
  },

  // RULE 3 — Auto-Low-Inventory Alert
  {
    id: 'auto-low-inventory-alert',
    name: 'Auto-Low-Inventory Alert',
    description: 'Create production task and notify warehouse when inventory is low',
    trigger: 'inventory_low',
    actions: ['create_production_task', 'send_notification', 'generate_prediction'],
    isEnabled: true,
    runCount: 0,
    floorId: 'floor-3-inventory',
  },

  // RULE 4 — Auto-Unpaid Invoice Escalation
  {
    id: 'auto-unpaid-invoice-escalation',
    name: 'Auto-Unpaid Invoice Escalation',
    description: 'Escalate overdue invoices to debt collection and auto-text store',
    trigger: 'invoice_overdue',
    actions: ['escalate_invoice', 'send_notification'],
    isEnabled: true,
    runCount: 0,
    floorId: 'floor-5-orders',
  },

  // RULE 5 — Auto-Driver Payment Reminder
  {
    id: 'auto-driver-payment-reminder',
    name: 'Auto-Driver Payment Reminder',
    description: 'Send reminder when driver payment is due',
    trigger: 'driver_payment_due',
    actions: ['send_reminder', 'send_notification'],
    isEnabled: true,
    runCount: 0,
    floorId: 'floor-5-orders',
  },

  // RULE 6 — Auto-Production Workflow
  {
    id: 'auto-production-workflow',
    name: 'Auto-Production Workflow',
    description: 'Update inventory and assign deliveries when batch is completed',
    trigger: 'production_batch_completed',
    actions: ['update_inventory', 'assign_to_route', 'send_notification'],
    isEnabled: true,
    runCount: 0,
    floorId: 'floor-6-production',
  },

  // RULE 7 — Auto-Ambassador Store Sync
  {
    id: 'auto-ambassador-store-sync',
    name: 'Auto-Ambassador Store Sync',
    description: 'Link new ambassador to region and assign top stores',
    trigger: 'new_ambassador',
    actions: ['link_ambassador', 'send_notification'],
    isEnabled: true,
    runCount: 0,
    floorId: 'floor-8-ambassadors',
  },

  // RULE 8 — Auto-Wholesale Push
  {
    id: 'auto-wholesale-push',
    name: 'Auto-Wholesale Push',
    description: 'Push new wholesale items to marketplace and notify stores',
    trigger: 'wholesale_item_uploaded',
    actions: ['push_to_marketplace', 'send_notification'],
    isEnabled: true,
    runCount: 0,
    floorId: 'floor-7-wholesale',
  },

  // RULE 9 — AI Prediction Loop
  {
    id: 'ai-prediction-loop',
    name: 'AI Prediction Loop',
    description: 'Generate next prediction after AI task completes',
    trigger: 'ai_task_completed',
    actions: ['generate_prediction'],
    isEnabled: true,
    runCount: 0,
    floorId: 'floor-9-ai',
  },

  // RULE 10 — High Activity Store Alert
  {
    id: 'store-high-activity-alert',
    name: 'High Activity Store Alert',
    description: 'Notify team when store shows high activity patterns',
    trigger: 'store_high_activity',
    actions: ['send_notification', 'create_task'],
    isEnabled: true,
    runCount: 0,
    floorId: 'floor-1-crm',
  },

  // RULE 11 — Route Over Capacity
  {
    id: 'route-over-capacity',
    name: 'Route Over Capacity Handler',
    description: 'Split route or assign additional driver when capacity exceeded',
    trigger: 'route_over_capacity',
    actions: ['assign_to_route', 'send_notification'],
    isEnabled: true,
    runCount: 0,
    floorId: 'floor-4-delivery',
  },

  // RULE 12 — Store No Response Handler
  {
    id: 'store-no-response-handler',
    name: 'Store No Response Handler',
    description: 'Escalate stores with no response after multiple attempts',
    trigger: 'store_no_response',
    actions: ['tag_store', 'escalate_invoice', 'send_notification'],
    isEnabled: false,
    runCount: 0,
    floorId: 'floor-2-communication',
  },
];

export function initializeDefaultRules(): void {
  DEFAULT_AUTOMATION_RULES.forEach((rule) => {
    registerRule(rule);
  });
  console.log(`⚡ Initialized ${DEFAULT_AUTOMATION_RULES.length} automation rules`);
}

export function getRulesByFloor(floorId: string): AutomationRule[] {
  return DEFAULT_AUTOMATION_RULES.filter((r) => r.floorId === floorId);
}

export function getRulesByTrigger(trigger: string): AutomationRule[] {
  return DEFAULT_AUTOMATION_RULES.filter((r) => r.trigger === trigger);
}
