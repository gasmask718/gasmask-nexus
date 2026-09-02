import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';

export interface CanonicalRouteStop {
  id: string;
  route_id: string;
  store_id: string;
  planned_order: number;
  planned_arrival_time: string | null;
  notes_to_worker: string | null;
  status: string;
  brand_id: string | null;
  order_ids: string[] | null;
  opportunity_ids: string[] | null;
  store: {
    id: string;
    store_name: string;
    address: string | null;
    phone: string | null;
  };
}

export interface CanonicalRoute {
  id: string;
  name: string | null;
  date: string;
  type: string;
  territory: string | null;
  status: string;
  brand_ids: string[] | null;
  stops: CanonicalRouteStop[];
}

export interface MyAssignedRoutesResult {
  routes: CanonicalRoute[];
  flatStops: CanonicalRouteStop[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Canonical hook for worker portal task visibility.
 * Returns routes + route_stops assigned to the current logged-in worker.
 * Visibility ONLY — no mutations.
 */
export function useMyAssignedRoutes(): MyAssignedRoutesResult {
  const { data: profileData } = useCurrentUserProfile();

  const { data, isLoading, error } = useQuery({
    queryKey: ['my-assigned-routes', profileData?.profile?.id],
    queryFn: async () => {
      if (!profileData?.profile?.id) return { routes: [], flatStops: [] };

      const userId = profileData.profile.id;
      const today = new Date().toISOString().split('T')[0];

      // 1. Fetch routes assigned to this worker for today or active status
      const { data: routeData, error: routeError } = await supabase
        .from('routes')
        .select('id, name, date, type, territory, status, brand_ids')
        .eq('assigned_to', userId)
        .or(
          `and(gte(date,${today}),lte(date,${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]})),status.in.(pending,active,in_progress,paused)`
        )
        .order('date', { ascending: true });

      if (routeError) throw routeError;

      const routes = routeData || [];
      if (routes.length === 0) {
        return { routes: [], flatStops: [] };
      }

      // 2. Fetch route_stops for those routes
      const routeIds = routes.map((r) => r.id);
      const { data: stopsData, error: stopsError } = await supabase
        .from('route_stops')
        .select('*')
        .in('route_id', routeIds)
        .order('route_id')
        .order('planned_order', { ascending: true });

      if (stopsError) throw stopsError;

      const stops = stopsData || [];

      // 3. Fetch store metadata for all stops
      const storeIds = [...new Set(stops.map((s) => s.store_id))];
      let storeMap: Record<string, any> = {};

      if (storeIds.length > 0) {
        const { data: storesData } = await supabase
          .from('store_master')
          .select('id, store_name, address, phone')
          .in('id', storeIds);

        storeMap = Object.fromEntries(
          (storesData || []).map((s: any) => [
            s.id,
            { id: s.id, store_name: s.store_name, address: s.address, phone: s.phone },
          ])
        );
      }

      // 4. Build structured response
      const enrichedStops = stops.map((stop: any) => ({
        ...stop,
        store: storeMap[stop.store_id] || {
          id: stop.store_id,
          store_name: 'Unknown Store',
          address: null,
          phone: null,
        },
      }));

      const enrichedRoutes: CanonicalRoute[] = routes.map((route: any) => ({
        ...route,
        stops: enrichedStops.filter((s) => s.route_id === route.id),
      }));

      return {
        routes: enrichedRoutes,
        flatStops: enrichedStops,
      };
    },
    enabled: !!profileData?.profile?.id,
    staleTime: 30 * 1000, // 30s
    refetchInterval: 30 * 1000, // Refresh every 30s to stay fresh
  });

  return {
    routes: data?.routes || [],
    flatStops: data?.flatStops || [],
    isLoading,
    error: error as Error | null,
  };
}
