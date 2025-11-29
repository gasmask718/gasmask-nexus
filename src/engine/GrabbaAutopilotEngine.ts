// ═══════════════════════════════════════════════════════════════════════════════
// GRABBA AUTOPILOT ENGINE
// Phase 6: Task generation from Intelligence Core - Brain → Tasks
// ═══════════════════════════════════════════════════════════════════════════════

import { type GrabbaBrand } from '@/config/grabbaSkyscraper';
import type { SmartAlert, StoreRiskProfile, BrandDemandForecast, IntelligenceInsight } from './GrabbaIntelligenceCore';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type AutopilotTaskType =
  | 'restock_run'
  | 'collection_call'
  | 'store_checkin'
  | 'driver_review'
  | 'ambassador_checkin'
  | 'wholesaler_activation'
  | 'inventory_audit'
  | 'pricing_review'
  | 'promo_push'
  | 'route_optimization'
  | 'production_boost'
  | 'communication_followup';

export type AutopilotPriority = 'low' | 'medium' | 'high' | 'critical';
export type AutopilotStatus = 'pending' | 'in_progress' | 'completed' | 'dismissed';
export type AutopilotSource = 'intelligence_core' | 'daily_report' | 'manual';
export type EntityType = 'store' | 'driver' | 'ambassador' | 'wholesaler' | 'company' | 'neighborhood' | 'brand';

export interface AutopilotTask {
  id: string;
  type: AutopilotTaskType;
  floor: number; // 0 = Penthouse, 1-8 = Floors
  brand?: GrabbaBrand;
  priority: AutopilotPriority;
  title: string;
  description: string;
  entityId?: string;
  entityType?: EntityType;
  suggestedDueDate?: string;
  createdAt: string;
  source: AutopilotSource;
  playbookSlug?: string;
}

export interface GrabbaIntelligenceSnapshot {
  alerts: SmartAlert[];
  storeRisks: StoreRiskProfile[];
  brandForecasts: BrandDemandForecast[];
  insights: IntelligenceInsight[];
  topStoresToCheck: Array<{ id: string; name: string; reason: string; priority: number }>;
  bottleneck?: { isBottleneck: boolean; severity: number; recommendation: string };
  metrics: {
    overallHealth: number;
    criticalAlerts: number;
    warningAlerts: number;
    totalAlerts: number;
    lowStockCount: number;
    unpaidTotal: number;
    activeDrivers: number;
    totalDrivers: number;
    totalStores: number;
    totalAmbassadors: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FLOOR MAPPING
// ═══════════════════════════════════════════════════════════════════════════════

const TASK_TYPE_TO_FLOOR: Record<AutopilotTaskType, number> = {
  store_checkin: 1,
  communication_followup: 2,
  restock_run: 3,
  inventory_audit: 3,
  driver_review: 4,
  route_optimization: 4,
  collection_call: 5,
  pricing_review: 5,
  production_boost: 6,
  wholesaler_activation: 7,
  promo_push: 7,
  ambassador_checkin: 8,
};

const ALERT_TYPE_TO_TASK_TYPE: Record<string, AutopilotTaskType> = {
  inventory: 'restock_run',
  payment: 'collection_call',
  delivery: 'driver_review',
  ambassador: 'ambassador_checkin',
  communication: 'communication_followup',
  production: 'production_boost',
};

const SEVERITY_TO_PRIORITY: Record<string, AutopilotPriority> = {
  critical: 'critical',
  warning: 'high',
  info: 'medium',
};

// ═══════════════════════════════════════════════════════════════════════════════
// TASK ID GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function getDueDate(priority: AutopilotPriority): string {
  const now = new Date();
  switch (priority) {
    case 'critical':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(); // 1 day
    case 'high':
      return new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days
    case 'medium':
      return new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(); // 5 days
    default:
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN TASK GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

export function generateAutopilotTasks(intel: GrabbaIntelligenceSnapshot): AutopilotTask[] {
  const tasks: AutopilotTask[] = [];
  const now = new Date().toISOString();

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Generate tasks from alerts
  // ─────────────────────────────────────────────────────────────────────────────
  intel.alerts.forEach(alert => {
    const taskType = ALERT_TYPE_TO_TASK_TYPE[alert.type] || 'store_checkin';
    const priority = SEVERITY_TO_PRIORITY[alert.severity] || 'medium';
    const floor = TASK_TYPE_TO_FLOOR[taskType];

    tasks.push({
      id: generateTaskId(),
      type: taskType,
      floor,
      priority,
      title: alert.title,
      description: `${alert.message}${alert.suggestedAction ? ` Action: ${alert.suggestedAction}` : ''}`,
      entityId: alert.entityId,
      entityType: alert.entityType as EntityType,
      suggestedDueDate: getDueDate(priority),
      createdAt: now,
      source: 'intelligence_core',
      playbookSlug: getPlaybookForTaskType(taskType),
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Generate tasks from store risk profiles
  // ─────────────────────────────────────────────────────────────────────────────
  intel.storeRisks
    .filter(store => store.riskLevel === 'critical' || store.riskLevel === 'high')
    .forEach(store => {
      const priority: AutopilotPriority = store.riskLevel === 'critical' ? 'critical' : 'high';
      
      // Restock task if needed
      if (store.predictedDaysUntilRestock <= 5) {
        tasks.push({
          id: generateTaskId(),
          type: 'restock_run',
          floor: 3,
          priority,
          title: `Restock ${store.storeName}`,
          description: `Store needs restocking in ${store.predictedDaysUntilRestock} days. Current risk factors: ${store.factors.join(', ')}`,
          entityId: store.storeId,
          entityType: 'store',
          suggestedDueDate: getDueDate(priority),
          createdAt: now,
          source: 'intelligence_core',
          playbookSlug: 'restock-run',
        });
      }

      // Collection call if unpaid
      if (store.unpaidBalance > 500) {
        tasks.push({
          id: generateTaskId(),
          type: 'collection_call',
          floor: 5,
          priority: store.unpaidBalance > 2000 ? 'high' : 'medium',
          title: `Collection: ${store.storeName}`,
          description: `Unpaid balance of $${store.unpaidBalance.toLocaleString()}. ${store.lastOrderDays} days since last order.`,
          entityId: store.storeId,
          entityType: 'store',
          suggestedDueDate: getDueDate(store.unpaidBalance > 2000 ? 'high' : 'medium'),
          createdAt: now,
          source: 'intelligence_core',
          playbookSlug: 'collection-call',
        });
      }

      // Communication follow-up if gap
      if (store.communicationGap > 21) {
        tasks.push({
          id: generateTaskId(),
          type: 'communication_followup',
          floor: 2,
          priority: store.communicationGap > 45 ? 'high' : 'medium',
          title: `Contact ${store.storeName}`,
          description: `No communication for ${store.communicationGap} days. Maintain relationship.`,
          entityId: store.storeId,
          entityType: 'store',
          suggestedDueDate: getDueDate('medium'),
          createdAt: now,
          source: 'intelligence_core',
          playbookSlug: 'store-checkin',
        });
      }
    });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Generate tasks from top stores to check
  // ─────────────────────────────────────────────────────────────────────────────
  intel.topStoresToCheck.slice(0, 10).forEach(store => {
    const priority: AutopilotPriority = store.priority > 50 ? 'high' : store.priority > 25 ? 'medium' : 'low';
    
    // Check if we already have a task for this store
    const existingTask = tasks.find(t => t.entityId === store.id);
    if (!existingTask) {
      tasks.push({
        id: generateTaskId(),
        type: 'store_checkin',
        floor: 1,
        priority,
        title: `Check ${store.name}`,
        description: `Priority check required: ${store.reason}`,
        entityId: store.id,
        entityType: 'store',
        suggestedDueDate: getDueDate(priority),
        createdAt: now,
        source: 'intelligence_core',
        playbookSlug: 'store-checkin',
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Generate tasks from delivery bottleneck
  // ─────────────────────────────────────────────────────────────────────────────
  if (intel.bottleneck?.isBottleneck) {
    tasks.push({
      id: generateTaskId(),
      type: 'route_optimization',
      floor: 4,
      priority: intel.bottleneck.severity > 70 ? 'critical' : 'high',
      title: 'Delivery Bottleneck Detected',
      description: intel.bottleneck.recommendation,
      suggestedDueDate: getDueDate('high'),
      createdAt: now,
      source: 'intelligence_core',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Generate tasks from brand forecasts (declining brands)
  // ─────────────────────────────────────────────────────────────────────────────
  intel.brandForecasts
    .filter(f => f.trend === 'declining' && f.growthRate < -10)
    .forEach(forecast => {
      tasks.push({
        id: generateTaskId(),
        type: 'promo_push',
        floor: 7,
        brand: forecast.brand,
        priority: 'medium',
        title: `Boost ${forecast.brand} Sales`,
        description: `${forecast.brand} orders declined ${Math.abs(forecast.growthRate)}% this week. Consider promotional activities.`,
        entityType: 'brand',
        suggestedDueDate: getDueDate('medium'),
        createdAt: now,
        source: 'intelligence_core',
      });
    });

  // Sort by priority
  const priorityOrder: Record<AutopilotPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getPlaybookForTaskType(type: AutopilotTaskType): string | undefined {
  const mapping: Partial<Record<AutopilotTaskType, string>> = {
    restock_run: 'restock-run',
    collection_call: 'collection-call',
    store_checkin: 'store-checkin',
    ambassador_checkin: 'ambassador-review',
    driver_review: 'driver-review',
    wholesaler_activation: 'wholesaler-activation',
  };
  return mapping[type];
}

export function getFloorName(floor: number): string {
  const names: Record<number, string> = {
    0: 'Penthouse',
    1: 'CRM & Store Control',
    2: 'Communication Center',
    3: 'Inventory Engine',
    4: 'Delivery & Drivers',
    5: 'Finance & Orders',
    6: 'Production',
    7: 'Wholesale Platform',
    8: 'Ambassadors',
  };
  return names[floor] || `Floor ${floor}`;
}

export function filterTasksByFloor(tasks: AutopilotTask[], floor: number): AutopilotTask[] {
  return tasks.filter(t => t.floor === floor);
}

export function getTaskStats(tasks: AutopilotTask[]): {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  byFloor: Record<number, number>;
  mostLoadedFloor: number;
} {
  const byFloor: Record<number, number> = {};
  
  tasks.forEach(t => {
    byFloor[t.floor] = (byFloor[t.floor] || 0) + 1;
  });

  const mostLoadedFloor = Object.entries(byFloor)
    .sort(([, a], [, b]) => b - a)[0]?.[0];

  return {
    total: tasks.length,
    critical: tasks.filter(t => t.priority === 'critical').length,
    high: tasks.filter(t => t.priority === 'high').length,
    medium: tasks.filter(t => t.priority === 'medium').length,
    low: tasks.filter(t => t.priority === 'low').length,
    byFloor,
    mostLoadedFloor: parseInt(mostLoadedFloor || '0'),
  };
}
