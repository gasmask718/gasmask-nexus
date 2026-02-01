/**
 * Store Health Rules — System-defined rules for store accountability
 * These rules determine health status and SLA expectations for assigned stores
 */

export interface StoreHealthRule {
  status: 'healthy' | 'at_risk' | 'dormant';
  label: string;
  description: string;
  color: string;
  bgColor: string;
}

export interface VisitCadence {
  id: string;
  label: string;
  daysInterval: number;
  description: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STORE HEALTH RULES
// ═══════════════════════════════════════════════════════════════════════════════

export const STORE_HEALTH_RULES: Record<string, StoreHealthRule> = {
  healthy: {
    status: 'healthy',
    label: 'Healthy',
    description: 'Active orders within 14 days, recent visit within cadence',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
  at_risk: {
    status: 'at_risk',
    label: 'At Risk',
    description: 'No orders in 15-30 days OR missed visit cadence',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
  },
  dormant: {
    status: 'dormant',
    label: 'Dormant',
    description: 'No orders in 31+ days OR no visits in 30+ days',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// VISIT CADENCE OPTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const VISIT_CADENCE_OPTIONS: VisitCadence[] = [
  { id: 'weekly', label: 'Weekly', daysInterval: 7, description: 'High-priority stores' },
  { id: 'biweekly', label: 'Bi-Weekly', daysInterval: 14, description: 'Standard stores' },
  { id: 'monthly', label: 'Monthly', daysInterval: 30, description: 'Low-maintenance stores' },
];

export const DEFAULT_VISIT_CADENCE = VISIT_CADENCE_OPTIONS[1]; // bi-weekly

// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH CALCULATION LOGIC
// ═══════════════════════════════════════════════════════════════════════════════

export interface HealthCalculationInput {
  lastVisitAt?: string | null;
  lastOrderAt?: string | null;
  expectedCadenceDays?: number;
  healthStatusOverride?: string | null;
}

export interface HealthCalculationResult {
  status: 'healthy' | 'at_risk' | 'dormant';
  rule: StoreHealthRule;
  daysSinceVisit: number | null;
  daysSinceOrder: number | null;
  visitOverdue: boolean;
  visitOverdueDays: number;
  orderOverdue: boolean;
  urgencyLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
}

export function calculateStoreHealth(input: HealthCalculationInput): HealthCalculationResult {
  const now = Date.now();
  const expectedCadence = input.expectedCadenceDays || DEFAULT_VISIT_CADENCE.daysInterval;
  
  // Calculate days since last visit
  const daysSinceVisit = input.lastVisitAt 
    ? Math.floor((now - new Date(input.lastVisitAt).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  
  // Calculate days since last order
  const daysSinceOrder = input.lastOrderAt 
    ? Math.floor((now - new Date(input.lastOrderAt).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  
  // Determine if visit is overdue
  const visitOverdue = daysSinceVisit === null || daysSinceVisit > expectedCadence;
  const visitOverdueDays = daysSinceVisit === null ? expectedCadence : Math.max(0, daysSinceVisit - expectedCadence);
  
  // Determine if orders are overdue
  const orderOverdue = daysSinceOrder === null || daysSinceOrder > 14;
  
  // Use override if provided
  if (input.healthStatusOverride && STORE_HEALTH_RULES[input.healthStatusOverride]) {
    const status = input.healthStatusOverride as 'healthy' | 'at_risk' | 'dormant';
    return {
      status,
      rule: STORE_HEALTH_RULES[status],
      daysSinceVisit,
      daysSinceOrder,
      visitOverdue,
      visitOverdueDays,
      orderOverdue,
      urgencyLevel: getUrgencyLevel(status, visitOverdueDays),
    };
  }
  
  // Calculate health status based on rules
  let status: 'healthy' | 'at_risk' | 'dormant' = 'healthy';
  
  // Dormant: 31+ days since order OR 30+ days since visit
  if ((daysSinceOrder !== null && daysSinceOrder > 30) || 
      (daysSinceVisit !== null && daysSinceVisit > 30) ||
      (daysSinceVisit === null && daysSinceOrder === null)) {
    status = 'dormant';
  }
  // At Risk: 15-30 days since order OR missed visit cadence
  else if ((daysSinceOrder !== null && daysSinceOrder > 14) || visitOverdue) {
    status = 'at_risk';
  }
  
  return {
    status,
    rule: STORE_HEALTH_RULES[status],
    daysSinceVisit,
    daysSinceOrder,
    visitOverdue,
    visitOverdueDays,
    orderOverdue,
    urgencyLevel: getUrgencyLevel(status, visitOverdueDays),
  };
}

function getUrgencyLevel(status: string, overdueDays: number): 'none' | 'low' | 'medium' | 'high' | 'critical' {
  if (status === 'dormant') return 'critical';
  if (status === 'at_risk') {
    if (overdueDays > 14) return 'high';
    if (overdueDays > 7) return 'medium';
    return 'low';
  }
  return 'none';
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALERT GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface StoreAlert {
  id: string;
  type: 'at_risk' | 'missed_visit' | 'no_activity' | 'dormant';
  severity: 'warning' | 'error' | 'critical';
  title: string;
  description: string;
  storeId: string;
  storeName: string;
  actionLabel: string;
}

export interface AmbassadorAlertSummary {
  alerts: StoreAlert[];
  atRiskCount: number;
  dormantCount: number;
  missedVisitCount: number;
  noActivityCount: number;
  totalAlertCount: number;
  hasUrgentAlerts: boolean;
}

export function generateAmbassadorAlerts(
  assignedStores: Array<{
    store: { id: string; store_name: string };
    healthResult: HealthCalculationResult;
  }>
): AmbassadorAlertSummary {
  const alerts: StoreAlert[] = [];
  let atRiskCount = 0;
  let dormantCount = 0;
  let missedVisitCount = 0;
  let noActivityCount = 0;

  for (const item of assignedStores) {
    const { store, healthResult } = item;
    
    // Dormant store alert
    if (healthResult.status === 'dormant') {
      dormantCount++;
      alerts.push({
        id: `dormant-${store.id}`,
        type: 'dormant',
        severity: 'critical',
        title: 'Dormant Store',
        description: `${store.store_name} has had no activity for 30+ days`,
        storeId: store.id,
        storeName: store.store_name,
        actionLabel: 'Re-engage Now',
      });
    }
    // At-risk store alert
    else if (healthResult.status === 'at_risk') {
      atRiskCount++;
      alerts.push({
        id: `at-risk-${store.id}`,
        type: 'at_risk',
        severity: 'warning',
        title: 'Store At Risk',
        description: `${store.store_name} showing declining engagement`,
        storeId: store.id,
        storeName: store.store_name,
        actionLabel: 'Schedule Visit',
      });
    }
    
    // Missed visit cadence alert
    if (healthResult.visitOverdue && healthResult.visitOverdueDays > 0) {
      missedVisitCount++;
      if (healthResult.status !== 'dormant') {
        alerts.push({
          id: `missed-visit-${store.id}`,
          type: 'missed_visit',
          severity: 'warning',
          title: 'Missed Visit Cadence',
          description: `${store.store_name} is ${healthResult.visitOverdueDays} days overdue for a visit`,
          storeId: store.id,
          storeName: store.store_name,
          actionLabel: 'Log Visit',
        });
      }
    }
    
    // No activity (never visited + never ordered)
    if (healthResult.daysSinceVisit === null && healthResult.daysSinceOrder === null) {
      noActivityCount++;
      if (!alerts.find(a => a.storeId === store.id && a.type === 'dormant')) {
        alerts.push({
          id: `no-activity-${store.id}`,
          type: 'no_activity',
          severity: 'error',
          title: 'No Activity Recorded',
          description: `${store.store_name} has never been visited or placed an order`,
          storeId: store.id,
          storeName: store.store_name,
          actionLabel: 'Start Engagement',
        });
      }
    }
  }

  // Sort alerts by severity
  const severityOrder = { critical: 0, error: 1, warning: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    alerts,
    atRiskCount,
    dormantCount,
    missedVisitCount,
    noActivityCount,
    totalAlertCount: alerts.length,
    hasUrgentAlerts: alerts.some(a => a.severity === 'critical' || a.severity === 'error'),
  };
}
