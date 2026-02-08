/**
 * Sell-Through Health Classification
 * Deterministic, read-only labels derived from existing summary data.
 */

export type SellThroughHealthStatus = "on_track" | "slowing" | "overdue" | "new";

export interface SellThroughHealth {
  status: SellThroughHealthStatus;
  label: string;
  /** Positive = slower than usual, Negative = faster than usual */
  daysVariance: number | null;
  varianceLabel: string | null;
}

const HEALTH_CONFIG: Record<SellThroughHealthStatus, { label: string; color: string; bgColor: string }> = {
  on_track: {
    label: "On Track",
    color: "text-emerald-700 dark:text-emerald-400",
    bgColor: "bg-emerald-500/10 border-emerald-500/20",
  },
  slowing: {
    label: "Slowing",
    color: "text-amber-700 dark:text-amber-400",
    bgColor: "bg-amber-500/10 border-amber-500/20",
  },
  overdue: {
    label: "Overdue",
    color: "text-red-700 dark:text-red-400",
    bgColor: "bg-red-500/10 border-red-500/20",
  },
  new: {
    label: "New",
    color: "text-blue-700 dark:text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/20",
  },
};

/**
 * Classify sell-through health for a store × brand pair.
 *
 * Rules (deterministic):
 *   On Track  → days_since <= avg_days
 *   Slowing   → days_since > avg_days AND <= avg_days × 1.5
 *   Overdue   → days_since > avg_days × 1.5
 *   New       → insufficient history (< 2 orders or no avg)
 */
export function classifySellThroughHealth(
  daysSinceLastOrder: number | null,
  avgDaysBetweenOrders: number | null,
  totalOrdersLifetime: number
): SellThroughHealth {
  // Not enough history to classify
  if (
    totalOrdersLifetime < 2 ||
    avgDaysBetweenOrders == null ||
    avgDaysBetweenOrders <= 0 ||
    daysSinceLastOrder == null
  ) {
    return { status: "new", label: "New", daysVariance: null, varianceLabel: null };
  }

  const variance = Math.round(daysSinceLastOrder - avgDaysBetweenOrders);
  const varianceLabel =
    variance === 0
      ? "On pace"
      : variance > 0
      ? `+${variance}d vs avg`
      : `${variance}d vs avg`;

  let status: SellThroughHealthStatus;
  if (daysSinceLastOrder <= avgDaysBetweenOrders) {
    status = "on_track";
  } else if (daysSinceLastOrder <= avgDaysBetweenOrders * 1.5) {
    status = "slowing";
  } else {
    status = "overdue";
  }

  return {
    status,
    label: HEALTH_CONFIG[status].label,
    daysVariance: variance,
    varianceLabel,
  };
}

export function getHealthColors(status: SellThroughHealthStatus) {
  return HEALTH_CONFIG[status];
}
