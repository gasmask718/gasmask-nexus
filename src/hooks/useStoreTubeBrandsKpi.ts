// Per-brand KPI for a store: combines on-hand (v_store_tube_kpi) with
// lifetime + 30-day sold (tube_sale_ledger).
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StoreTubeBrandKpi {
  brand_id: string;
  brand_name: string;
  on_hand: number;
  sold_lifetime: number;
  sold_30d: number;
  last_order_date: string | null;
}

export function useStoreTubeBrandsKpi(storeId: string | undefined | null) {
  return useQuery({
    queryKey: ['store-tube-brands-kpi', storeId],
    enabled: !!storeId,
    staleTime: 60_000,
    queryFn: async (): Promise<StoreTubeBrandKpi[]> => {
      const [kpiRes, ledgerRes] = await Promise.all([
        supabase
          .from('v_store_tube_kpi' as any)
          .select('brand_id, brand_name, tube_count, last_order_date')
          .eq('store_id', storeId),
        supabase
          .from('tube_sale_ledger' as any)
          .select('brand, tubes_delta, created_at')
          .eq('store_id', storeId),
      ]);
      if (kpiRes.error) throw new Error(`TUBE_KPI_FAILED: ${kpiRes.error.message}`);
      if (ledgerRes.error) throw new Error(`TUBE_LEDGER_FAILED: ${ledgerRes.error.message}`);

      const since30 = Date.now() - 30 * 24 * 3600_000;
      const ledger = (ledgerRes.data || []) as unknown as Array<{ brand: string | null; tubes_delta: number; created_at: string }>;
      const ledgerByBrand = new Map<string, { lifetime: number; d30: number }>();
      for (const row of ledger) {
        const key = (row.brand || '').toLowerCase().trim();
        if (!key) continue;
        const acc = ledgerByBrand.get(key) || { lifetime: 0, d30: 0 };
        acc.lifetime += Number(row.tubes_delta || 0);
        if (new Date(row.created_at).getTime() >= since30) acc.d30 += Number(row.tubes_delta || 0);
        ledgerByBrand.set(key, acc);
      }

      const kpiRows = (kpiRes.data || []) as unknown as Array<{
        brand_id: string; brand_name: string; tube_count: number | null; last_order_date: string | null;
      }>;

      const seen = new Set<string>();
      const out: StoreTubeBrandKpi[] = kpiRows.map(r => {
        const key = (r.brand_id || r.brand_name || '').toLowerCase().trim();
        seen.add(key);
        const led = ledgerByBrand.get(key) || ledgerByBrand.get((r.brand_name || '').toLowerCase().trim()) || { lifetime: 0, d30: 0 };
        return {
          brand_id: r.brand_id,
          brand_name: r.brand_name,
          on_hand: Number(r.tube_count || 0),
          sold_lifetime: led.lifetime,
          sold_30d: led.d30,
          last_order_date: r.last_order_date,
        };
      });

      // Surface brands present in ledger but missing from KPI view
      for (const [key, led] of ledgerByBrand.entries()) {
        if (seen.has(key)) continue;
        if (led.lifetime <= 0) continue;
        out.push({
          brand_id: key,
          brand_name: key.replace(/(^|\s)\S/g, c => c.toUpperCase()),
          on_hand: 0,
          sold_lifetime: led.lifetime,
          sold_30d: led.d30,
          last_order_date: null,
        });
      }

      out.sort((a, b) => b.sold_lifetime - a.sold_lifetime);
      return out;
    },
  });
}
