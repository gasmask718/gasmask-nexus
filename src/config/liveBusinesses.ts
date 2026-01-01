/**
 * LIVE BUSINESSES DENY-LIST
 * 
 * These businesses MUST NEVER show simulated data.
 * Simulation mode is forcibly disabled for these business slugs.
 * 
 * SYSTEM LAW: Simulation mode is a tool, not a default.
 * Live businesses must never be simulated.
 */

export const LIVE_BUSINESSES: string[] = [
  'unforgettable_times_usa',
  'top_tier_experience',
  'gas_mask',
  'hot_mama',
  'dynasty_distribution',
  'grabba_leaf',
] as const;

/**
 * Check if a business slug is a live production business
 * that must never show simulated data
 */
export function isLiveBusiness(businessSlug: string | null | undefined): boolean {
  if (!businessSlug) return false;
  return LIVE_BUSINESSES.includes(businessSlug.toLowerCase());
}
