import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useStoreTubeKPI } from './useStoreTubeKPI';

/**
 * Per-SKU order history for a store.
 *
 * Data sources:
 *  1. `invoice_line_items` — modern invoices have full per-SKU detail.
 *  2. Finalized invoices WITHOUT line items (legacy header-totals) are
 *     attributed to the canonical legacy SKU "GasMask Tubes" — the only
 *     product GasMask Wholesale sold during the legacy era. Variant detail
 *     (Bags / Redtops / etc.) is not recoverable for these rows; they are
 *     counted as orders against GasMask Tubes with an "attributed" marker.
 *
 * IMPORTANT: query is on `invoices.store_id` (the live store id) — so
 * post-merge survivors automatically see ALL repointed invoices.
 */

const LEGACY_ATTRIBUTION_SKU = 'GasMask Tubes';
const LEGACY_ATTRIBUTION_BRAND = 'GasMask';

export interface SkuOrderHistoryRow {
  sku: string;
  brand: string | null;
  last_ordered_at: string; // ISO
  last_qty: number;
  lifetime_qty: number;
  order_count: number;
  legacy_attributed_count?: number; // legacy invoices folded into this row
}

export interface SkuOrderHistoryResult {
  rows: SkuOrderHistoryRow[];
  totalInvoices: number;
  invoicesWithLineItems: number;
  legacyAttributedInvoices: number;
}

export function useStoreSkuOrderHistory(storeId: string | null) {
  return useQuery<SkuOrderHistoryResult>({
    queryKey: ['store-sku-order-history', storeId],
    queryFn: async () => {
      if (!storeId)
        return {
          rows: [] as SkuOrderHistoryRow[],
          totalInvoices: 0,
          invoicesWithLineItems: 0,
          legacyAttributedInvoices: 0,
        };

      const { data, error } = await supabase
        .from('invoices')
        .select(
          `
          id,
          created_at,
          deleted_at,
          status,
          total_tubes_sold,
          invoice_line_items (
            product_name,
            product_name_snapshot,
            brand,
            brand_name_snapshot,
            quantity
          )
        `
        )
        .eq('store_id', storeId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      const map = new Map<string, SkuOrderHistoryRow>();
      let legacyAttributedInvoices = 0;

      const upsert = (
        sku: string,
        brand: string | null,
        createdAt: string,
        qty: number,
        isLegacy: boolean,
      ) => {
        const existing = map.get(sku);
        if (!existing) {
          map.set(sku, {
            sku,
            brand,
            last_ordered_at: createdAt,
            last_qty: qty,
            lifetime_qty: qty,
            order_count: 1,
            legacy_attributed_count: isLegacy ? 1 : 0,
          });
        } else {
          existing.lifetime_qty += qty;
          existing.order_count += 1;
          if (isLegacy)
            existing.legacy_attributed_count =
              (existing.legacy_attributed_count || 0) + 1;
          if (createdAt > existing.last_ordered_at) {
            existing.last_ordered_at = createdAt;
            existing.last_qty = qty;
          }
        }
      };

      for (const inv of data || []) {
        const anyInv = inv as any;
        const createdAt = anyInv.created_at as string;
        const items = (anyInv.invoice_line_items || []) as Array<{
          product_name?: string | null;
          product_name_snapshot?: string | null;
          brand?: string | null;
          brand_name_snapshot?: string | null;
          quantity?: number | null;
        }>;

        if (items.length > 0) {
          for (const li of items) {
            const sku =
              li.product_name_snapshot?.trim() ||
              li.product_name?.trim() ||
              'Unknown SKU';
            const brand =
              li.brand_name_snapshot?.trim() || li.brand?.trim() || null;
            upsert(sku, brand, createdAt, Number(li.quantity ?? 0), false);
          }
        } else if (anyInv.status === 'finalized') {
          // Legacy header-only finalized invoice → attribute to GasMask Tubes.
          legacyAttributedInvoices += 1;
          const qty = Number(anyInv.total_tubes_sold ?? 0);
          upsert(
            LEGACY_ATTRIBUTION_SKU,
            LEGACY_ATTRIBUTION_BRAND,
            createdAt,
            qty,
            true,
          );
        }
      }

      return {
        rows: Array.from(map.values()).sort((a, b) =>
          a.last_ordered_at < b.last_ordered_at ? 1 : -1
        ),
        totalInvoices: (data || []).length,
        invoicesWithLineItems: (data || []).filter(
          (inv: any) => (inv.invoice_line_items || []).length > 0
        ).length,
        legacyAttributedInvoices,
      };
    },
    enabled: !!storeId,
    staleTime: 30_000,
  });
}

export interface SkuOrderHistoryWithGaps extends SkuOrderHistoryRow {
  never_ordered?: boolean;
}

export function useStoreSkuOrderHistoryWithGaps(storeId: string | null) {
  const history = useStoreSkuOrderHistory(storeId);
  const kpi = useStoreTubeKPI(storeId);

  const historyRows = history.data?.rows ?? [];

  const gapRows: SkuOrderHistoryWithGaps[] = (kpi.data || [])
    .filter((b) => {
      const hit = historyRows.some(
        (h) => (h.brand || '').toLowerCase() === b.brand_name.toLowerCase()
      );
      return !hit;
    })
    .filter(
      (b, i, arr) => arr.findIndex((x) => x.brand_name === b.brand_name) === i
    )
    .map((b) => ({
      sku: `${b.brand_name} (no SKU on file)`,
      brand: b.brand_name,
      last_ordered_at: '',
      last_qty: 0,
      lifetime_qty: 0,
      order_count: 0,
      never_ordered: true,
    }));

  return {
    isLoading: history.isLoading || kpi.isLoading,
    error: history.error || kpi.error,
    rows: [...(historyRows as SkuOrderHistoryWithGaps[]), ...gapRows],
    totalInvoices: history.data?.totalInvoices ?? 0,
    invoicesWithLineItems: history.data?.invoicesWithLineItems ?? 0,
    legacyAttributedInvoices: history.data?.legacyAttributedInvoices ?? 0,
  };
}
