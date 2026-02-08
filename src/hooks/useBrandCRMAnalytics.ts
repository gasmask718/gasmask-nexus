/**
 * useBrandCRMAnalytics — Brand-scoped sell-through analytics hook.
 * Queries v_global_sell_through_analytics filtered by canonical brand ID.
 * Returns enriched rows with store_master location data + computed KPIs.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CanonicalBrandId, normalizeBrandId, getBrandDisplayName } from '@/config/brands';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface BrandCRMStoreRow {
  store_id: string;
  store_name: string;
  city: string | null;
  state: string | null;
  borough: string | null;
  address: string | null;
  status: string;
  assigned_ambassador_id: string | null;
  ambassador_name: string | null;
  // Sell-through analytics
  brand_name: string;
  total_orders_lifetime: number;
  total_revenue_lifetime: number;
  total_tubes_lifetime: number;
  first_order_date: string | null;
  last_order_date: string | null;
  days_since_last_order: number | null;
  avg_days_between_orders: number | null;
  orders_last_30d: number;
  orders_last_90d: number;
  revenue_last_30d: number | null;
  revenue_last_90d: number | null;
  order_frequency_class: string;
  projected_next_order: string | null;
  // Computed
  is_overdue: boolean;
  health_status: 'healthy' | 'at-risk' | 'critical' | 'new';
}

export interface BrandCRMKPIs {
  totalStores: number;
  activeStores: number;
  inactiveStores: number;
  overdueStores: number;
  totalOrders: number;
  totalRevenue: number;
  avgReorderGap: number;
  ordersLast30d: number;
  revenueLast30d: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH CLASSIFIER
// ═══════════════════════════════════════════════════════════════════════════════

function classifyHealth(row: {
  days_since_last_order: number | null;
  avg_days_between_orders: number | null;
  total_orders_lifetime: number;
}): 'healthy' | 'at-risk' | 'critical' | 'new' {
  if (row.total_orders_lifetime <= 1) return 'new';
  if (!row.days_since_last_order || !row.avg_days_between_orders) return 'new';
  
  const ratio = row.days_since_last_order / row.avg_days_between_orders;
  if (ratio <= 1.3) return 'healthy';
  if (ratio <= 2.0) return 'at-risk';
  return 'critical';
}

function isOverdue(row: {
  days_since_last_order: number | null;
  avg_days_between_orders: number | null;
  total_orders_lifetime: number;
}): boolean {
  if (row.total_orders_lifetime <= 1) return false;
  if (!row.days_since_last_order || !row.avg_days_between_orders) return false;
  return row.days_since_last_order > row.avg_days_between_orders * 1.5;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useBrandCRMAnalytics(brandId: CanonicalBrandId | null) {
  // Fetch sell-through data for this brand
  const sellThroughQuery = useQuery({
    queryKey: ['brand-crm-analytics', brandId],
    queryFn: async () => {
      if (!brandId) return [];

      const PAGE_SIZE = 1000;
      const allRows: any[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('v_global_sell_through_analytics' as any)
          .select('*')
          .eq('brand_name', brandId)
          .order('days_since_last_order', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) throw error;
        allRows.push(...(data || []));
        hasMore = (data?.length || 0) >= PAGE_SIZE;
        offset += PAGE_SIZE;
      }

      return allRows;
    },
    enabled: !!brandId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch store_master data for enrichment (location, status, ambassador)
  const storeMasterQuery = useQuery({
    queryKey: ['brand-crm-store-master'],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      const allStores: any[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('store_master')
          .select('id, store_name, address, city, state, zip, borough_id, health_status, assigned_ambassador_id, is_simulation')
          .eq('is_simulation', false)
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) throw error;
        allStores.push(...(data || []));
        hasMore = (data?.length || 0) >= PAGE_SIZE;
        offset += PAGE_SIZE;
      }

      return allStores;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch ambassador names
  const ambassadorQuery = useQuery({
    queryKey: ['brand-crm-ambassadors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassadors')
        .select('id, name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  // Merge sell-through + store_master into enriched rows
  const storeRows: BrandCRMStoreRow[] = (() => {
    if (!sellThroughQuery.data || !storeMasterQuery.data) return [];

    const storeMap = new Map<string, any>();
    for (const sm of storeMasterQuery.data) {
      storeMap.set(sm.id, sm);
    }

    const ambassadorMap = new Map<string, string>();
    for (const amb of (ambassadorQuery.data || []) as any[]) {
      ambassadorMap.set(amb.id, amb.name || 'Unknown');
    }

    return sellThroughQuery.data.map((row: any) => {
      const sm = storeMap.get(row.store_id);
      const ambassadorId = sm?.assigned_ambassador_id || null;
      
      return {
        store_id: row.store_id,
        store_name: row.store_name || sm?.store_name || 'Unknown',
        city: sm?.city || row.city || null,
        state: sm?.state || row.state || null,
        borough: null, // Could be enriched from borough_id
        address: sm?.address || null,
        status: sm?.health_status || 'active',
        assigned_ambassador_id: ambassadorId,
        ambassador_name: ambassadorId ? ambassadorMap.get(ambassadorId) || null : null,
        brand_name: row.brand_name,
        total_orders_lifetime: row.total_orders_lifetime || 0,
        total_revenue_lifetime: row.total_revenue_lifetime || 0,
        total_tubes_lifetime: row.total_tubes_lifetime || 0,
        first_order_date: row.first_order_date,
        last_order_date: row.last_order_date,
        days_since_last_order: row.days_since_last_order,
        avg_days_between_orders: row.avg_days_between_orders,
        orders_last_30d: row.orders_last_30d || 0,
        orders_last_90d: row.orders_last_90d || 0,
        revenue_last_30d: row.revenue_last_30d || 0,
        revenue_last_90d: row.revenue_last_90d || 0,
        order_frequency_class: row.order_frequency_class || 'New',
        projected_next_order: row.projected_next_order,
        is_overdue: isOverdue(row),
        health_status: classifyHealth(row),
      } as BrandCRMStoreRow;
    });
  })();

  // Compute KPIs
  const kpis: BrandCRMKPIs = (() => {
    if (!storeRows.length) {
      return {
        totalStores: 0,
        activeStores: 0,
        inactiveStores: 0,
        overdueStores: 0,
        totalOrders: 0,
        totalRevenue: 0,
        avgReorderGap: 0,
        ordersLast30d: 0,
        revenueLast30d: 0,
      };
    }

    const activeStores = storeRows.filter(r => r.health_status !== 'critical');
    const overdueStores = storeRows.filter(r => r.is_overdue);
    const totalOrders = storeRows.reduce((s, r) => s + r.total_orders_lifetime, 0);
    const totalRevenue = storeRows.reduce((s, r) => s + r.total_revenue_lifetime, 0);
    const ordersLast30d = storeRows.reduce((s, r) => s + r.orders_last_30d, 0);
    const revenueLast30d = storeRows.reduce((s, r) => s + (r.revenue_last_30d || 0), 0);
    const gapRows = storeRows.filter(r => r.avg_days_between_orders && r.avg_days_between_orders > 0);
    const avgGap = gapRows.length > 0
      ? gapRows.reduce((s, r) => s + (r.avg_days_between_orders || 0), 0) / gapRows.length
      : 0;

    return {
      totalStores: storeRows.length,
      activeStores: activeStores.length,
      inactiveStores: storeRows.length - activeStores.length,
      overdueStores: overdueStores.length,
      totalOrders: totalOrders,
      totalRevenue: totalRevenue,
      avgReorderGap: Math.round(avgGap),
      ordersLast30d,
      revenueLast30d,
    };
  })();

  return {
    storeRows,
    kpis,
    isLoading: sellThroughQuery.isLoading || storeMasterQuery.isLoading,
    isError: sellThroughQuery.isError || storeMasterQuery.isError,
    refetch: () => {
      sellThroughQuery.refetch();
      storeMasterQuery.refetch();
    },
  };
}
