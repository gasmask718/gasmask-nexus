import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TerritoryCoverage {
  totalStores: number;
  activeStores: number;
  dormantStores: number;
  boros: string[];
  neighborhoods: string[];
  zips: string[];
  coverageScore: number;
  stores: Array<{
    id: string;
    name: string;
    status: string;
    city: string;
    isActive: boolean;
  }>;
}

export interface BrandTubesSold {
  brandKey: string;
  brandName: string;
  tubesSold: number;
  lastSoldAt: string | null;
  orderCount: number;
  etaNextOrder?: string | null;
  avgDaysBetweenOrders?: number | null;
  etaConfidence?: 'strong' | 'weak' | 'learning' | 'no_history';
}

export interface WholesalerProfileData {
  wholesaler: {
    id: string;
    name: string;
    status: string;
    city?: string;
    state?: string;
    phone?: string;
    email?: string;
  };
  territoryCoverage: TerritoryCoverage;
  tubesSoldByBrand: BrandTubesSold[];
}

/**
 * Hook to fetch the complete wholesaler profile data from the edge function
 * This provides territory coverage + tubes sold by brand in a single call
 */
export function useWholesalerProfileAPI(wholesalerId: string | undefined) {
  return useQuery<WholesalerProfileData | null>({
    queryKey: ['wholesaler-profile-api', wholesalerId],
    queryFn: async () => {
      if (!wholesalerId) return null;

      const { data, error } = await supabase.functions.invoke(`wholesaler-profile/${wholesalerId}`);

      if (error) {
        console.error('Error fetching wholesaler profile:', error);
        throw error;
      }

      return data as WholesalerProfileData;
    },
    enabled: !!wholesalerId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Fallback hook that fetches data directly from the database
 * Use this if the edge function is not available
 */
export function useWholesalerProfileDirect(wholesalerId: string | undefined) {
  // Territory coverage query
  const territoryQuery = useQuery({
    queryKey: ['wholesaler-territory-direct', wholesalerId],
    queryFn: async () => {
      if (!wholesalerId) return null;

      // Get store mappings with store details
      const { data: mappings, error } = await supabase
        .from('wholesaler_store_map')
        .select(`
          id,
          is_active,
          store_id,
          stores!inner (
            id,
            name,
            status,
            address_city,
            address_state,
            address_zip
          )
        `)
        .eq('wholesaler_id', wholesalerId);

      if (error) throw error;

      const stores = mappings || [];
      const totalStores = stores.length;
      const activeStores = stores.filter((m: any) => 
        m.is_active && m.stores?.status === 'active'
      ).length;

      return {
        totalStores,
        activeStores,
        dormantStores: totalStores - activeStores,
        boros: [...new Set(stores.map((m: any) => m.stores?.address_city).filter(Boolean))] as string[],
        neighborhoods: [] as string[],
        zips: [...new Set(stores.map((m: any) => m.stores?.address_zip).filter(Boolean))] as string[],
        coverageScore: totalStores > 0 ? Math.round((activeStores / totalStores) * 100) : 0,
        stores: stores.map((m: any) => ({
          id: m.stores?.id,
          name: m.stores?.name,
          status: m.stores?.status,
          city: m.stores?.address_city,
          isActive: m.is_active,
        })),
      } as TerritoryCoverage;
    },
    enabled: !!wholesalerId,
  });

  // Tubes sold by brand query
  const tubesQuery = useQuery({
    queryKey: ['wholesaler-tubes-by-brand-direct', wholesalerId],
    queryFn: async () => {
      if (!wholesalerId) return [];

      const { data: orders, error } = await supabase
        .from('wholesale_orders')
        .select('brand, tubes_total, created_at')
        .eq('wholesaler_id', wholesalerId)
        .not('brand', 'is', null);

      if (error) throw error;

      // Define the 4 Grabba brands
      const GRABBA_BRANDS = [
        { key: 'grabba', name: 'Grabba' },
        { key: 'hot grabba', name: 'Hot Grabba' },
        { key: 'dark grabba', name: 'Dark Grabba' },
        { key: 'grabba leaf', name: 'Grabba Leaf' },
      ];

      // Aggregate by brand with order dates for ETA
      const aggregates: Record<string, { 
        tubesSold: number; 
        lastSoldAt: string | null; 
        orderCount: number;
        orderDates: Date[];
      }> = {};
      
      (orders || []).forEach((order: any) => {
        const brandKey = order.brand?.toLowerCase() || '';
        if (!aggregates[brandKey]) {
          aggregates[brandKey] = { tubesSold: 0, lastSoldAt: null, orderCount: 0, orderDates: [] };
        }
        aggregates[brandKey].tubesSold += order.tubes_total || 0;
        aggregates[brandKey].orderCount += 1;
        aggregates[brandKey].orderDates.push(new Date(order.created_at));
        
        if (!aggregates[brandKey].lastSoldAt || 
            new Date(order.created_at) > new Date(aggregates[brandKey].lastSoldAt!)) {
          aggregates[brandKey].lastSoldAt = order.created_at;
        }
      });

      // Calculate ETA for each brand
      const calculateETA = (orderDates: Date[], lastSoldAt: string | null) => {
        if (orderDates.length === 0) {
          return { etaDate: null, avgDays: null, confidence: 'no_history' as const };
        }
        if (orderDates.length === 1) {
          return { etaDate: null, avgDays: null, confidence: 'learning' as const };
        }

        const sorted = [...orderDates].sort((a, b) => a.getTime() - b.getTime());
        const intervals: number[] = [];
        for (let i = 1; i < sorted.length; i++) {
          const daysBetween = (sorted[i].getTime() - sorted[i - 1].getTime()) / (1000 * 60 * 60 * 24);
          intervals.push(daysBetween);
        }
        
        const avgDays = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
        const lastDate = new Date(lastSoldAt!);
        const etaDate = new Date(lastDate.getTime() + avgDays * 24 * 60 * 60 * 1000);
        const confidence = orderDates.length >= 3 ? 'strong' as const : 'weak' as const;
        
        return { etaDate: etaDate.toISOString(), avgDays, confidence };
      };

      // Return all 4 brands with defaults
      return GRABBA_BRANDS.map(brand => {
        const agg = aggregates[brand.key] || { tubesSold: 0, lastSoldAt: null, orderCount: 0, orderDates: [] };
        const eta = calculateETA(agg.orderDates, agg.lastSoldAt);
        
        return {
          brandKey: brand.key,
          brandName: brand.name,
          tubesSold: agg.tubesSold,
          lastSoldAt: agg.lastSoldAt,
          orderCount: agg.orderCount,
          etaNextOrder: eta.etaDate,
          avgDaysBetweenOrders: eta.avgDays,
          etaConfidence: eta.confidence,
        } as BrandTubesSold;
      });
    },
    enabled: !!wholesalerId,
  });

  return {
    territoryCoverage: territoryQuery.data,
    tubesSoldByBrand: tubesQuery.data || [],
    isLoading: territoryQuery.isLoading || tubesQuery.isLoading,
    error: territoryQuery.error || tubesQuery.error,
  };
}
