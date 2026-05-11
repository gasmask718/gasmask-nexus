import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { skuDisplayName } from '@/lib/inventory/skuDisplay';

export interface RecentInvoiceRow {
  id: string;
  invoice_number: string | null;
  brand: string | null; // primary SKU label derived from line items (largest tube share)
  total: number;
  tubes: number;
  boxes: number;
  created_at: string;
}

export function useStoreRecentInvoices(
  storeId: string | null | undefined,
  limit: number = 5,
) {
  return useQuery({
    queryKey: ['store-recent-invoices-sku', storeId, limit],
    enabled: !!storeId,
    staleTime: 60_000,
    queryFn: async (): Promise<RecentInvoiceRow[]> => {
      if (!storeId) return [];

      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, total, created_at')
        .eq('store_id', storeId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      if (!invoices?.length) return [];

      const invoiceIds = invoices.map((i) => i.id);
      const { data: lineItems, error: liErr } = await supabase
        .from('invoice_line_items')
        .select('invoice_id, product_id, product_name, product_name_snapshot, computed_tubes_total')
        .in('invoice_id', invoiceIds);
      if (liErr) throw liErr;

      // Per-invoice tube total + per-invoice top SKU
      const tubesByInvoice = new Map<string, number>();
      const skuTubesByInvoice = new Map<string, Map<string, number>>();
      lineItems?.forEach((li) => {
        const id = li.invoice_id as string;
        const tubes = Number(li.computed_tubes_total ?? 0);
        tubesByInvoice.set(id, (tubesByInvoice.get(id) ?? 0) + tubes);
        const skuLabel = skuDisplayName(li.product_id, li.product_name_snapshot ?? li.product_name);
        const inner = skuTubesByInvoice.get(id) ?? new Map<string, number>();
        inner.set(skuLabel, (inner.get(skuLabel) ?? 0) + tubes);
        skuTubesByInvoice.set(id, inner);
      });

      return invoices.map((i) => {
        const tubes = tubesByInvoice.get(i.id) ?? 0;
        const skuMap = skuTubesByInvoice.get(i.id);
        let topSku: string | null = null;
        if (skuMap && skuMap.size) {
          const sorted = Array.from(skuMap.entries()).sort((a, b) => b[1] - a[1]);
          topSku = sorted[0][0];
          if (skuMap.size > 1) topSku = `${topSku} +${skuMap.size - 1}`;
        }
        return {
          id: i.id,
          invoice_number: i.invoice_number,
          brand: topSku,
          total: Number(i.total ?? 0),
          tubes,
          boxes: Math.round(tubes / 100),
          created_at: i.created_at,
        };
      });
    },
  });
}
