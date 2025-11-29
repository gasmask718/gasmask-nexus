// ═══════════════════════════════════════════════════════════════════════════════
// RISK ENGINE — Predictive Risk Scoring System
// ═══════════════════════════════════════════════════════════════════════════════

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type RiskType = 
  | 'churn' 
  | 'non_payment' 
  | 'low_stock' 
  | 'overworked' 
  | 'inactive_ambassador';

export interface RiskConfig {
  highChurnDays: number;
  criticalChurnDays: number;
  highUnpaidDays: number;
  criticalUnpaidDays: number;
  lowStockThreshold: number;
  overworkedRouteCount: number;
  inactiveAmbassadorDays: number;
}

export const DEFAULT_RISK_CONFIG: RiskConfig = {
  highChurnDays: 14,
  criticalChurnDays: 30,
  highUnpaidDays: 14,
  criticalUnpaidDays: 30,
  lowStockThreshold: 10,
  overworkedRouteCount: 10,
  inactiveAmbassadorDays: 30,
};

export interface RiskAssessment {
  score: number;
  level: RiskLevel;
  headline: string;
  details: string;
  recommended_action: string;
  source_data: Record<string, any>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function scoreToLevel(score: number): RiskLevel {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

export function levelToScore(level: RiskLevel): number {
  switch (level) {
    case 'critical': return 90;
    case 'high': return 70;
    case 'medium': return 50;
    case 'low': return 20;
  }
}

export function daysSince(date: Date | string | null): number {
  if (!date) return 999;
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

// ═══════════════════════════════════════════════════════════════════════════════
// STORE CHURN RISK
// ═══════════════════════════════════════════════════════════════════════════════

export interface StoreRiskInput {
  id: string;
  name: string;
  last_order_date?: string | null;
  last_visit_date?: string | null;
  total_orders?: number;
  brand?: string;
  region?: string;
}

export function scoreStoreChurnRisk(
  store: StoreRiskInput,
  config: RiskConfig = DEFAULT_RISK_CONFIG
): RiskAssessment {
  const daysSinceOrder = daysSince(store.last_order_date);
  const daysSinceVisit = daysSince(store.last_visit_date);
  
  // Score based on days since last activity
  let score = 0;
  
  if (daysSinceOrder >= config.criticalChurnDays) {
    score = 85 + Math.min(15, (daysSinceOrder - config.criticalChurnDays) / 10);
  } else if (daysSinceOrder >= config.highChurnDays) {
    score = 60 + ((daysSinceOrder - config.highChurnDays) / (config.criticalChurnDays - config.highChurnDays)) * 25;
  } else if (daysSinceOrder >= 7) {
    score = 40 + ((daysSinceOrder - 7) / (config.highChurnDays - 7)) * 20;
  } else {
    score = (daysSinceOrder / 7) * 40;
  }

  // Boost score if also no visits
  if (daysSinceVisit > 14) {
    score = Math.min(100, score + 10);
  }

  const level = scoreToLevel(score);
  
  return {
    score: Math.round(score),
    level,
    headline: `Store hasn't ordered in ${daysSinceOrder} days`,
    details: `${store.name} last ordered ${daysSinceOrder} days ago${
      daysSinceVisit < 999 ? ` and was last visited ${daysSinceVisit} days ago` : ''
    }. Total historical orders: ${store.total_orders || 0}.`,
    recommended_action: level === 'critical' 
      ? 'Urgent: Send recovery text & schedule immediate visit'
      : level === 'high'
      ? 'Send recovery text & schedule visit within 3 days'
      : 'Schedule routine check-in call',
    source_data: {
      last_order_date: store.last_order_date,
      last_visit_date: store.last_visit_date,
      days_since_order: daysSinceOrder,
      days_since_visit: daysSinceVisit,
      total_orders: store.total_orders,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE NON-PAYMENT RISK
// ═══════════════════════════════════════════════════════════════════════════════

export interface InvoiceRiskInput {
  id: string;
  invoice_number?: string;
  store_name?: string;
  amount: number;
  due_date?: string | null;
  created_at?: string;
  status?: string;
}

export function scoreInvoiceNonPaymentRisk(
  invoice: InvoiceRiskInput,
  config: RiskConfig = DEFAULT_RISK_CONFIG
): RiskAssessment {
  const daysOverdue = invoice.due_date ? daysSince(invoice.due_date) : daysSince(invoice.created_at);
  const amount = invoice.amount || 0;
  
  let score = 0;
  
  // Base score from days overdue
  if (daysOverdue >= config.criticalUnpaidDays) {
    score = 80 + Math.min(20, (daysOverdue - config.criticalUnpaidDays) / 5);
  } else if (daysOverdue >= config.highUnpaidDays) {
    score = 60 + ((daysOverdue - config.highUnpaidDays) / (config.criticalUnpaidDays - config.highUnpaidDays)) * 20;
  } else if (daysOverdue >= 7) {
    score = 40 + ((daysOverdue - 7) / (config.highUnpaidDays - 7)) * 20;
  } else if (daysOverdue > 0) {
    score = (daysOverdue / 7) * 40;
  }

  // Boost score for larger amounts
  if (amount > 1000) score = Math.min(100, score + 10);
  if (amount > 5000) score = Math.min(100, score + 10);

  const level = scoreToLevel(score);
  
  return {
    score: Math.round(score),
    level,
    headline: `Invoice ${daysOverdue} days overdue ($${amount.toLocaleString()})`,
    details: `Invoice ${invoice.invoice_number || invoice.id} for ${invoice.store_name || 'Unknown Store'} is ${daysOverdue} days past due. Amount: $${amount.toLocaleString()}.`,
    recommended_action: level === 'critical'
      ? 'Immediate follow-up required. Consider escalation or collection.'
      : level === 'high'
      ? 'Send payment reminder & schedule follow-up call'
      : 'Send friendly payment reminder',
    source_data: {
      due_date: invoice.due_date,
      days_overdue: daysOverdue,
      amount,
      invoice_number: invoice.invoice_number,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY LOW STOCK RISK
// ═══════════════════════════════════════════════════════════════════════════════

export interface InventoryRiskInput {
  id: string;
  product_name?: string;
  sku?: string;
  quantity: number;
  reorder_point?: number;
  brand?: string;
}

export function scoreInventoryLowStock(
  item: InventoryRiskInput,
  config: RiskConfig = DEFAULT_RISK_CONFIG
): RiskAssessment {
  const reorderPoint = item.reorder_point || config.lowStockThreshold;
  const quantity = item.quantity || 0;
  
  let score = 0;
  
  if (quantity <= 0) {
    score = 100; // Out of stock = critical
  } else if (quantity <= reorderPoint * 0.25) {
    score = 80 + (1 - quantity / (reorderPoint * 0.25)) * 20;
  } else if (quantity <= reorderPoint * 0.5) {
    score = 60 + ((reorderPoint * 0.5 - quantity) / (reorderPoint * 0.25)) * 20;
  } else if (quantity <= reorderPoint) {
    score = 40 + ((reorderPoint - quantity) / (reorderPoint * 0.5)) * 20;
  } else {
    score = Math.max(0, 40 - ((quantity - reorderPoint) / reorderPoint) * 40);
  }

  const level = scoreToLevel(score);
  const productName = item.product_name || item.sku || item.id;
  
  return {
    score: Math.round(score),
    level,
    headline: quantity <= 0 
      ? `${productName} is OUT OF STOCK`
      : `${productName} low: ${quantity} units (reorder at ${reorderPoint})`,
    details: `Current quantity: ${quantity}. Reorder point: ${reorderPoint}. Stock level at ${Math.round((quantity / reorderPoint) * 100)}% of minimum.`,
    recommended_action: level === 'critical'
      ? 'Urgent: Place emergency reorder immediately'
      : level === 'high'
      ? 'Place reorder within 24 hours'
      : 'Add to next scheduled reorder',
    source_data: {
      quantity,
      reorder_point: reorderPoint,
      stock_percentage: Math.round((quantity / reorderPoint) * 100),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DRIVER RELIABILITY RISK
// ═══════════════════════════════════════════════════════════════════════════════

export interface DriverRiskInput {
  id: string;
  name: string;
  routes_last_7_days?: number;
  on_time_percentage?: number;
  cancellations?: number;
  missed_stops?: number;
}

export function scoreDriverReliability(
  driver: DriverRiskInput,
  config: RiskConfig = DEFAULT_RISK_CONFIG
): RiskAssessment {
  const routes = driver.routes_last_7_days || 0;
  const onTime = driver.on_time_percentage ?? 100;
  const cancellations = driver.cancellations || 0;
  
  let score = 0;
  
  // Overworked risk
  if (routes >= config.overworkedRouteCount * 1.5) {
    score = 80;
  } else if (routes >= config.overworkedRouteCount) {
    score = 60 + ((routes - config.overworkedRouteCount) / (config.overworkedRouteCount * 0.5)) * 20;
  }

  // On-time penalty
  if (onTime < 70) score = Math.min(100, score + 20);
  else if (onTime < 85) score = Math.min(100, score + 10);

  // Cancellation penalty
  if (cancellations > 3) score = Math.min(100, score + 15);
  else if (cancellations > 0) score = Math.min(100, score + cancellations * 5);

  const level = scoreToLevel(score);
  
  return {
    score: Math.round(score),
    level,
    headline: routes >= config.overworkedRouteCount
      ? `${driver.name} may be overworked (${routes} routes/week)`
      : `${driver.name} performance: ${onTime}% on-time`,
    details: `${routes} routes in last 7 days. On-time rate: ${onTime}%. Cancellations: ${cancellations}.`,
    recommended_action: level === 'critical'
      ? 'Reassign some routes to other drivers immediately'
      : level === 'high'
      ? 'Review workload and consider redistribution'
      : 'Monitor performance metrics',
    source_data: {
      routes_last_7_days: routes,
      on_time_percentage: onTime,
      cancellations,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AMBASSADOR ACTIVITY RISK
// ═══════════════════════════════════════════════════════════════════════════════

export interface AmbassadorRiskInput {
  id: string;
  name: string;
  last_commission_date?: string | null;
  total_commissions?: number;
  orders_last_30_days?: number;
}

export function scoreAmbassadorActivity(
  ambassador: AmbassadorRiskInput,
  config: RiskConfig = DEFAULT_RISK_CONFIG
): RiskAssessment {
  const daysSinceCommission = daysSince(ambassador.last_commission_date);
  const recentOrders = ambassador.orders_last_30_days || 0;
  const totalCommissions = ambassador.total_commissions || 0;
  
  let score = 0;
  
  // Was historically active but now inactive
  if (totalCommissions > 0 && daysSinceCommission >= config.inactiveAmbassadorDays) {
    score = 70 + Math.min(30, (daysSinceCommission - config.inactiveAmbassadorDays) / 10);
  } else if (totalCommissions > 0 && daysSinceCommission >= 14) {
    score = 40 + ((daysSinceCommission - 14) / (config.inactiveAmbassadorDays - 14)) * 30;
  } else if (totalCommissions === 0 && daysSinceCommission > 7) {
    // New ambassador not performing
    score = 50;
  }

  // Recent order activity reduces risk
  if (recentOrders > 5) score = Math.max(0, score - 20);
  else if (recentOrders > 0) score = Math.max(0, score - recentOrders * 3);

  const level = scoreToLevel(score);
  
  return {
    score: Math.round(score),
    level,
    headline: daysSinceCommission >= config.inactiveAmbassadorDays
      ? `${ambassador.name} inactive for ${daysSinceCommission} days`
      : `${ambassador.name} showing reduced activity`,
    details: `Last commission: ${daysSinceCommission} days ago. Total commissions: ${totalCommissions}. Orders in last 30 days: ${recentOrders}.`,
    recommended_action: level === 'critical'
      ? 'Reach out immediately to re-engage or reassess partnership'
      : level === 'high'
      ? 'Schedule check-in call to discuss performance'
      : 'Send motivational message with tips',
    source_data: {
      last_commission_date: ambassador.last_commission_date,
      days_since_commission: daysSinceCommission,
      total_commissions: totalCommissions,
      orders_last_30_days: recentOrders,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGGREGATE RISK SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

export interface RiskSummary {
  total: number;
  byLevel: Record<RiskLevel, number>;
  byType: Record<RiskType, number>;
  critical: number;
  high: number;
}

export function computeRiskSummary(risks: Array<{ risk_level: RiskLevel; risk_type: RiskType }>): RiskSummary {
  const summary: RiskSummary = {
    total: risks.length,
    byLevel: { low: 0, medium: 0, high: 0, critical: 0 },
    byType: { churn: 0, non_payment: 0, low_stock: 0, overworked: 0, inactive_ambassador: 0 },
    critical: 0,
    high: 0,
  };

  for (const risk of risks) {
    summary.byLevel[risk.risk_level]++;
    if (risk.risk_type in summary.byType) {
      summary.byType[risk.risk_type as RiskType]++;
    }
  }

  summary.critical = summary.byLevel.critical;
  summary.high = summary.byLevel.high;

  return summary;
}
