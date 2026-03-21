import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RouteStop {
  id: string;
  store_name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  health_score: number;
  health_status: string;
  last_visit: string | null;
  full_address: string;
}

export function useRouteOptimizer(personType: 'drivers' | 'bikers' | 'ambassadors') {
  return useQuery({
    queryKey: ['route-optimizer', personType],
    queryFn: async () => {
      const { data: urgentStores } = await supabase
        .from('store_health_scores')
        .select('store_id, overall_score, health_status, last_visit_date')
        .lt('overall_score', 70)
        .order('overall_score', { ascending: true })
        .limit(20);

      if (!urgentStores?.length) return [];

      const storeIds = urgentStores.map(s => s.store_id);
      const { data: storeDetails } = await supabase
        .from('store_master')
        .select('id, store_name, address, city, state')
        .in('id', storeIds);

      const scoreMap = Object.fromEntries(urgentStores.map(s => [s.store_id, s]));

      return (storeDetails || []).map(store => ({
        id: store.id,
        store_name: store.store_name,
        address: store.address,
        city: store.city,
        state: store.state,
        health_score: scoreMap[store.id]?.overall_score || 0,
        health_status: scoreMap[store.id]?.health_status || 'Unknown',
        last_visit: scoreMap[store.id]?.last_visit_date,
        full_address: `${store.address || ''} ${store.city || ''} ${store.state || ''}`.trim(),
      })).sort((a, b) => a.health_score - b.health_score) as RouteStop[];
    },
  });
}

export function buildGoogleMapsUrl(stores: RouteStop[]): string {
  if (!stores.length) return '';
  const origin = encodeURIComponent(stores[0].full_address);
  const destination = encodeURIComponent(stores[stores.length - 1].full_address);
  const waypoints = stores.slice(1, -1)
    .map(s => encodeURIComponent(s.full_address))
    .join('|');
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ''}&travelmode=driving`;
}
