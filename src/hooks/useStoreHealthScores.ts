import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface StoreHealthScore {
  id: string;
  store_id: string;
  overall_score: number;
  health_status: string;
  dimension_scores: {
    visit: number;
    compliance: number;
    tube: number;
    interest: number;
    notes: number;
    invoice: number;
  };
  dimension_explanations: Record<string, string>;
  last_visit_date: string | null;
  total_visits_30d: number;
  calculated_at: string;
  store_name?: string;
}

export function useStoreHealthScores(options?: { limit?: number; status?: string }) {
  return useQuery({
    queryKey: ['store-health-scores', options],
    queryFn: async () => {
      let query = (supabase as any).from('store_health_scores')
        .select('*')
        .order('overall_score', { ascending: true });

      if (options?.status) query = query.eq('health_status', options.status);
      if (options?.limit) query = query.limit(options.limit);

      const { data, error } = await query;
      if (error) throw error;

      // Enrich with store names
      if (data?.length) {
        const storeIds = data.map((s: any) => s.store_id);
        const { data: stores } = await supabase.from('store_master').select('id, store_name').in('id', storeIds);
        const nameMap = Object.fromEntries((stores || []).map((s: any) => [s.id, s.store_name]));
        return data.map((s: any) => ({ ...s, store_name: nameMap[s.store_id] || 'Unknown' })) as StoreHealthScore[];
      }
      return (data || []) as StoreHealthScore[];
    },
  });
}

export function useStoreHealthScore(storeId?: string) {
  return useQuery({
    queryKey: ['store-health-score', storeId],
    queryFn: async () => {
      if (!storeId) return null;
      const { data, error } = await (supabase as any).from('store_health_scores')
        .select('*')
        .eq('store_id', storeId)
        .maybeSingle();
      if (error) throw error;
      return data as StoreHealthScore | null;
    },
    enabled: !!storeId,
  });
}

export function useCalculateHealthScores() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (storeId?: string) => {
      const { data, error } = await supabase.functions.invoke('calculate-health-scores', {
        body: storeId ? { store_id: storeId } : {},
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['store-health-scores'] });
      queryClient.invalidateQueries({ queryKey: ['store-health-score'] });
      toast.success(`Health scores calculated for ${data?.calculated || 0} stores`);
    },
    onError: (e: any) => {
      toast.error(e.message || 'Failed to calculate health scores');
    },
  });
}

export function useProductIntelligence() {
  return useQuery({
    queryKey: ['product-intelligence'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_tube_intelligence')
        .select('product_name, tube_count, status, interest, store_id, visit_date');
      if (error) throw error;

      const products: Record<string, {
        name: string;
        totalTubes: number;
        storeCount: number;
        zeroStockStores: number;
        interestedCount: number;
        notInterestedCount: number;
        totalSignals: number;
      }> = {};

      for (const item of data || []) {
        if (!item.product_name) continue;
        if (!products[item.product_name]) {
          products[item.product_name] = {
            name: item.product_name,
            totalTubes: 0, storeCount: 0, zeroStockStores: 0,
            interestedCount: 0, notInterestedCount: 0, totalSignals: 0,
          };
        }
        const p = products[item.product_name];
        p.storeCount++;
        p.totalTubes += item.tube_count || 0;
        if (item.status === 'active' && (item.tube_count || 0) === 0) p.zeroStockStores++;
        if (item.interest === 'Interested') p.interestedCount++;
        if (item.interest === 'Not Interested') p.notInterestedCount++;
        if (item.interest) p.totalSignals++;
      }

      return Object.values(products).sort((a, b) => b.totalTubes - a.totalTubes);
    },
  });
}
