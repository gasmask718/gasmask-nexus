// ═══════════════════════════════════════════════════════════════════════════
// MON-02 — UT revenue truth helpers.
// No constants, no estimated margins. Every figure traces to a column.
// Pipeline  = unconfirmed bookings (what people asked about)
// Contracted = confirmed bookings, full_price (what we agreed to deliver)
// Collected = settled payments only — no payment surface exists yet (MON-03)
// ═══════════════════════════════════════════════════════════════════════════

export const CONFIRMED_STATUSES = [
  'confirmed',
  'deposit_received',
  'paid',
  'completed',
  'fulfilled',
];

export function isConfirmed(row: any): boolean {
  return CONFIRMED_STATUSES.includes(String(row?.status || '').toLowerCase());
}

/** Pipeline value of an unconfirmed booking: the customer's stated budget, else quoted full_price. */
export function pipelineValue(row: any): number {
  const budget = Number(String(row?.budget ?? '').replace(/[^0-9.]/g, ''));
  if (Number.isFinite(budget) && budget > 0) return budget;
  return Number(row?.full_price || 0);
}

export function contractedValue(row: any): number {
  return Number(row?.full_price || 0);
}

/** A booking is priced but has no profit math done. Not a gap to fill — information. */
export function isProfitIncomplete(row: any): boolean {
  return Number(row?.full_price || 0) > 0 && Number(row?.gross_profit || 0) === 0;
}

/** Bookings whose status claims money arrived but carry no payment record. */
export function unrecordedDeposits(rows: any[]): any[] {
  return (rows || []).filter((r) => isConfirmed(r) && !r.deposit_paid);
}

export function lastWritten(rows: any[] | undefined | null): string | null {
  const times = (rows || [])
    .map((r) => r?.updated_at || r?.created_at)
    .filter(Boolean)
    .map((t: string) => new Date(t).getTime())
    .filter((n) => Number.isFinite(n));
  if (!times.length) return null;
  return new Date(Math.max(...times)).toISOString();
}

export function formatLastUpdated(iso: string | null): string {
  if (!iso) return 'no rows written';
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  const stamp = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  if (days <= 0) return `last written today`;
  return `last written ${stamp} (${days}d ago)`;
}

export const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
