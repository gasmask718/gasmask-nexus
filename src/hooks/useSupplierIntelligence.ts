import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useSupplierRankings() {
  return useQuery({
    queryKey: ['supplier-rankings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_supplier_rankings' as any)
        .select('*')
        .order('rank_overall');
      if (error) throw error;
      return data || [];
    },
  });
}

export function useSupplierAlerts() {
  return useQuery({
    queryKey: ['supplier-price-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_supplier_price_alerts' as any)
        .select('*')
        .order('severity', { ascending: false })
        .limit(25);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useSupplierProductScorecard(supplier: string) {
  return useQuery({
    queryKey: ['supplier-product-scorecard', supplier],
    enabled: !!supplier,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_supplier_product_scorecard' as any)
        .select('*')
        .eq('supplier_name', supplier)
        .order('overall_score', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}
