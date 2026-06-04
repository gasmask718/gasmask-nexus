import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ═══════════════════════════════════════════════════════════════════════════════
// useStorePaymentStatus — per-store unpaid invoice rollup (live, not cached).
//
// Source: `invoices` (finalized, not soft-deleted, payment_status != 'paid').
// We intentionally do NOT use store_master.owed_amount — that column is stale
// across most rows (8/2144 populated vs many stores with real owed balances).
//
// Color logic (used by StorePaymentBadge):
//   none   → no finalized invoices, or 0 owed (paid up)             → green/neutral
//   amber  → $1–$199 owed AND oldest unpaid < 14 days               → warn
//   red    → ≥ $200 owed OR  oldest unpaid ≥ 14 days                → collect now
// ═══════════════════════════════════════════════════════════════════════════════

export interface StorePaymentStatus {
  owed: number;
  unpaidCount: number;
  oldestUnpaidDays: number | null;
  level: 'paid' | 'amber' | 'red';
}

const empty: StorePaymentStatus = { owed: 0, unpaidCount: 0, oldestUnpaidDays: null, level: 'paid' };

function classify(owed: number, oldestDays: number | null): StorePaymentStatus['level'] {
  if (owed <= 0) return 'paid';
  if (owed >= 200 || (oldestDays != null && oldestDays >= 14)) return 'red';
  return 'amber';
}

export function useStorePaymentStatusMap() {
  return useQuery({
    queryKey: ['store-payment-status-map'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('store_id, total, amount_paid, payment_status, finalized_at, created_at')
        .is('deleted_at', null)
        .not('finalized_at', 'is', null)
        .neq('payment_status', 'paid')
        .limit(5000);
      if (error) throw error;

      const map = new Map<string, StorePaymentStatus>();
      const now = Date.now();
      for (const inv of data ?? []) {
        const storeId = (inv as any).store_id as string | null;
        if (!storeId) continue;
        const owed = Math.max(Number((inv as any).total ?? 0) - Number((inv as any).amount_paid ?? 0), 0);
        if (owed <= 0) continue;
        const finalizedAt = (inv as any).finalized_at ?? (inv as any).created_at;
        const ageDays = finalizedAt
          ? Math.max(0, Math.floor((now - new Date(finalizedAt).getTime()) / 86_400_000))
          : null;
        const prev = map.get(storeId) ?? { owed: 0, unpaidCount: 0, oldestUnpaidDays: null, level: 'paid' as const };
        const oldest =
          ageDays == null
            ? prev.oldestUnpaidDays
            : prev.oldestUnpaidDays == null
            ? ageDays
            : Math.max(prev.oldestUnpaidDays, ageDays);
        const totalOwed = prev.owed + owed;
        map.set(storeId, {
          owed: totalOwed,
          unpaidCount: prev.unpaidCount + 1,
          oldestUnpaidDays: oldest,
          level: classify(totalOwed, oldest),
        });
      }
      return map;
    },
  });
}

export function useStorePaymentStatus(storeId: string | null | undefined): StorePaymentStatus {
  const { data } = useStorePaymentStatusMap();
  if (!storeId) return empty;
  return data?.get(storeId) ?? empty;
}
