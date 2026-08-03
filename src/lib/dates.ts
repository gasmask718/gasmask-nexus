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

/**
 * ALWAYS shows the real calendar date + clock time — never collapses to
 * "3 days ago". Use for any "when did this actually change" surface
 * (tube counts, inventory checks, VA/admin checkers, audit stamps).
 *
 * "Jul 28, 2026 3:42 PM"
 */
export function dynastyStamp(
  value: Date | string | null | undefined,
  options?: { fallback?: string }
): string {
  const date = toDate(value);
  if (!date) return options?.fallback ?? '—';
  return format(date, 'MMM d, yyyy h:mm a');
}

/**
 * Real date + time WITH a relative hint appended.
 * "Jul 28, 2026 3:42 PM (3 days ago)"
 */
export function dynastyStampWithRelative(
  value: Date | string | null | undefined,
  options?: { fallback?: string }
): string {
  const date = toDate(value);
  if (!date) return options?.fallback ?? '—';
  return `${dynastyStamp(date)} (${formatDistanceToNowStrict(date, { addSuffix: true })})`;
}

/**
 * Day-count FIRST, real date second — for "days since / days until" surfaces.
 * "12 days ago (Jul 16, 2026)"
 */
export function dynastyDaysWithDate(
  value: Date | string | null | undefined,
  options?: { fallback?: string; prefix?: string }
): string {
  const date = toDate(value);
  if (!date) return options?.fallback ?? '—';
  const rel = formatDistanceToNowStrict(date, { addSuffix: true });
  return `${options?.prefix ?? ''}${rel} (${format(date, 'MMM d, yyyy')})`;
}

/** Calendar date with weekday — for date pickers / due dates. "Tue, Jul 28, 2026" */
export function dynastyDateWithWeekday(
  value: Date | string | null | undefined,
  options?: { fallback?: string }
): string {
  const date = toDate(value);
  if (!date) return options?.fallback ?? '—';
  return format(date, 'EEE, MMM d, yyyy');
}

// ═══════════════════════════════════════════════════════════════════════════
// FIELD ACTIVITY TIMESTAMPS — absolute-first, America/New_York
// Operator rule: never show a relative-only timestamp on field activity.
// ═══════════════════════════════════════════════════════════════════════════

export const FIELD_TIME_ZONE = 'America/New_York';

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True when the raw value carries no time component (a `date` column). */
export function isDateOnly(value: Date | string | null | undefined): boolean {
  return typeof value === 'string' && DATE_ONLY_RE.test(value.trim());
}

/**
 * Absolute field-activity timestamp in America/New_York.
 * "Jan 14, 2026 · 3:42 PM" — or "Jan 14, 2026" for date-only columns
 * (never fakes a time that the database does not have).
 */
export function fieldStamp(
  value: Date | string | null | undefined,
  options?: { fallback?: string }
): string {
  const dateOnly = isDateOnly(value);
  const date = dateOnly
    ? toDate(`${(value as string).trim()}T12:00:00`)
    : toDate(value);
  if (!date) return options?.fallback ?? '—';

  const datePart = new Intl.DateTimeFormat('en-US', {
    timeZone: FIELD_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);

  if (dateOnly) return datePart;

  const timePart = new Intl.DateTimeFormat('en-US', {
    timeZone: FIELD_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

  return `${datePart} · ${timePart}`;
}

/** Secondary muted hint, e.g. "6 months ago". Never used on its own. */
export function fieldRelative(
  value: Date | string | null | undefined,
  options?: { fallback?: string }
): string {
  const date = isDateOnly(value)
    ? toDate(`${(value as string).trim()}T12:00:00`)
    : toDate(value);
  if (!date) return options?.fallback ?? '';
  return formatDistanceToNowStrict(date, { addSuffix: true });
}
