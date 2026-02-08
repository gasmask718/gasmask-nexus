// ═══════════════════════════════════════════════════════════════
// Phase VI — Store Health Scoring Engine
// Deterministic, weighted, explainable. No ML black box.
// Every score shows WHY.
// ═══════════════════════════════════════════════════════════════

import { CANONICAL_BRAND_IDS, getBrandDisplayName } from '@/config/brands';

export type HealthStatus = 'healthy' | 'watch' | 'at_risk';

export interface DimensionScore {
  dimension: string;
  label: string;
  score: number;       // 0–100
  weight: number;      // fraction summing to 1
  weighted: number;    // score × weight
  explanation: string;
}

export interface StoreHealthResult {
  overallScore: number;
  healthStatus: HealthStatus;
  dimensions: DimensionScore[];
}

// Weights — must sum to 1.0
const WEIGHTS = {
  visit_consistency: 0.25,
  inventory_accuracy: 0.20,
  order_cadence: 0.20,
  contact_reliability: 0.20,
  sticker_compliance: 0.10,
  growth_signals: 0.05,
};

/**
 * Calculate a deterministic store health score from aggregated data.
 * All inputs are pre-computed counts/flags — no database access here.
 */
export function calculateStoreHealth(input: {
  // Visit consistency
  visitsLast30Days: number;
  expectedVisitsPerMonth: number;
  daysSinceLastVisit: number | null;

  // Inventory accuracy
  brandsWithInventoryData: number;
  totalBrands: number;
  avgInventoryCount: number | null;

  // Order cadence
  hasRecentOrder: boolean;           // order in last 30 days
  avgDaysBetweenOrders: number | null;
  daysSinceLastOrder: number | null;

  // Contact reliability
  hasResponsiveContact: boolean;
  bossNameConfirmed: boolean;
  bossPhoneConfirmed: boolean;

  // Sticker compliance
  stickersPresent: boolean | null;
  stickerConditionGood: boolean | null;

  // Growth signals
  sellsFlowers: boolean | null;
  newLeadsCaptured: number;
}): StoreHealthResult {
  const dims: DimensionScore[] = [];

  // ─── 1. Visit Consistency (25%) ───
  const visitRatio = input.expectedVisitsPerMonth > 0
    ? Math.min(input.visitsLast30Days / input.expectedVisitsPerMonth, 1)
    : 0;
  const visitRecency = input.daysSinceLastVisit != null
    ? Math.max(0, 100 - (input.daysSinceLastVisit * 5)) // -5 points per day overdue
    : 0;
  const visitScore = Math.round((visitRatio * 60) + (visitRecency * 0.4));

  dims.push({
    dimension: 'visit_consistency',
    label: 'Visit Consistency',
    score: clamp(visitScore),
    weight: WEIGHTS.visit_consistency,
    weighted: 0,
    explanation: `${input.visitsLast30Days}/${input.expectedVisitsPerMonth} visits this month` +
      (input.daysSinceLastVisit != null ? `, last visit ${input.daysSinceLastVisit}d ago` : ''),
  });

  // ─── 2. Inventory Accuracy (20%) ───
  const invCoverage = input.totalBrands > 0
    ? (input.brandsWithInventoryData / input.totalBrands) * 100
    : 0;
  const invScore = Math.round(invCoverage);

  dims.push({
    dimension: 'inventory_accuracy',
    label: 'Inventory Accuracy',
    score: clamp(invScore),
    weight: WEIGHTS.inventory_accuracy,
    weighted: 0,
    explanation: `${input.brandsWithInventoryData}/${input.totalBrands} brands tracked`,
  });

  // ─── 3. Order Cadence (20%) ───
  let orderScore = 0;
  let orderExplanation = 'No order data';

  if (input.hasRecentOrder) {
    orderScore = 100;
    orderExplanation = 'Order placed in last 30 days';
  } else if (input.daysSinceLastOrder != null && input.avgDaysBetweenOrders != null) {
    const ratio = input.daysSinceLastOrder / input.avgDaysBetweenOrders;
    if (ratio <= 1) {
      orderScore = 100;
      orderExplanation = 'On track for reorder';
    } else if (ratio <= 1.5) {
      orderScore = 60;
      orderExplanation = `Slowing — ${Math.round(input.daysSinceLastOrder - input.avgDaysBetweenOrders)}d overdue`;
    } else {
      orderScore = 20;
      orderExplanation = `Overdue — ${Math.round(input.daysSinceLastOrder - input.avgDaysBetweenOrders)}d past avg`;
    }
  }

  dims.push({
    dimension: 'order_cadence',
    label: 'Order Cadence',
    score: clamp(orderScore),
    weight: WEIGHTS.order_cadence,
    weighted: 0,
    explanation: orderExplanation,
  });

  // ─── 4. Contact Reliability (20%) ───
  let contactScore = 0;
  const contactParts: string[] = [];

  if (input.hasResponsiveContact) { contactScore += 50; contactParts.push('responsive ✓'); }
  if (input.bossNameConfirmed) { contactScore += 25; contactParts.push('name ✓'); }
  if (input.bossPhoneConfirmed) { contactScore += 25; contactParts.push('phone ✓'); }

  dims.push({
    dimension: 'contact_reliability',
    label: 'Contact Reliability',
    score: clamp(contactScore),
    weight: WEIGHTS.contact_reliability,
    weighted: 0,
    explanation: contactParts.length > 0 ? contactParts.join(', ') : 'No verified contacts',
  });

  // ─── 5. Sticker Compliance (10%) ───
  let stickerScore = 0;
  let stickerExplanation = 'Not checked';

  if (input.stickersPresent === true) {
    stickerScore = input.stickerConditionGood === true ? 100 : 60;
    stickerExplanation = input.stickerConditionGood === true
      ? 'Present & good condition'
      : 'Present but poor condition';
  } else if (input.stickersPresent === false) {
    stickerScore = 0;
    stickerExplanation = 'Missing';
  }

  dims.push({
    dimension: 'sticker_compliance',
    label: 'Sticker Compliance',
    score: clamp(stickerScore),
    weight: WEIGHTS.sticker_compliance,
    weighted: 0,
    explanation: stickerExplanation,
  });

  // ─── 6. Growth Signals (5%) ───
  let growthScore = 50; // Neutral baseline
  const growthParts: string[] = [];

  if (input.sellsFlowers === true) { growthScore += 25; growthParts.push('Flowers ✓'); }
  if (input.newLeadsCaptured > 0) { growthScore += 25; growthParts.push(`${input.newLeadsCaptured} lead(s)`); }

  dims.push({
    dimension: 'growth_signals',
    label: 'Growth Signals',
    score: clamp(growthScore),
    weight: WEIGHTS.growth_signals,
    weighted: 0,
    explanation: growthParts.length > 0 ? growthParts.join(', ') : 'No signals captured',
  });

  // ─── Calculate weighted total ───
  let overall = 0;
  for (const d of dims) {
    d.weighted = Math.round(d.score * d.weight);
    overall += d.weighted;
  }

  const overallScore = clamp(Math.round(overall));

  let healthStatus: HealthStatus;
  if (overallScore >= 70) healthStatus = 'healthy';
  else if (overallScore >= 40) healthStatus = 'watch';
  else healthStatus = 'at_risk';

  return { overallScore, healthStatus, dimensions: dims };
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

export function getHealthStatusConfig(status: HealthStatus) {
  switch (status) {
    case 'healthy':
      return { label: 'Healthy', emoji: '🟢', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' };
    case 'watch':
      return { label: 'Watch', emoji: '🟡', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' };
    case 'at_risk':
      return { label: 'At Risk', emoji: '🔴', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10 border-red-500/20' };
  }
}
