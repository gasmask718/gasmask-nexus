import { format, formatDistanceToNowStrict, parseISO, isValid } from 'date-fns';

const RELATIVE_THRESHOLD_DAYS = 7;

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isValid(value) ? value : null;
  try {
    const parsed = parseISO(value);
    if (isValid(parsed)) return parsed;
    const fallback = new Date(value);
    return isValid(fallback) ? fallback : null;
  } catch {
    return null;
  }
}

/**
 * Smart date formatter. Returns "X days ago" for dates within
 * the last 7 days, otherwise "MMM d, yyyy" with explicit year.
 *
 * Use everywhere a date is shown on store profile, master profile,
 * cards, badges, and any operator-facing surface to ensure year
 * is never ambiguous.
 */
export function dynastyDate(
  value: Date | string | null | undefined,
  options?: { fallback?: string }
): string {
  const date = toDate(value);
  if (!date) return options?.fallback ?? '—';
  const daysAgo = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  if (daysAgo < RELATIVE_THRESHOLD_DAYS && daysAgo >= 0) {
    return formatDistanceToNowStrict(date, { addSuffix: true });
  }
  return format(date, 'MMM d, yyyy');
}

/**
 * Same as dynastyDate but includes time for events where the
 * hour matters (notes, updates, AI runs, etc.).
 */
export function dynastyDateTime(
  value: Date | string | null | undefined,
  options?: { fallback?: string }
): string {
  const date = toDate(value);
  if (!date) return options?.fallback ?? '—';
  const daysAgo = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  if (daysAgo < RELATIVE_THRESHOLD_DAYS && daysAgo >= 0) {
    return formatDistanceToNowStrict(date, { addSuffix: true });
  }
  return format(date, 'MMM d, yyyy · h:mm a');
}

/** Always relative ("3 days ago"). */
export function dynastyRelative(
  value: Date | string | null | undefined,
  options?: { fallback?: string }
): string {
  const date = toDate(value);
  if (!date) return options?.fallback ?? '—';
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

/** Always absolute year-bearing date ("MMM d, yyyy"). */
export function dynastyDateAbsolute(
  value: Date | string | null | undefined,
  options?: { fallback?: string }
): string {
  const date = toDate(value);
  if (!date) return options?.fallback ?? '—';
  return format(date, 'MMM d, yyyy');
}
