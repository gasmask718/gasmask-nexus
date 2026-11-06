import { supabase } from '@/integrations/supabase/client';

export type WorkItem = {
  item_id: string; type: string; at: string; day: string; store_id: string | null; title: string; detail: string | null;
  status: string | null; amount: number | null; extra: any; store_name: string | null; store_address: string | null; neighborhood: string | null;
};
export type WorkCounts = { stores_visited: number; new_stores: number; counts: number; orders: number; money: number; contacts: number; notes: number; voice?: number };
export type WorkSummary = {
  today: string; today_counts: WorkCounts; counts: WorkCounts; boxes: Record<string, number>; earnings_estimate: number;
  go_back: { store_id: string; store_name: string; store_address: string; last_visit_at: string | null; phone: string | null }[];
  follow_ups: { id: string; at: string; store_id: string; store_name: string; store_address: string; note: string; phone: string | null }[];
  last_interaction: { type: string; title: string; detail: string; at: string } | null;
};

export const rpc = (fn: string, args?: Record<string, unknown>) => (supabase as any).rpc(fn, args);

export const money = (n: number) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

/** "Today: 14 stores, 6 orders, $300 collected, 3 new stores." */
export function todayLine(c?: WorkCounts | null): string {
  if (!c) return 'Today: nothing logged yet.';
  const parts = [`${c.stores_visited} store${c.stores_visited === 1 ? '' : 's'}`, `${c.orders} order${c.orders === 1 ? '' : 's'}`, `${money(c.money)} collected`, `${c.new_stores} new store${c.new_stores === 1 ? '' : 's'}`];
  return `Today: ${parts.join(', ')}.`;
}

/** New York calendar date as YYYY-MM-DD, shifted by `offsetDays`. */
export function nyDate(offsetDays = 0, base = new Date()): string {
  const d = new Date(base.getTime() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d);
}

export type RangeKey = 'today' | 'week' | 'month' | 'all' | 'custom';
export function rangeDates(k: RangeKey, custom: { from: string; to: string }, base = new Date()): { from: string | null; to: string | null } {
  const today = nyDate(0, base);
  if (k === 'today') return { from: today, to: today };
  if (k === 'week') return { from: nyDate(-6, base), to: today };
  if (k === 'month') return { from: nyDate(-29, base), to: today };
  if (k === 'custom') return { from: custom.from || null, to: custom.to || null };
  return { from: null, to: null };
}
