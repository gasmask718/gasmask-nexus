/**
 * Store Relationship Status — single source of truth for the 9-state
 * relationship health model used across the store directory, profile,
 * filter chips, rollup view, and dispatch eligibility.
 *
 * Backed by store_master.relationship_status (CHECK constrained).
 */

export const STORE_RELATIONSHIP_STATUSES = [
  'Active (Good)',
  'Non-active (New - need to speak)',
  'Follow-up (secure relationship)',
  'Not interested',
  'Not interested - sold in past',
  'No tobacco',
  'Selling slow',
  'Need promo (bring samples)',
  'Closed permanently',
] as const;

export type StoreRelationshipStatus = typeof STORE_RELATIONSHIP_STATUSES[number];

export const DEFAULT_RELATIONSHIP_STATUS: StoreRelationshipStatus =
  'Non-active (New - need to speak)';

/** Tailwind color classes (semantic-token style) per status. */
export const RELATIONSHIP_STATUS_COLORS: Record<StoreRelationshipStatus, string> = {
  'Active (Good)':                       'bg-green-500/10 text-green-600 border-green-500/30',
  'Follow-up (secure relationship)':     'bg-amber-500/10 text-amber-600 border-amber-500/30',
  'Non-active (New - need to speak)':    'bg-blue-500/10 text-blue-600 border-blue-500/30',
  'Need promo (bring samples)':          'bg-purple-500/10 text-purple-600 border-purple-500/30',
  'Selling slow':                        'bg-orange-500/10 text-orange-600 border-orange-500/30',
  'No tobacco':                          'bg-slate-500/10 text-slate-600 border-slate-500/30',
  'Not interested':                      'bg-rose-500/10 text-rose-600 border-rose-500/30',
  'Not interested - sold in past':       'bg-rose-700/10 text-rose-700 border-rose-700/30',
  'Closed permanently':                  'bg-zinc-700/15 text-zinc-700 border-zinc-700/40 line-through',
};

/** Short label used in compact UIs / filter chips. */
export const RELATIONSHIP_STATUS_SHORT: Record<StoreRelationshipStatus, string> = {
  'Active (Good)':                       'Active',
  'Follow-up (secure relationship)':     'Follow-up',
  'Non-active (New - need to speak)':    'New',
  'Need promo (bring samples)':          'Need promo',
  'Selling slow':                        'Slow',
  'No tobacco':                          'No tobacco',
  'Not interested':                      'Not interested',
  'Not interested - sold in past':       'Sold past',
  'Closed permanently':                  'Closed',
};

/** Dispatch eligibility — "Closed permanently" stores are excluded. */
export function isDispatchEligibleStatus(
  status: string | null | undefined,
): boolean {
  return status !== 'Closed permanently';
}

export function isValidRelationshipStatus(
  v: unknown,
): v is StoreRelationshipStatus {
  return typeof v === 'string'
    && (STORE_RELATIONSHIP_STATUSES as readonly string[]).includes(v);
}
