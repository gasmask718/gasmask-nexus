import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BrandWindowSold {
  brand: string;
  tubes: number;
}

export type SalesWindow = 'last_30_days' | 'prior_month' | 'this_month';

export function useStoreSoldByBrandWindow(
  storeId: string | null | undefined,
  window: SalesWindow,
) {
  return useQuery({
    queryKey: ['store-sold-by-brand-window', storeId, window],
    enabled: !!storeId,
    staleTime: 60_000,
    queryFn: async (): Promise<BrandWindowSold[]> => {
      if (!storeId) return [];

      const now = new Date();
      let startDate: Date;
      let endDate: Date = now;

      if (window === 'last_30_days') {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 30);
      } else if (window === 'this_month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      }

      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('id, brand, created_at')
        .eq('store_id', storeId)
        .is('deleted_at', null)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());
      if (error) throw error;
      if (!invoices?.length) return [];

      const invoiceIds = invoices.map((i) => i.id);
      const brandByInvoice = new Map<string, string>();
      invoices.forEach((i) => brandByInvoice.set(i.id, i.brand || 'Unknown'));

      const { data: tubeRows, error: tubeErr } = await supabase
        .from('v_invoice_effective_tubes')
        .select('invoice_id, tube_count')
        .in('invoice_id', invoiceIds);
      if (tubeErr) throw tubeErr;

      const byBrand = new Map<string, number>();
      tubeRows?.forEach((tr) => {
        const brand = brandByInvoice.get(tr.invoice_id as string) || 'Unknown';
        byBrand.set(brand, (byBrand.get(brand) ?? 0) + Number(tr.tube_count ?? 0));
      });

      return Array.from(byBrand.entries())
        .map(([brand, tubes]) => ({ brand, tubes }))
        .sort((a, b) => b.tubes - a.tubes);
    },
  });
}
