import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { normalizeBrandId, CANONICAL_BRAND_IDS, CANONICAL_BRANDS, type CanonicalBrandId } from '@/config/brands';

// ═══════════════════════════════════════════════════════════════════════════════
// LAST ORDER SNAPSHOT INTELLIGENCE HOOK
// Derived read-only layer: most recent order per store × brand
// Source: v_store_last_order_snapshot (database view)
// BRAND COVERAGE: Always returns ALL 4 canonical brands per store,
// even if a brand has never been ordered ("Never ordered" placeholder).
// ═══════════════════════════════════════════════════════════════════════════════

export interface LastOrderSnapshot {
  store_id: string;
  store_name: string | null;
  brand_name: string;
  brand_key: string;
  canonical_brand_id: CanonicalBrandId | null;
  last_order_date: string;
  days_since_last_order: number;
  last_order_total_units: number;
  last_order_box_equivalent: number;
  last_order_size_label: string;
  last_order_total_amount: number | null;
  last_order_line_count: number | null;
  total_order_count: number;
  avg_tubes_per_order: number;
  avg_days_between_orders: number;
  is_restock_due: boolean;
  is_order_smaller_than_usual: boolean;
  /** True if this row is a placeholder (brand never ordered) */
  is_placeholder: boolean;
}

/** Create a placeholder snapshot for a brand that was never ordered */
function createPlaceholder(storeId: string, storeName: string | null, brandId: CanonicalBrandId): LastOrderSnapshot {
  const brand = CANONICAL_BRANDS[brandId];
  return {
    store_id: storeId,
    store_name: storeName,
    brand_name: brand.displayName,
    brand_key: brandId,
    canonical_brand_id: brandId,
    last_order_date: '',
    days_since_last_order: -1,
    last_order_total_units: 0,
    last_order_box_equivalent: 0,
    last_order_size_label: 'Never ordered',
    last_order_total_amount: null,
    last_order_line_count: null,
    total_order_count: 0,
    avg_tubes_per_order: 0,
    avg_days_between_orders: 0,
    is_restock_due: false,
    is_order_smaller_than_usual: false,
    is_placeholder: true,
  };
}

/**
 * Ensure all 4 canonical brands are represented for a store.
 * Actual data rows fill in, missing brands get placeholders.
 */
function ensureBrandCoverage(
  storeId: string,
  storeName: string | null,
  rows: LastOrderSnapshot[]
): LastOrderSnapshot[] {
  const byBrand = new Map<CanonicalBrandId, LastOrderSnapshot>();

  // Index actual rows by canonical brand
  for (const row of rows) {
    const cid = row.canonical_brand_id;
    if (cid) {
      const existing = byBrand.get(cid);
      if (!existing || (row.last_order_date && new Date(row.last_order_date) > new Date(existing.last_order_date))) {
        byBrand.set(cid, row);
      }
    }
  }

  // Build coverage: all 4 brands in canonical order
  const result: LastOrderSnapshot[] = [];
  for (const brandId of CANONICAL_BRAND_IDS) {
    result.push(byBrand.get(brandId) || createPlaceholder(storeId, storeName, brandId));
  }

  // Append any non-canonical rows (shouldn't happen but safe)
  for (const row of rows) {
    if (!row.canonical_brand_id) {
      result.push(row);
    }
  }

  return result;
}

/**
 * Fetch last order snapshot for a single store.
 * Returns one row per canonical brand (always 4+), with placeholders for never-ordered brands.
 */
export function useLastOrderSnapshot(storeId: string | null | undefined) {
  return useQuery({
    queryKey: ['last-order-snapshot', storeId],
    queryFn: async (): Promise<LastOrderSnapshot[]> => {
      if (!storeId) return [];

      const { data, error } = await supabase
        .from('v_store_last_order_snapshot' as any)
        .select('*')
        .eq('store_id', storeId);

      if (error) {
        console.error('[LOS] Failed to fetch:', error);
        throw error;
      }

      const rows: LastOrderSnapshot[] = ((data || []) as any[]).map((row) => ({
        ...row,
        canonical_brand_id: normalizeBrandId(row.brand_name),
        is_placeholder: false,
      }));

      // Get store name from first row if available
      const storeName = rows[0]?.store_name || null;
      return ensureBrandCoverage(storeId, storeName, rows);
    },
    enabled: !!storeId,
    staleTime: 30_000,
  });
}

/**
 * Batch fetch for multiple stores (directory views).
 * Returns Map<store_id, LastOrderSnapshot[]> with full brand coverage per store.
 */
export function useLastOrderSnapshotBatch(storeIds: string[]) {
  return useQuery({
    queryKey: ['last-order-snapshot-batch', storeIds.sort().join(',')],
    queryFn: async () => {
      if (!storeIds.length) return new Map<string, LastOrderSnapshot[]>();

      // Chunk to avoid URL length limits with .in() on large arrays
      const CHUNK_SIZE = 100;
      const chunks: string[][] = [];
      for (let i = 0; i < storeIds.length; i += CHUNK_SIZE) {
        chunks.push(storeIds.slice(i, i + CHUNK_SIZE));
      }

      const results = await Promise.all(
        chunks.map((chunk) =>
          supabase
            .from('v_store_last_order_snapshot' as any)
            .select('*')
            .in('store_id', chunk)
        )
      );

      const firstError = results.find((r) => r.error);
      if (firstError?.error) {
        console.error('[LOS-BATCH] Failed to fetch:', firstError.error);
        throw firstError.error;
      }

      const data = results.flatMap((r) => r.data || []);

      // Group raw rows by store
      const rawMap = new Map<string, LastOrderSnapshot[]>();
      for (const row of (data || []) as any[]) {
        const enriched: LastOrderSnapshot = {
          ...row,
          canonical_brand_id: normalizeBrandId(row.brand_name),
          is_placeholder: false,
        };
        const existing = rawMap.get(row.store_id) || [];
        existing.push(enriched);
        rawMap.set(row.store_id, existing);
      }

      // Build final map with brand coverage for ALL requested stores
      const result = new Map<string, LastOrderSnapshot[]>();
      for (const sid of storeIds) {
        const rows = rawMap.get(sid) || [];
        const storeName = rows[0]?.store_name || null;
        result.set(sid, ensureBrandCoverage(sid, storeName, rows));
      }
      return result;
    },
    enabled: storeIds.length > 0,
    staleTime: 30_000,
  });
}
