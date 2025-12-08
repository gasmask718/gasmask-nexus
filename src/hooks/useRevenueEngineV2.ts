import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ProductRevenueMetric {
  id: string;
  product_id: string;
  business_id: string | null;
  vertical_id: string | null;
  snapshot_date: string;
  total_revenue_30d: number | null;
  total_revenue_90d: number | null;
  units_sold_30d: number | null;
  units_sold_90d: number | null;
  avg_order_quantity: number | null;
  unique_stores_30d: number | null;
  unique_stores_90d: number | null;
  trend_30d: number | null;
  trend_90d: number | null;
  hero_score: number | null;
  ghost_score: number | null;
  tags: string[] | null;
  products?: { id: string; name: string; brand_id: string; brands?: { name: string } };
}

export interface StoreProductPrediction {
  id: string;
  store_id: string;
  product_id: string;
  business_id: string | null;
  vertical_id: string | null;
  snapshot_date: string;
  buy_prob_7d: number | null;
  buy_prob_30d: number | null;
  last_order_at: string | null;
  expected_quantity: number | null;
  is_primary_sku: boolean;
  is_experiment_candidate: boolean;
  tags: string[] | null;
  products?: { id: string; name: string; brand_id: string; brands?: { name: string } };
}

export interface ProductDealRecommendation {
  id: string;
  business_id: string | null;
  vertical_id: string | null;
  product_id: string | null;
  related_product_ids: string[] | null;
  deal_type: string | null;
  target_segment: string | null;
  suggested_discount_pct: number | null;
  suggested_bundle_price: number | null;
  suggested_min_qty: number | null;
  notes: string | null;
  synced_to_campaign: boolean;
  created_at: string;
  expires_at: string | null;
}

export function useStoreProductPredictions(storeId: string | undefined) {
  return useQuery({
    queryKey: ['store-product-predictions', storeId],
    queryFn: async () => {
      if (!storeId) return [];
      
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('store_product_predictions')
        .select('*')
        .eq('store_id', storeId)
        .eq('snapshot_date', today)
        .order('buy_prob_7d', { ascending: false })
        .limit(10);

      if (error) throw error;
      return (data || []) as StoreProductPrediction[];
    },
    enabled: !!storeId
  });
}

export function useHeroGhostSkus(businessId?: string, verticalId?: string) {
  return useQuery({
    queryKey: ['hero-ghost-skus', businessId, verticalId],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      let query = supabase
        .from('product_revenue_metrics')
        .select('*')
        .eq('snapshot_date', today);

      if (businessId) query = query.eq('business_id', businessId);
      if (verticalId) query = query.eq('vertical_id', verticalId);

      const { data, error } = await query;
      if (error) throw error;

      const allMetrics = (data || []) as ProductRevenueMetric[];

      const heroes = allMetrics
        .filter(m => (m.hero_score || 0) >= 60)
        .sort((a, b) => (b.hero_score || 0) - (a.hero_score || 0))
        .slice(0, 5);

      const ghosts = allMetrics
        .filter(m => (m.ghost_score || 0) >= 50 || (m.tags || []).includes('slow_mover'))
        .sort((a, b) => (b.ghost_score || 0) - (a.ghost_score || 0))
        .slice(0, 5);

      return { heroes, ghosts };
    }
  });
}

export function useProductDealRecommendations(businessId?: string, verticalId?: string) {
  return useQuery({
    queryKey: ['product-deal-recommendations', businessId, verticalId],
    queryFn: async () => {
      let query = supabase
        .from('product_deal_recommendations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (businessId) query = query.eq('business_id', businessId);
      if (verticalId) query = query.eq('vertical_id', verticalId);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ProductDealRecommendation[];
    }
  });
}

export function useRevenueEngineV2Actions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const computeProductMetrics = useMutation({
    mutationFn: async ({ businessId, verticalId }: { businessId?: string; verticalId?: string }) => {
      const { data, error } = await supabase.functions.invoke('revenue-engine-v2', {
        body: { action: 'compute_product_metrics', businessId, verticalId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['hero-ghost-skus'] });
      toast({ title: "Product metrics computed", description: `Processed ${data.computed} products` });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const computeStorePredictions = useMutation({
    mutationFn: async ({ storeId, businessId, verticalId }: { storeId?: string; businessId?: string; verticalId?: string }) => {
      const { data, error } = await supabase.functions.invoke('revenue-engine-v2', {
        body: { action: 'compute_store_predictions', storeId, businessId, verticalId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['store-product-predictions'] });
      toast({ title: "Predictions computed", description: `Generated ${data.predictions} predictions` });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const generateDealRecommendations = useMutation({
    mutationFn: async ({ businessId, verticalId }: { businessId?: string; verticalId?: string }) => {
      const { data, error } = await supabase.functions.invoke('revenue-engine-v2', {
        body: { action: 'generate_deal_recommendations', businessId, verticalId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['product-deal-recommendations'] });
      toast({ title: "Deals generated", description: `Created ${data.deals} deal recommendations` });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const runFullV2Engine = useMutation({
    mutationFn: async ({ businessId, verticalId }: { businessId?: string; verticalId?: string }) => {
      // Run all V2 processes in sequence
      await computeProductMetrics.mutateAsync({ businessId, verticalId });
      await computeStorePredictions.mutateAsync({ businessId, verticalId });
      await generateDealRecommendations.mutateAsync({ businessId, verticalId });
      return { success: true };
    },
    onSuccess: () => {
      toast({ title: "V2 Engine Complete", description: "All product intelligence computed" });
    }
  });

  return {
    computeProductMetrics,
    computeStorePredictions,
    generateDealRecommendations,
    runFullV2Engine,
    isLoading: computeProductMetrics.isPending || computeStorePredictions.isPending || 
               generateDealRecommendations.isPending || runFullV2Engine.isPending
  };
}
