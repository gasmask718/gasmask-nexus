/**
 * Phone status — single source of truth: store_contacts.responsiveness_status
 * (text, CHECK-constrained). NO mirror on store_master.
 *
 * Values:
 *   'unknown'      — no attempts yet
 *   'responsive'   — replies / answers
 *   'unresponsive' — good number, just hasn't replied  → STAYS in retry queues
 *   'wrong_number' — reached someone, not the store    → NEVER dial/text again
 *   'not_active'   — disconnected / out of service     → NEVER dial/text again
 */

export const PHONE_STATUSES = [
  'unknown',
  'responsive',
  'unresponsive',
  'wrong_number',
  'not_active',
] as const;

export type PhoneStatus = (typeof PHONE_STATUSES)[number];

/** Statuses that mean the NUMBER ITSELF is bad and must be replaced. */
export const BAD_NUMBER_STATUSES: PhoneStatus[] = ['wrong_number', 'not_active'];

/** Postgrest-friendly filter list, e.g. .not('responsiveness_status','in',BAD_NUMBER_FILTER) */
export const BAD_NUMBER_FILTER = `(${BAD_NUMBER_STATUSES.join(',')})`;

export const PHONE_STATUS_META: Record<
  PhoneStatus,
  { label: string; short: string; className: string; bad: boolean }
> = {
  unknown: {
    label: 'No Attempts',
    short: 'Unknown',
    className: 'bg-muted text-muted-foreground border-border',
    bad: false,
  },
  responsive: {
    label: 'Responsive',
    short: 'Responsive',
    className: 'bg-green-500/10 text-green-600 border-green-500/30',
    bad: false,
  },
  unresponsive: {
    label: 'Not Responsive',
    short: 'No Reply',
    className: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
    bad: false,
  },
  wrong_number: {
    label: 'Wrong Number',
    short: 'Wrong #',
    className: 'bg-red-500/15 text-red-600 border-red-500/40',
    bad: true,
  },
  not_active: {
    label: 'Not Active (disconnected)',
    short: 'Dead Line',
    className: 'bg-red-500/15 text-red-600 border-red-500/40',
    bad: true,
  },
};

export function normalizePhoneStatus(raw?: string | null): PhoneStatus {
  return (PHONE_STATUSES as readonly string[]).includes(raw ?? '')
    ? (raw as PhoneStatus)
    : 'unknown';
}

/** True when the number must never be dialed/texted again. */
export function isBadNumber(raw?: string | null): boolean {
  return PHONE_STATUS_META[normalizePhoneStatus(raw)].bad;
}

/** True when this contact may be placed in a retry / follow-up / auto-outreach queue. */
export function isContactable(contact: {
  phone?: string | null;
  responsiveness_status?: string | null;
  opted_out?: boolean | null;
}): boolean {
  if (!contact.phone) return false;
  if (contact.opted_out === true) return false;
  return !isBadNumber(contact.responsiveness_status);
}
