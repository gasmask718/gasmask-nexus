// ═══════════════════════════════════════════════════════════════════════════════
// GRABBA ACTIVITY ENGINE — Centralized Event Logging System
// ═══════════════════════════════════════════════════════════════════════════════

import { GrabbaBrandId } from '@/config/grabbaSkyscraper';

export type ActivityEventType =
  // CRM Events
  | 'company_created'
  | 'store_created'
  | 'store_updated'
  | 'new_order'
  | 'new_invoice'
  | 'store_flagged'
  | 'ambassador_assigned'
  // Communication Events
  | 'sms_sent'
  | 'email_sent'
  | 'call_made'
  | 'template_created'
  // Inventory Events
  | 'inventory_added'
  | 'inventory_adjusted'
  | 'low_stock_triggered'
  // Delivery Events
  | 'delivery_created'
  | 'driver_assigned'
  | 'route_planned'
  | 'delivery_completed'
  // Finance Events
  | 'invoice_created'
  | 'invoice_paid'
  | 'unpaid_alert'
  // Production Events
  | 'batch_created'
  | 'machine_service_logged'
  // Wholesale Events
  | 'wholesale_item_uploaded'
  | 'wholesale_order_created'
  // Ambassador Events
  | 'ambassador_added'
  | 'payout_edited'
  // AI Floor Events
  | 'ai_task_started'
  | 'ai_task_completed'
  | 'prediction_generated'
  // Penthouse Events
  | 'brand_setting_changed'
  | 'global_export_run';

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  brand?: GrabbaBrandId;
  floorId: string;
  entityId?: string;
  entityType?: string;
  userId?: string;
  userName?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  description: string;
}

export const FLOOR_MAP: Record<string, string> = {
  'floor-1-crm': 'CRM',
  'floor-2-communication': 'Communication',
  'floor-3-inventory': 'Inventory',
  'floor-4-delivery': 'Delivery',
  'floor-5-orders': 'Finance',
  'floor-6-production': 'Production',
  'floor-7-wholesale': 'Wholesale',
  'floor-8-ambassadors': 'Ambassadors',
  'floor-9-ai': 'AI Operations',
  'penthouse': 'Penthouse',
};

export const EVENT_FLOOR_MAP: Record<ActivityEventType, string> = {
  // CRM
  company_created: 'floor-1-crm',
  store_created: 'floor-1-crm',
  store_updated: 'floor-1-crm',
  new_order: 'floor-1-crm',
  new_invoice: 'floor-5-orders',
  store_flagged: 'floor-1-crm',
  ambassador_assigned: 'floor-8-ambassadors',
  // Communication
  sms_sent: 'floor-2-communication',
  email_sent: 'floor-2-communication',
  call_made: 'floor-2-communication',
  template_created: 'floor-2-communication',
  // Inventory
  inventory_added: 'floor-3-inventory',
  inventory_adjusted: 'floor-3-inventory',
  low_stock_triggered: 'floor-3-inventory',
  // Delivery
  delivery_created: 'floor-4-delivery',
  driver_assigned: 'floor-4-delivery',
  route_planned: 'floor-4-delivery',
  delivery_completed: 'floor-4-delivery',
  // Finance
  invoice_created: 'floor-5-orders',
  invoice_paid: 'floor-5-orders',
  unpaid_alert: 'floor-5-orders',
  // Production
  batch_created: 'floor-6-production',
  machine_service_logged: 'floor-6-production',
  // Wholesale
  wholesale_item_uploaded: 'floor-7-wholesale',
  wholesale_order_created: 'floor-7-wholesale',
  // Ambassador
  ambassador_added: 'floor-8-ambassadors',
  payout_edited: 'floor-8-ambassadors',
  // AI
  ai_task_started: 'floor-9-ai',
  ai_task_completed: 'floor-9-ai',
  prediction_generated: 'floor-9-ai',
  // Penthouse
  brand_setting_changed: 'penthouse',
  global_export_run: 'penthouse',
};

export const EVENT_DESCRIPTIONS: Record<ActivityEventType, string> = {
  company_created: 'New company added',
  store_created: 'New store registered',
  store_updated: 'Store information updated',
  new_order: 'New order placed',
  new_invoice: 'Invoice generated',
  store_flagged: 'Store flagged for review',
  ambassador_assigned: 'Ambassador assigned to store',
  sms_sent: 'SMS message sent',
  email_sent: 'Email sent',
  call_made: 'Phone call completed',
  template_created: 'Message template created',
  inventory_added: 'Inventory added',
  inventory_adjusted: 'Inventory adjusted',
  low_stock_triggered: 'Low stock alert triggered',
  delivery_created: 'Delivery scheduled',
  driver_assigned: 'Driver assigned to route',
  route_planned: 'Route planned',
  delivery_completed: 'Delivery completed',
  invoice_created: 'Invoice created',
  invoice_paid: 'Payment received',
  unpaid_alert: 'Unpaid account alert',
  batch_created: 'Production batch created',
  machine_service_logged: 'Machine service logged',
  wholesale_item_uploaded: 'Wholesale item uploaded',
  wholesale_order_created: 'Wholesale order created',
  ambassador_added: 'New ambassador added',
  payout_edited: 'Payout adjusted',
  ai_task_started: 'AI task started',
  ai_task_completed: 'AI task completed',
  prediction_generated: 'AI prediction generated',
  brand_setting_changed: 'Brand settings updated',
  global_export_run: 'Global export executed',
};

// In-memory activity store (for demo - in production use Supabase)
let activityStore: ActivityEvent[] = [];
const MAX_EVENTS = 500;

export function createActivityEvent(
  type: ActivityEventType,
  options: {
    brand?: GrabbaBrandId;
    entityId?: string;
    entityType?: string;
    userId?: string;
    userName?: string;
    metadata?: Record<string, unknown>;
    customDescription?: string;
  } = {}
): ActivityEvent {
  const event: ActivityEvent = {
    id: crypto.randomUUID(),
    type,
    brand: options.brand,
    floorId: EVENT_FLOOR_MAP[type],
    entityId: options.entityId,
    entityType: options.entityType,
    userId: options.userId,
    userName: options.userName,
    timestamp: new Date().toISOString(),
    metadata: options.metadata,
    description: options.customDescription || EVENT_DESCRIPTIONS[type],
  };

  // Add to store
  activityStore.unshift(event);
  if (activityStore.length > MAX_EVENTS) {
    activityStore = activityStore.slice(0, MAX_EVENTS);
  }

  // Dispatch custom event for real-time updates
  window.dispatchEvent(new CustomEvent('grabba-activity', { detail: event }));

  return event;
}

export function getActivityEvents(options?: {
  floorId?: string;
  brand?: GrabbaBrandId;
  eventType?: ActivityEventType;
  limit?: number;
}): ActivityEvent[] {
  let events = [...activityStore];

  if (options?.floorId) {
    events = events.filter((e) => e.floorId === options.floorId);
  }
  if (options?.brand && options.brand !== 'all') {
    events = events.filter((e) => e.brand === options.brand);
  }
  if (options?.eventType) {
    events = events.filter((e) => e.type === options.eventType);
  }

  return events.slice(0, options?.limit || 50);
}

export function getFloorActivityCount(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const floorId of Object.keys(FLOOR_MAP)) {
    counts[floorId] = activityStore.filter((e) => e.floorId === floorId).length;
  }
  return counts;
}

// Seed some demo events
export function seedDemoActivity() {
  const brands: GrabbaBrandId[] = ['gasmask', 'hotmama', 'scalati', 'grabba'];
  const events: ActivityEventType[] = [
    'store_created',
    'new_order',
    'sms_sent',
    'delivery_completed',
    'invoice_paid',
  ];

  for (let i = 0; i < 20; i++) {
    const brand = brands[Math.floor(Math.random() * brands.length)];
    const type = events[Math.floor(Math.random() * events.length)];
    createActivityEvent(type, {
      brand,
      entityId: crypto.randomUUID(),
      userName: ['John VA', 'Sarah Manager', 'Mike Driver'][Math.floor(Math.random() * 3)],
    });
  }
}
