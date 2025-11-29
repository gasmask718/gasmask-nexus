// ═══════════════════════════════════════════════════════════════════════════════
// GRABBA INTELLIGENCE CORE
// The brain of the Grabba Skyscraper - Predictive models, smart alerts, and insights
// ═══════════════════════════════════════════════════════════════════════════════

import { GRABBA_BRAND_IDS, type GrabbaBrand } from '@/config/grabbaSkyscraper';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface StoreRiskProfile {
  storeId: string;
  storeName: string;
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: string[];
  predictedDaysUntilRestock: number;
  unpaidBalance: number;
  lastOrderDays: number;
  communicationGap: number;
}

export interface BrandDemandForecast {
  brand: GrabbaBrand;
  currentWeekDemand: number;
  nextWeekPrediction: number;
  growthRate: number;
  trend: 'rising' | 'stable' | 'declining';
  confidenceScore: number;
}

export interface SmartAlert {
  id: string;
  type: 'inventory' | 'payment' | 'delivery' | 'production' | 'communication' | 'ambassador';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  entityId?: string;
  entityType?: string;
  actionRequired: boolean;
  suggestedAction?: string;
  timestamp: Date;
}

export interface DriverReliabilityScore {
  driverId: string;
  driverName: string;
  reliabilityScore: number;
  onTimeRate: number;
  deliveriesCompleted: number;
  lateDeliveries: number;
  missedDeliveries: number;
  trend: 'improving' | 'stable' | 'declining';
}

export interface AmbassadorPerformance {
  ambassadorId: string;
  ambassadorName: string;
  performanceScore: number;
  storesAcquired: number;
  commissionsEarned: number;
  activityLevel: 'active' | 'moderate' | 'inactive';
  predictedNextMonthCommission: number;
}

export interface IntelligenceInsight {
  category: string;
  insight: string;
  confidence: number;
  dataPoints: number;
  generatedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PREDICTIVE MODELS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate store restock prediction based on consumption patterns
 */
export function predictStoreRestock(
  currentInventory: number,
  avgDailyConsumption: number,
  lastOrderDate: Date | null
): { daysUntilRestock: number; confidence: number; urgency: 'normal' | 'soon' | 'urgent' | 'critical' } {
  if (avgDailyConsumption <= 0) {
    return { daysUntilRestock: 999, confidence: 0.3, urgency: 'normal' };
  }

  const daysUntilRestock = Math.floor(currentInventory / avgDailyConsumption);
  const daysSinceOrder = lastOrderDate 
    ? Math.floor((Date.now() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24))
    : 30;

  // Confidence based on data freshness
  const confidence = Math.max(0.3, 1 - (daysSinceOrder / 60));

  let urgency: 'normal' | 'soon' | 'urgent' | 'critical' = 'normal';
  if (daysUntilRestock <= 2) urgency = 'critical';
  else if (daysUntilRestock <= 5) urgency = 'urgent';
  else if (daysUntilRestock <= 10) urgency = 'soon';

  return { daysUntilRestock, confidence, urgency };
}

/**
 * Calculate unpaid account risk score
 */
export function calculatePaymentRiskScore(
  owedAmount: number,
  daysSinceInvoice: number,
  paymentHistory: number, // 0-100 reliability score
  totalTransactions: number
): { riskScore: number; riskLevel: 'low' | 'medium' | 'high' | 'critical'; probability: number } {
  let riskScore = 0;

  // Amount factor (0-30 points)
  if (owedAmount > 5000) riskScore += 30;
  else if (owedAmount > 2000) riskScore += 20;
  else if (owedAmount > 500) riskScore += 10;

  // Days overdue factor (0-40 points)
  if (daysSinceInvoice > 60) riskScore += 40;
  else if (daysSinceInvoice > 30) riskScore += 25;
  else if (daysSinceInvoice > 14) riskScore += 10;

  // Payment history factor (0-30 points)
  if (paymentHistory < 30) riskScore += 30;
  else if (paymentHistory < 60) riskScore += 20;
  else if (paymentHistory < 80) riskScore += 10;

  // Adjust for transaction volume
  if (totalTransactions < 3) riskScore = Math.min(riskScore * 0.7, 100);

  const riskLevel = riskScore >= 70 ? 'critical' 
    : riskScore >= 50 ? 'high' 
    : riskScore >= 30 ? 'medium' 
    : 'low';

  // Probability of late payment
  const probability = Math.min(0.95, riskScore / 100);

  return { riskScore: Math.round(riskScore), riskLevel, probability };
}

/**
 * Detect delivery bottlenecks
 */
export function detectDeliveryBottleneck(
  pendingDeliveries: number,
  activeDrivers: number,
  avgDeliveriesPerDriver: number,
  completionRate: number
): { isBottleneck: boolean; severity: number; recommendation: string } {
  const capacityRatio = activeDrivers > 0 
    ? pendingDeliveries / (activeDrivers * avgDeliveriesPerDriver) 
    : 999;

  const isBottleneck = capacityRatio > 1.2 || completionRate < 0.7;
  const severity = Math.min(100, Math.round(capacityRatio * 50));

  let recommendation = '';
  if (capacityRatio > 2) {
    recommendation = `Critical overload: ${pendingDeliveries} pending with ${activeDrivers} drivers. Consider adding ${Math.ceil(pendingDeliveries / avgDeliveriesPerDriver) - activeDrivers} drivers.`;
  } else if (capacityRatio > 1.5) {
    recommendation = `High load detected. Current capacity at ${Math.round(capacityRatio * 100)}%. Prioritize urgent deliveries.`;
  } else if (completionRate < 0.7) {
    recommendation = `Completion rate at ${Math.round(completionRate * 100)}%. Review route efficiency and driver performance.`;
  }

  return { isBottleneck, severity, recommendation };
}

/**
 * Forecast brand demand
 */
export function forecastBrandDemand(
  weeklyOrders: number[],
  brand: GrabbaBrand
): BrandDemandForecast {
  if (weeklyOrders.length < 2) {
    return {
      brand,
      currentWeekDemand: weeklyOrders[0] || 0,
      nextWeekPrediction: weeklyOrders[0] || 0,
      growthRate: 0,
      trend: 'stable',
      confidenceScore: 0.3,
    };
  }

  const currentWeek = weeklyOrders[weeklyOrders.length - 1];
  const previousWeek = weeklyOrders[weeklyOrders.length - 2];
  const avgGrowth = weeklyOrders.length > 2
    ? weeklyOrders.slice(1).reduce((sum, v, i) => sum + (v - weeklyOrders[i]) / weeklyOrders[i], 0) / (weeklyOrders.length - 1)
    : (currentWeek - previousWeek) / Math.max(previousWeek, 1);

  const growthRate = avgGrowth * 100;
  const nextWeekPrediction = Math.round(currentWeek * (1 + avgGrowth));

  let trend: 'rising' | 'stable' | 'declining' = 'stable';
  if (growthRate > 5) trend = 'rising';
  else if (growthRate < -5) trend = 'declining';

  const confidenceScore = Math.min(0.95, 0.5 + (weeklyOrders.length * 0.05));

  return {
    brand,
    currentWeekDemand: currentWeek,
    nextWeekPrediction,
    growthRate: Math.round(growthRate * 10) / 10,
    trend,
    confidenceScore,
  };
}

/**
 * Calculate tube depletion timeline
 */
export function calculateTubeDepletion(
  currentStock: number,
  avgDailyBurn: number,
  pendingOrders: number
): { depletionDays: number; criticalDate: Date; action: string } {
  const netBurn = avgDailyBurn - (pendingOrders / 7); // Assuming weekly replenishment
  const depletionDays = netBurn > 0 ? Math.floor(currentStock / netBurn) : 999;
  const criticalDate = new Date(Date.now() + depletionDays * 24 * 60 * 60 * 1000);

  let action = '';
  if (depletionDays <= 3) {
    action = 'URGENT: Schedule emergency restock within 24 hours';
  } else if (depletionDays <= 7) {
    action = 'Schedule restock delivery for this week';
  } else if (depletionDays <= 14) {
    action = 'Plan restock for next delivery cycle';
  }

  return { depletionDays, criticalDate, action };
}

/**
 * Score driver reliability
 */
export function scoreDriverReliability(
  onTimeDeliveries: number,
  totalDeliveries: number,
  complaints: number,
  recentTrend: number[] // last 4 weeks completion rates
): DriverReliabilityScore & { score: number } {
  if (totalDeliveries === 0) {
    return {
      driverId: '',
      driverName: '',
      reliabilityScore: 50,
      onTimeRate: 0,
      deliveriesCompleted: 0,
      lateDeliveries: 0,
      missedDeliveries: 0,
      trend: 'stable',
      score: 50,
    };
  }

  const onTimeRate = onTimeDeliveries / totalDeliveries;
  let score = Math.round(onTimeRate * 80);
  
  // Complaint penalty
  score -= complaints * 5;
  
  // Volume bonus
  if (totalDeliveries > 100) score += 10;
  else if (totalDeliveries > 50) score += 5;

  score = Math.max(0, Math.min(100, score));

  // Determine trend
  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (recentTrend.length >= 2) {
    const recentAvg = recentTrend.slice(-2).reduce((a, b) => a + b, 0) / 2;
    const olderAvg = recentTrend.slice(0, -2).reduce((a, b) => a + b, 0) / Math.max(1, recentTrend.length - 2);
    if (recentAvg > olderAvg + 0.05) trend = 'improving';
    else if (recentAvg < olderAvg - 0.05) trend = 'declining';
  }

  return {
    driverId: '',
    driverName: '',
    reliabilityScore: score,
    onTimeRate: Math.round(onTimeRate * 100),
    deliveriesCompleted: onTimeDeliveries,
    lateDeliveries: totalDeliveries - onTimeDeliveries,
    missedDeliveries: 0,
    trend,
    score,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SMART ALERTS ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

export function generateSmartAlerts(data: {
  lowStockStores: Array<{ id: string; name: string; tubesLeft: number; daysUntilEmpty: number }>;
  unpaidAccounts: Array<{ id: string; name: string; amount: number; daysPastDue: number }>;
  inactiveAmbassadors: Array<{ id: string; name: string; daysSinceActivity: number }>;
  lateDeliveries: Array<{ id: string; driverName: string; count: number }>;
  productionGaps: Array<{ brand: string; shortfall: number; daysUntil: number }>;
  communicationGaps: Array<{ id: string; name: string; daysSinceContact: number }>;
}): SmartAlert[] {
  const alerts: SmartAlert[] = [];

  // Inventory alerts
  data.lowStockStores.forEach(store => {
    const severity = store.daysUntilEmpty <= 2 ? 'critical' : store.daysUntilEmpty <= 5 ? 'warning' : 'info';
    alerts.push({
      id: `inv-${store.id}`,
      type: 'inventory',
      severity,
      title: `${store.name} running low`,
      message: `Only ${store.tubesLeft} tubes remaining. Estimated ${store.daysUntilEmpty} days until empty.`,
      entityId: store.id,
      entityType: 'store',
      actionRequired: severity !== 'info',
      suggestedAction: `Schedule delivery to ${store.name} within ${Math.max(1, store.daysUntilEmpty - 1)} days`,
      timestamp: new Date(),
    });
  });

  // Payment alerts
  data.unpaidAccounts.forEach(account => {
    const severity = account.daysPastDue > 45 ? 'critical' : account.daysPastDue > 30 ? 'warning' : 'info';
    alerts.push({
      id: `pay-${account.id}`,
      type: 'payment',
      severity,
      title: `Unpaid: ${account.name}`,
      message: `$${account.amount.toLocaleString()} outstanding for ${account.daysPastDue} days.`,
      entityId: account.id,
      entityType: 'company',
      actionRequired: severity !== 'info',
      suggestedAction: `Follow up on payment from ${account.name}`,
      timestamp: new Date(),
    });
  });

  // Ambassador alerts
  data.inactiveAmbassadors.forEach(amb => {
    if (amb.daysSinceActivity > 14) {
      alerts.push({
        id: `amb-${amb.id}`,
        type: 'ambassador',
        severity: amb.daysSinceActivity > 30 ? 'warning' : 'info',
        title: `Ambassador ${amb.name} inactive`,
        message: `No activity for ${amb.daysSinceActivity} days.`,
        entityId: amb.id,
        entityType: 'ambassador',
        actionRequired: amb.daysSinceActivity > 30,
        suggestedAction: `Contact ${amb.name} to check in and re-engage`,
        timestamp: new Date(),
      });
    }
  });

  // Delivery alerts
  data.lateDeliveries.forEach(driver => {
    if (driver.count >= 3) {
      alerts.push({
        id: `del-${driver.id}`,
        type: 'delivery',
        severity: driver.count >= 5 ? 'critical' : 'warning',
        title: `Driver ${driver.driverName} delays`,
        message: `${driver.count} late deliveries this week.`,
        entityId: driver.id,
        entityType: 'driver',
        actionRequired: true,
        suggestedAction: `Review route assignments for ${driver.driverName}`,
        timestamp: new Date(),
      });
    }
  });

  // Production alerts
  data.productionGaps.forEach(gap => {
    alerts.push({
      id: `prod-${gap.brand}`,
      type: 'production',
      severity: gap.daysUntil <= 3 ? 'critical' : gap.daysUntil <= 7 ? 'warning' : 'info',
      title: `${gap.brand} production gap`,
      message: `Predicted shortfall of ${gap.shortfall} tubes in ${gap.daysUntil} days.`,
      entityType: 'brand',
      actionRequired: gap.daysUntil <= 7,
      suggestedAction: `Increase ${gap.brand} production by ${Math.ceil(gap.shortfall / gap.daysUntil)} tubes/day`,
      timestamp: new Date(),
    });
  });

  // Communication gaps
  data.communicationGaps.forEach(contact => {
    if (contact.daysSinceContact > 21) {
      alerts.push({
        id: `comm-${contact.id}`,
        type: 'communication',
        severity: contact.daysSinceContact > 45 ? 'warning' : 'info',
        title: `No contact: ${contact.name}`,
        message: `${contact.daysSinceContact} days since last communication.`,
        entityId: contact.id,
        entityType: 'contact',
        actionRequired: contact.daysSinceContact > 30,
        suggestedAction: `Schedule call or message to ${contact.name}`,
        timestamp: new Date(),
      });
    }
  });

  // Sort by severity
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-INSIGHTS GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

export function generateInsight(data: {
  brandSales: Record<GrabbaBrand, { thisWeek: number; lastWeek: number }>;
  topNeighborhoods: Array<{ name: string; tubes: number; change: number }>;
  unpaidTotal: number;
  unpaidChange: number;
  deliveryRate: number;
  productionOutput: number;
}): IntelligenceInsight[] {
  const insights: IntelligenceInsight[] = [];

  // Brand performance insights
  Object.entries(data.brandSales).forEach(([brand, sales]) => {
    const change = sales.lastWeek > 0 
      ? ((sales.thisWeek - sales.lastWeek) / sales.lastWeek) * 100 
      : 0;
    
    if (Math.abs(change) > 10) {
      insights.push({
        category: 'Brand Performance',
        insight: `${brand} orders ${change > 0 ? 'increased' : 'decreased'} ${Math.abs(Math.round(change))}% this week. ${
          change > 0 
            ? 'Consider increasing inventory allocation.' 
            : 'Review market conditions and pricing.'
        }`,
        confidence: 0.85,
        dataPoints: 2,
        generatedAt: new Date(),
      });
    }
  });

  // Neighborhood insights
  if (data.topNeighborhoods.length > 0) {
    const hotHood = data.topNeighborhoods[0];
    insights.push({
      category: 'Geographic Intelligence',
      insight: `${hotHood.name} is the top-performing neighborhood with ${hotHood.tubes.toLocaleString()} tubes ordered. ${
        hotHood.change > 0 
          ? `Growth of ${Math.round(hotHood.change)}% from last period.` 
          : 'Consider promotional activities to boost growth.'
      }`,
      confidence: 0.9,
      dataPoints: data.topNeighborhoods.length,
      generatedAt: new Date(),
    });
  }

  // Financial insights
  if (data.unpaidChange !== 0) {
    insights.push({
      category: 'Financial Health',
      insight: `Unpaid accounts total ${data.unpaidChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(Math.round(data.unpaidChange))}% to $${data.unpaidTotal.toLocaleString()}. ${
        data.unpaidChange > 20 
          ? 'Immediate collection efforts recommended.' 
          : data.unpaidChange < -10 
            ? 'Collection efforts showing positive results.' 
            : 'Continue monitoring payment patterns.'
      }`,
      confidence: 0.88,
      dataPoints: 1,
      generatedAt: new Date(),
    });
  }

  // Delivery insights
  if (data.deliveryRate < 0.85) {
    insights.push({
      category: 'Operations',
      insight: `Delivery completion rate at ${Math.round(data.deliveryRate * 100)}% is below target. Consider route optimization or adding delivery capacity.`,
      confidence: 0.82,
      dataPoints: 1,
      generatedAt: new Date(),
    });
  }

  return insights;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOP ENTITIES RECOMMENDATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function getTopStoresToCheck(stores: Array<{
  id: string;
  name: string;
  daysUntilRestock: number;
  unpaidAmount: number;
  daysSinceContact: number;
}>): Array<{ id: string; name: string; reason: string; priority: number }> {
  return stores
    .map(store => {
      let priority = 0;
      const reasons: string[] = [];

      if (store.daysUntilRestock <= 5) {
        priority += 40;
        reasons.push(`restock in ${store.daysUntilRestock} days`);
      }
      if (store.unpaidAmount > 500) {
        priority += 30;
        reasons.push(`$${store.unpaidAmount.toLocaleString()} unpaid`);
      }
      if (store.daysSinceContact > 14) {
        priority += 20;
        reasons.push(`${store.daysSinceContact} days since contact`);
      }

      return {
        id: store.id,
        name: store.name,
        reason: reasons.join(', '),
        priority,
      };
    })
    .filter(s => s.priority > 0)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 20);
}

export function getTopWholesalersToActivate(wholesalers: Array<{
  id: string;
  name: string;
  lastOrderDays: number;
  totalOrders: number;
  avgOrderValue: number;
}>): Array<{ id: string; name: string; reason: string; potentialValue: number }> {
  return wholesalers
    .filter(w => w.lastOrderDays > 14 && w.totalOrders > 0)
    .map(w => ({
      id: w.id,
      name: w.name,
      reason: `${w.lastOrderDays} days since order, avg $${w.avgOrderValue.toLocaleString()}`,
      potentialValue: w.avgOrderValue,
    }))
    .sort((a, b) => b.potentialValue - a.potentialValue)
    .slice(0, 10);
}

// ═══════════════════════════════════════════════════════════════════════════════
// DAILY REPORT GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

export interface DailyIntelligenceReport {
  generatedAt: Date;
  summary: {
    overallHealth: number;
    criticalAlerts: number;
    opportunities: number;
  };
  brandPerformance: BrandDemandForecast[];
  inventoryForecast: {
    estimatedTotal: number;
    daysUntilCritical: number;
    restockNeeded: string[];
  };
  unpaidRisk: {
    totalAmount: number;
    highRiskAccounts: number;
    projectedCollections: number;
  };
  bottlenecks: Array<{ area: string; severity: number; action: string }>;
  topStores: Array<{ name: string; performance: number; trend: string }>;
  failingStores: Array<{ name: string; issues: string[] }>;
  ambassadorRankings: Array<{ name: string; score: number; earnings: number }>;
  weekPipeline: {
    expectedOrders: number;
    expectedRevenue: number;
    deliveriesScheduled: number;
  };
}

export function generateDailyReport(data: {
  brandForecasts: BrandDemandForecast[];
  alerts: SmartAlert[];
  inventoryData: { total: number; lowStockCount: number; avgDaysUntilRestock: number };
  unpaidData: { total: number; highRisk: number; collected: number };
  bottlenecks: Array<{ area: string; severity: number; action: string }>;
  stores: Array<{ name: string; score: number; trend: string; issues: string[] }>;
  ambassadors: Array<{ name: string; score: number; earnings: number }>;
  pipeline: { orders: number; revenue: number; deliveries: number };
}): DailyIntelligenceReport {
  const criticalAlerts = data.alerts.filter(a => a.severity === 'critical').length;
  const opportunities = data.alerts.filter(a => a.type === 'communication' && a.severity === 'info').length;
  
  // Calculate overall health (0-100)
  let health = 100;
  health -= criticalAlerts * 10;
  health -= data.inventoryData.lowStockCount * 2;
  health -= data.unpaidData.highRisk * 3;
  health = Math.max(0, Math.min(100, health));

  return {
    generatedAt: new Date(),
    summary: {
      overallHealth: health,
      criticalAlerts,
      opportunities,
    },
    brandPerformance: data.brandForecasts,
    inventoryForecast: {
      estimatedTotal: data.inventoryData.total,
      daysUntilCritical: data.inventoryData.avgDaysUntilRestock,
      restockNeeded: data.stores.filter(s => s.issues.includes('low_stock')).map(s => s.name),
    },
    unpaidRisk: {
      totalAmount: data.unpaidData.total,
      highRiskAccounts: data.unpaidData.highRisk,
      projectedCollections: data.unpaidData.collected,
    },
    bottlenecks: data.bottlenecks,
    topStores: data.stores.filter(s => s.score > 70).slice(0, 10).map(s => ({
      name: s.name,
      performance: s.score,
      trend: s.trend,
    })),
    failingStores: data.stores.filter(s => s.issues.length > 0).slice(0, 10).map(s => ({
      name: s.name,
      issues: s.issues,
    })),
    ambassadorRankings: data.ambassadors.slice(0, 10),
    weekPipeline: {
      expectedOrders: data.pipeline.orders,
      expectedRevenue: data.pipeline.revenue,
      deliveriesScheduled: data.pipeline.deliveries,
    },
  };
}
