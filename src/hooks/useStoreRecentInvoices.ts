import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RecentInvoiceRow {
  id: string;
  invoice_number: string | null;
  brand: string | null;
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
    queryKey: ['store-recent-invoices', storeId, limit],
    enabled: !!storeId,
    staleTime: 60_000,
    queryFn: async (): Promise<RecentInvoiceRow[]> => {
      if (!storeId) return [];

      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, brand, total, created_at')
        .eq('store_id', storeId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      if (!invoices?.length) return [];

      const invoiceIds = invoices.map((i) => i.id);
      const { data: tubeRows, error: tubeErr } = await supabase
        .from('v_invoice_effective_tubes')
        .select('invoice_id, tube_count')
        .in('invoice_id', invoiceIds);
      if (tubeErr) throw tubeErr;

      const tubesByInvoice = new Map<string, number>();
      tubeRows?.forEach((tr) => {
        const id = tr.invoice_id as string;
        tubesByInvoice.set(id, (tubesByInvoice.get(id) ?? 0) + Number(tr.tube_count ?? 0));
      });

      return invoices.map((i) => {
        const tubes = tubesByInvoice.get(i.id) ?? 0;
        return {
          id: i.id,
          invoice_number: i.invoice_number,
          brand: i.brand,
          total: Number(i.total ?? 0),
          tubes,
          boxes: Math.round(tubes / 100),
          created_at: i.created_at,
        };
      });
    },
  });
}
