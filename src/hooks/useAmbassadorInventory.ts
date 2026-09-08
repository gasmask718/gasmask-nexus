import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Ambassador-side inventory claims, read-only from public.store_tube_inventory_status.
 *
 * Brand note: no single GasMask/Grabba brand covers the store base — the rows are
 * spread across 9 SKU brand_ids (GasMask Tubes 656 stores, GasMask Bags 564,
 * HotMama 560, Grabba R Us 557, Hot Scolatti ...). So we aggregate ALL brands per
 * store: tubes = sum of current_tubes_left, needs_order = any brand flagged, and
 * "last updated" = the most recent row for that store across brands.
 */
/**
 * Human vs system split (Stage 5).
 *
 * Only these methods are a confirmed person standing in a store. Everything else
 * (null, 'system', tube_inv_v4_*, bag_backfill_*, legacy_table_merge*) is an
 * automated pipeline touch — verified by data: e.g. 378 of the 379
 * 'tube_inv_v4_explicit' rows were written in a single minute (2026-08-20 07:52)
 * with no user and no role, and no code path in this repo writes that label.
 */
export const HUMAN_METHODS = ['in_person', 'owner_confirmed_bags_returned'] as const;
export const HUMAN_METHOD_LABEL = "'in_person' and 'owner_confirmed_bags_returned'";

export function isHumanMethod(m: string | null | undefined): boolean {
  return !!m && (HUMAN_METHODS as readonly string[]).includes(m);
}

export interface StoreInventoryClaim {
  store_id: string;
  tubes_left: number;
  needs_order: boolean;
  brands_tracked: number;
  /** Most recent confirmed human check-in across brands, or null if there never was one. */
  last_human_update: string | null;
  last_human_by: string | null;
  last_human_method: string | null;
  /** Most recent row overall regardless of method — secondary context only. */
  last_system_update: string | null;
}


export const STALE_DAYS = 30;
export const RECENT_DAYS = 60;

export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 86_400_000);
}

/** "Updated 3 days ago" / "Updated today" / "Never updated". */
export function stalenessLabel(iso: string | null | undefined): string {
  const d = daysSince(iso);
  if (d === null) return 'Never updated';
  if (d <= 0) return 'Updated today';
  if (d === 1) return 'Updated yesterday';
  return `Updated ${d} days ago`;
}

export function isStale(iso: string | null | undefined): boolean {
  const d = daysSince(iso);
  return d === null || d > STALE_DAYS;
}

const PAGE = 1000;

export function useAmbassadorInventory() {
  return useQuery({
    queryKey: ['fv-ambassador-inventory'],
    staleTime: 60_000,
    queryFn: async (): Promise<Map<string, StoreInventoryClaim>> => {
      const rows: any[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('store_tube_inventory_status')
          .select('store_id, current_tubes_left, needs_order, last_updated_at, last_updated_by')
          .eq('is_simulation', false)
          .range(from, from + PAGE - 1);
        if (error) throw error;
        rows.push(...(data ?? []));
        if (!data || data.length < PAGE) break;
      }

      const byStore = new Map<string, StoreInventoryClaim>();
      for (const r of rows) {
        if (!r.store_id) continue;
        const cur = byStore.get(r.store_id) ?? {
          store_id: r.store_id,
          tubes_left: 0,
          needs_order: false,
          brands_tracked: 0,
          last_updated_at: null,
          last_updated_by: null,
        };
        cur.tubes_left += Number(r.current_tubes_left ?? 0);
        cur.needs_order = cur.needs_order || !!r.needs_order;
        cur.brands_tracked += 1;
        const stamp = r.last_updated_at ?? null;
        if (stamp && (!cur.last_updated_at || stamp > cur.last_updated_at)) {
          cur.last_updated_at = stamp;
          cur.last_updated_by = r.last_updated_by ?? null;
        }
        byStore.set(r.store_id, cur);
      }
      return byStore;
    },
  });
}

/** uuid -> display name, from `profiles` (same two-query pattern as Stage 3). */
export function useProfileNames(ids: string[]) {
  const key = Array.from(new Set(ids.filter(Boolean))).sort();
  return useQuery({
    queryKey: ['fv-profile-names', key],
    enabled: key.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Map<string, string>> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', key);
      if (error) throw error;
      const m = new Map<string, string>();
      (data ?? []).forEach((p: any) => {
        m.set(p.id, p.name || p.email || `User ${String(p.id).slice(0, 8)}…`);
      });
      return m;
    },
  });
}
