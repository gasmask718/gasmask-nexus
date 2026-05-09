// Single-store fetch from v_store_tube_summary
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StoreTubeSummary {
  store_id: string;
  store_name: string | null;
  neighborhood: string | null;
  boro: string | null;
  address_zip: string | null;
  status: string | null;
  assigned_ambassador_id: string | null;
  lifetime_tubes_delivered: number | null;
  lifetime_tubes_sold: number | null;
  lifetime_invoice_revenue: number | null;
  invoice_count: number | null;
  current_inventory_count: number | null;
  tubes_last_30_days: number | null;
  tubes_this_month: number | null;
  tubes_last_90_days: number | null;
  top_brand: string | null;
  restock_status: string | null;
  last_tube_transaction_at: string | null;
  tubes_prior_month: number | null;
  tubes_mom_delta_pct: number | null;
}

export function useStoreTubeSummary(storeId: string | undefined | null) {
  return useQuery({
    queryKey: ['store-tube-summary', storeId],
    enabled: !!storeId,
    staleTime: 60_000,
    queryFn: async (): Promise<StoreTubeSummary | null> => {
      const { data, error } = await supabase
        .from('v_store_tube_summary' as any)
        .select('*')
        .eq('store_id', storeId)
        .maybeSingle();
      if (error) throw new Error(`STORE_TUBE_SUMMARY_FAILED: ${error.message}`);
      return (data as unknown as StoreTubeSummary) || null;
    },
  });
}
