import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface StoreRevenueScore {
  id: string;
  store_id: string;
  business_id: string | null;
  vertical_id: string | null;
  snapshot_date: string;
  heat_score: number | null;
  churn_risk: number | null;
  order_prob_7d: number | null;
  avg_order_value: number | null;
  revenue_30d: number | null;
  revenue_90d: number | null;
  order_count_30d: number | null;
  order_count_90d: number | null;
  last_order_at: string | null;
  predicted_next_order_at: string | null;
  restock_window_start: string | null;
  restock_window_end: string | null;
  communication_score: number | null;
  sentiment_score: number | null;
  deal_activity_score: number | null;
  follow_up_intensity: number | null;
  tags: string[] | null;
  created_at: string;
}

export interface StoreRevenueRecommendation {
  id: string;
  store_id: string;
  business_id: string | null;
  vertical_id: string | null;
  score_snapshot_id: string | null;
  priority: number;
  reason: string | null;
  recommended_action: string | null;
  recommended_brand: string | null;
  recommended_offer: Record<string, unknown> | null;
  notes: string | null;
  synced_to_followup: boolean;
  followup_id: string | null;
  created_at: string;
  expires_at: string | null;
}

export function useStoreRevenueScore(storeId: string | undefined) {
  return useQuery({
    queryKey: ['store-revenue-score', storeId],
    queryFn: async () => {
      if (!storeId) return null;
      
      const { data, error } = await supabase
        .from('store_revenue_scores')
        .select('*')
        .eq('store_id', storeId)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as StoreRevenueScore | null;
    },
    enabled: !!storeId
  });
}

export function useStoreRevenueRecommendations(storeId: string | undefined) {
  return useQuery({
    queryKey: ['store-revenue-recommendations', storeId],
    queryFn: async () => {
      if (!storeId) return [];
      
      const { data, error } = await supabase
        .from('store_revenue_recommendations')
        .select('*')
        .eq('store_id', storeId)
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return (data || []) as StoreRevenueRecommendation[];
    },
    enabled: !!storeId
  });
}

export function useTopRevenueTargets(businessId?: string, verticalId?: string, limit = 20) {
  return useQuery({
    queryKey: ['top-revenue-targets', businessId, verticalId, limit],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      let query = supabase
        .from('store_revenue_scores')
        .select(`
          *,
          store_master(id, name, city, state, status)
        `)
        .eq('snapshot_date', today)
        .order('heat_score', { ascending: false })
        .limit(limit);

      if (businessId) query = query.eq('business_id', businessId);
      if (verticalId) query = query.eq('vertical_id', verticalId);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });
}

export function useRevenueMetrics(businessId?: string, verticalId?: string) {
  return useQuery({
    queryKey: ['revenue-metrics', businessId, verticalId],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      let query = supabase
        .from('store_revenue_scores')
        .select('heat_score, churn_risk, order_prob_7d, revenue_90d')
        .eq('snapshot_date', today);

      if (businessId) query = query.eq('business_id', businessId);
      if (verticalId) query = query.eq('vertical_id', verticalId);

      const { data, error } = await query;
      if (error) throw error;

      const scores = data || [];
      const highValueAtRisk = scores.filter(s => 
        (s.churn_risk || 0) >= 70 && (s.revenue_90d || 0) >= 5000
      ).length;
      const hotStores = scores.filter(s => 
        (s.heat_score || 0) >= 80 && (s.order_prob_7d || 0) >= 60
      ).length;
      const avgHeatScore = scores.length > 0
        ? scores.reduce((sum, s) => sum + (s.heat_score || 0), 0) / scores.length
        : 0;

      return {
        highValueAtRisk,
        hotStores,
        avgHeatScore: Math.round(avgHeatScore),
        totalStores: scores.length
      };
    }
  });
}

export function useRevenueEngineActions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const scoreStore = useMutation({
    mutationFn: async (storeId: string) => {
      const { data, error } = await supabase.functions.invoke('revenue-engine', {
        body: { action: 'score_store', storeId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, storeId) => {
      queryClient.invalidateQueries({ queryKey: ['store-revenue-score', storeId] });
      toast({ title: "Store scored", description: "Revenue score updated successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const scoreAllStores = useMutation({
    mutationFn: async ({ businessId, verticalId }: { businessId?: string; verticalId?: string }) => {
      const { data, error } = await supabase.functions.invoke('revenue-engine', {
        body: { action: 'score_all', businessId, verticalId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['store-revenue-score'] });
      queryClient.invalidateQueries({ queryKey: ['top-revenue-targets'] });
      toast({ title: "Scoring complete", description: `Scored ${data.scored} stores` });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const generateRecommendations = useMutation({
    mutationFn: async ({ businessId, verticalId }: { businessId?: string; verticalId?: string }) => {
      const { data, error } = await supabase.functions.invoke('revenue-engine', {
        body: { action: 'generate_recommendations', businessId, verticalId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['store-revenue-recommendations'] });
      toast({ title: "Recommendations generated", description: `Created ${data.recommendations} recommendations` });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const syncToFollowUp = useMutation({
    mutationFn: async (storeId: string) => {
      const { data, error } = await supabase.functions.invoke('revenue-engine', {
        body: { action: 'sync_to_followup', storeId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['store-revenue-recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['follow-up-queue'] });
      toast({ title: "Synced to Follow-Up", description: `Created ${data.synced} follow-up tasks` });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  return {
    scoreStore,
    scoreAllStores,
    generateRecommendations,
    syncToFollowUp,
    isLoading: scoreStore.isPending || scoreAllStores.isPending || 
               generateRecommendations.isPending || syncToFollowUp.isPending
  };
}
