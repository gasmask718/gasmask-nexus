import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useStoreTubeKPI } from './useStoreTubeKPI';

/**
 * Per-SKU order history for a store.
 *
 * Source of truth:
 *  - `invoice_line_items` for invoices with live per-SKU detail
 *  - `historical_invoice_line_repairs` for legacy invoices with operator/
 *    price-map attribution (canonical view `v_invoice_effective_tubes`
 *    already unions these two; we read the underlying tables directly so
 *    we can surface per-SKU + confidence_level).
 *  - Finalized invoices that have neither are surfaced as "unattributed"
 *    so volume isn't fabricated.
 *
 * Query keys on `invoices.store_id` so post-merge survivors automatically
 * see ALL repointed invoices.
 */

const UNATTRIBUTED_LABEL = 'Unattributed legacy invoices';

export type SkuConfidenceTier = 'live' | 'verified' | 'estimated';

export interface SkuOrderHistoryRow {
  sku: string;
  brand: string | null;
  last_ordered_at: string; // ISO; '' for unattributed placeholder
  last_qty: number;
  lifetime_qty: number;
  order_count: number;
  live_count?: number;
  verified_count?: number;
  estimated_count?: number;
  unattributed?: boolean;
}

export interface SkuOrderHistoryResult {
  rows: SkuOrderHistoryRow[];
  totalInvoices: number;
  invoicesWithLineItems: number;
  invoicesVerified: number;
  invoicesEstimated: number;
  invoicesUnattributed: number;
}

interface SkuAcc extends SkuOrderHistoryRow {}

function tierFromRepair(method: string | null, conf: string | null): 'verified' | 'estimated' {
  if (method === 'manual_exact') return 'verified';
  if (conf === 'high') return 'verified';
  return 'estimated';
}

function upsert(
  map: Map<string, SkuAcc>,
  sku: string,
  brand: string | null,
  createdAt: string,
  qty: number,
  tier: SkuConfidenceTier,
) {
  const existing = map.get(sku);
  if (!existing) {
    map.set(sku, {
      sku,
      brand,
      last_ordered_at: createdAt,
      last_qty: qty,
      lifetime_qty: qty,
      order_count: 1,
      live_count: tier === 'live' ? 1 : 0,
      verified_count: tier === 'verified' ? 1 : 0,
      estimated_count: tier === 'estimated' ? 1 : 0,
    });
    return;
  }
  existing.lifetime_qty += qty;
  existing.order_count += 1;
  if (tier === 'live') existing.live_count = (existing.live_count || 0) + 1;
  if (tier === 'verified') existing.verified_count = (existing.verified_count || 0) + 1;
  if (tier === 'estimated') existing.estimated_count = (existing.estimated_count || 0) + 1;
  if (createdAt > existing.last_ordered_at) {
    existing.last_ordered_at = createdAt;
    existing.last_qty = qty;
  }
}

export function useStoreSkuOrderHistory(storeId: string | null) {
  return useQuery<SkuOrderHistoryResult>({
    queryKey: ['store-sku-order-history-v2', storeId],
    queryFn: async () => {
      if (!storeId)
        return {
          rows: [],
          totalInvoices: 0,
          invoicesWithLineItems: 0,
          invoicesVerified: 0,
          invoicesEstimated: 0,
          invoicesUnattributed: 0,
        };

      // 1) Invoices for this store
      const { data: invs, error: invErr } = await supabase
        .from('invoices')
        .select('id, created_at, status')
        .eq('store_id', storeId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1000);
      if (invErr) throw invErr;

      const finalized = (invs || []).filter((i: any) => i.status === 'finalized');
      const invDate = new Map<string, string>();
      finalized.forEach((i: any) => invDate.set(i.id, i.created_at));
      const finalIds = finalized.map((i: any) => i.id);

      if (finalIds.length === 0) {
        return {
          rows: [],
          totalInvoices: (invs || []).length,
          invoicesWithLineItems: 0,
          invoicesVerified: 0,
          invoicesEstimated: 0,
          invoicesUnattributed: 0,
        };
      }

      // 2) Live line items
      const { data: lineItems, error: liErr } = await supabase
        .from('invoice_line_items')
        .select(
          'invoice_id, product_name, product_name_snapshot, brand, brand_name_snapshot, quantity',
        )
        .in('invoice_id', finalIds);
      if (liErr) throw liErr;

      // 3) Repair attributions (join product name)
      const { data: repairs, error: rErr } = await supabase
        .from('historical_invoice_line_repairs')
        .select(
          'invoice_id, unit_count, attribution_method, confidence_level, products:product_id(name)',
        )
        .in('invoice_id', finalIds)
        .in('attribution_method', ['manual_exact', 'price_map_auto'])
        .not('unit_count', 'is', null);
      if (rErr) throw rErr;

      const invoicesWithLineItemsSet = new Set<string>();
      const invoicesWithRepairTier = new Map<string, 'verified' | 'estimated'>();

      const map = new Map<string, SkuAcc>();

      // Live line items
      for (const li of (lineItems || []) as any[]) {
        invoicesWithLineItemsSet.add(li.invoice_id);
        const createdAt = invDate.get(li.invoice_id);
        if (!createdAt) continue;
        const sku =
          (li.product_name_snapshot?.trim() ||
            li.product_name?.trim() ||
            'Unknown SKU') as string;
        const brand =
          (li.brand_name_snapshot?.trim() || li.brand?.trim() || null) as
            | string
            | null;
        upsert(map, sku, brand, createdAt, Number(li.quantity ?? 0), 'live');
      }

      // Repair attributions (skip invoices that have live items — view excludes them too)
      for (const r of (repairs || []) as any[]) {
        if (invoicesWithLineItemsSet.has(r.invoice_id)) continue;
        const createdAt = invDate.get(r.invoice_id);
        if (!createdAt) continue;
        const tier = tierFromRepair(r.attribution_method, r.confidence_level);
        const prior = invoicesWithRepairTier.get(r.invoice_id);
        // best tier wins per invoice for counting
        if (!prior || (prior === 'estimated' && tier === 'verified'))
          invoicesWithRepairTier.set(r.invoice_id, tier);

        const sku = (r.products?.name?.trim() || 'GasMask Tubes') as string;
        upsert(map, sku, 'GasMask', createdAt, Number(r.unit_count ?? 0), tier);
      }

      // Unattributed = finalized invoices in neither set
      const unattributedIds = finalIds.filter(
        (id) =>
          !invoicesWithLineItemsSet.has(id) && !invoicesWithRepairTier.has(id),
      );
      const invoicesUnattributed = unattributedIds.length;

      let invoicesVerified = 0;
      let invoicesEstimated = 0;
      invoicesWithRepairTier.forEach((t) => {
        if (t === 'verified') invoicesVerified += 1;
        else invoicesEstimated += 1;
      });

      const rows = Array.from(map.values()).sort((a, b) =>
        a.last_ordered_at < b.last_ordered_at ? 1 : -1,
      );

      // Surface a single honest row for truly-unattributed legacy invoices
      if (invoicesUnattributed > 0) {
        const mostRecent = unattributedIds
          .map((id) => invDate.get(id) || '')
          .sort()
          .reverse()[0];
        rows.push({
          sku: UNATTRIBUTED_LABEL,
          brand: null,
          last_ordered_at: mostRecent,
          last_qty: 0,
          lifetime_qty: 0,
          order_count: invoicesUnattributed,
          unattributed: true,
        });
      }

      return {
        rows,
        totalInvoices: (invs || []).length,
        invoicesWithLineItems: invoicesWithLineItemsSet.size,
        invoicesVerified,
        invoicesEstimated,
        invoicesUnattributed,
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
        (h) => (h.brand || '').toLowerCase() === b.brand_name.toLowerCase(),
      );
      return !hit;
    })
    .filter(
      (b, i, arr) => arr.findIndex((x) => x.brand_name === b.brand_name) === i,
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
    invoicesVerified: history.data?.invoicesVerified ?? 0,
    invoicesEstimated: history.data?.invoicesEstimated ?? 0,
    invoicesUnattributed: history.data?.invoicesUnattributed ?? 0,
  };
}
