import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BrandLifetime {
  brand: string;
  tubes: number;
  percentage: number;
}

export function useStoreLifetimeByBrand(storeId: string | null | undefined) {
  return useQuery({
    queryKey: ['store-lifetime-by-brand', storeId],
    enabled: !!storeId,
    staleTime: 60_000,
    queryFn: async (): Promise<BrandLifetime[]> => {
      if (!storeId) return [];

      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('id, brand')
        .eq('store_id', storeId)
        .is('deleted_at', null);
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

      const total = Array.from(byBrand.values()).reduce((s, v) => s + v, 0);
      return Array.from(byBrand.entries())
        .map(([brand, tubes]) => ({
          brand,
          tubes,
          percentage: total > 0 ? Math.round((tubes / total) * 100) : 0,
        }))
        .sort((a, b) => b.tubes - a.tubes);
    },
  });
}
