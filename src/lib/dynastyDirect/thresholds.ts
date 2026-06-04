/**
 * Dynasty Direct — alert thresholds.
 * Tunable in one place; no migration required. Twilio thresholds use the
 * STRICTER policy David approved (the comms system died once from balance
 * exhaustion — $25 warn / $10 critical is the floor).
 */
export const DD_ALERT_THRESHOLDS = {
  twilioBalance: {
    warnBelow: 25,        // USD
    criticalBelow: 10,    // USD
  },
  paidOrders: {
    // Warn if zero paid orders in the current week (Mon-Sun, postgres
    // date_trunc('week') is ISO-week so Monday is day 0).
    warnIfWeekZero: true,
  },
  cronStaleness: {
    warnAfterMinutes: 120,
    criticalAfterMinutes: 360,
  },
  routingFailures: {
    criticalIfAnyIn24h: true,
  },
  approvals: {
    infoIfAnyPending: true,
  },
  commsHealth: {
    // Any FAIL row anywhere in last hour is critical.
    criticalOnAnyFail: true,
    warnOnAnyWarn: true,
  },
} as const;

export const DD_SNOOZE_OPTIONS = [
  { label: 'Snooze 1 hour', minutes: 60 },
  { label: 'Snooze 24 hours', minutes: 60 * 24 },
  { label: 'Snooze until resolved', minutes: null }, // null = until next state change
] as const;

export type Severity = 'critical' | 'warn' | 'info';

export const SEVERITY_STYLES: Record<Severity, { bar: string; chip: string; dot: string }> = {
  critical: {
    bar: 'border-red-500/40 bg-red-500/10 text-red-100',
    chip: 'bg-red-500 text-white',
    dot: 'bg-red-500',
  },
  warn: {
    bar: 'border-amber-500/40 bg-amber-500/10 text-amber-50',
    chip: 'bg-amber-500 text-black',
    dot: 'bg-amber-500',
  },
  info: {
    bar: 'border-sky-500/30 bg-sky-500/10 text-sky-50',
    chip: 'bg-sky-500 text-white',
    dot: 'bg-sky-500',
  },
};
