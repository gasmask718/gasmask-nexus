// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE FLAGS — scaffolded surfaces that have no data behind them.
//
// These panels render against tables that no code in this repo ever populates.
// They are hidden rather than deleted so the UI can be switched back on the
// moment a real writer ships. Flip a flag to `true` once its table has rows.
//
// Audit 2026-08-04:
//   store_product_state → 0 rows. Only writer is an UPDATE in the
//     `predict-inventory` edge function — it never INSERTs, so there is
//     nothing to update. Scaffolded, never finished.
//   route_insights      → 0 rows. Two upsert writers exist (`route-learning`,
//     `optimization` edge functions) but neither is invoked by the app or by
//     any cron job. Built, never wired.
//   route_checkins      → 0 rows. No writer exists anywhere in the codebase.
//     Read by 3 surfaces. Pure scaffold.
// ═══════════════════════════════════════════════════════════════════════════════

export const FEATURE_FLAGS = {
  /** "Product Inventory Levels" card on the store profile → store_product_state */
  storeProductStatePanel: false,
  /** "Route Intelligence Insights" card on the store profile → route_insights */
  routeInsightsPanel: false,
  /** "Route Intelligence" check-in history card → route_checkins */
  routeCheckinsPanel: false,
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag];
}
