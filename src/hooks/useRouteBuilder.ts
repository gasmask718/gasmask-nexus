// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE BUILDER HOOK — Route Planning & Management
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type RouteStatus = 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type StopStatus = 'pending' | 'visited' | 'skipped';

export interface RoutePlan {
  id: string;
  name: string;
  status: RouteStatus;
  driver_id?: string;
  brand?: string;
  region?: string;
  scheduled_date: string;
  start_time?: string;
  end_time?: string;
  total_stops: number;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  stops?: RouteStop[];
  driver?: { id: string; name: string };
}

export interface RouteStop {
  id: string;
  route_id: string;
  store_id?: string;
  order_index: number;
  status: StopStatus;
  arr_eta?: string;
  completed_at?: string;
  notes?: string;
  store?: { id: string; name: string; address?: string };
}

export interface BuildRouteOptions {
  name?: string;
  storeIds: string[];
  driverId?: string;
  brand?: string;
  region?: string;
  scheduledDate: Date;
  startTime?: string;
  notes?: string;
}

export interface RouteFilters {
  status?: RouteStatus | RouteStatus[];
  driverId?: string;
  brand?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function useRouteBuilder() {
  const [routes, setRoutes] = useState<RoutePlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const autoOrderStops = useCallback(async (storeIds: string[]) => {
    if (storeIds.length === 0) return [];

    const { data: stores } = await supabase
      .from('stores')
      .select('id, name')
      .in('id', storeIds);

    if (!stores) return storeIds.map((id, idx) => ({ store_id: id, order_index: idx }));

    const sorted = [...stores].sort((a, b) => 
      (a.name || '').localeCompare(b.name || '')
    );

    return sorted.map((store, idx) => ({
      store_id: store.id,
      order_index: idx,
      store: { id: store.id, name: store.name || '' },
    }));
  }, []);

  const buildRouteFromStores = useCallback(async (options: BuildRouteOptions) => {
    const orderedStops = await autoOrderStops(options.storeIds);
    const routeName = options.name || 
      `${options.brand || 'Route'} - ${options.scheduledDate.toLocaleDateString()}`;

    return {
      name: routeName,
      driver_id: options.driverId,
      brand: options.brand,
      region: options.region,
      scheduled_date: options.scheduledDate.toISOString().split('T')[0],
      start_time: options.startTime,
      total_stops: orderedStops.length,
      notes: options.notes,
      stops: orderedStops,
    };
  }, [autoOrderStops]);

  const saveRoute = useCallback(async (routePayload: Awaited<ReturnType<typeof buildRouteFromStores>>) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data: route, error: routeError } = await (supabase
        .from('route_plans' as any)
        .insert({
          name: routePayload.name,
          status: 'scheduled',
          driver_id: routePayload.driver_id,
          brand: routePayload.brand,
          region: routePayload.region,
          scheduled_date: routePayload.scheduled_date,
          start_time: routePayload.start_time,
          total_stops: routePayload.total_stops,
          notes: routePayload.notes,
          created_by: userData.user?.id,
        })
        .select()
        .single() as any);

      if (routeError) throw routeError;

      if (routePayload.stops?.length && route?.id) {
        const stopsToInsert = routePayload.stops.map(stop => ({
          route_id: route.id,
          store_id: stop.store_id,
          planned_order: stop.order_index,
          status: 'pending',
        }));

        await supabase.from('route_stops').insert(stopsToInsert);
      }

      toast({ title: 'Route Created', description: `${routePayload.name} with ${routePayload.total_stops} stops` });
      return route as RoutePlan;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create route';
      setError(message);
      toast({ title: 'Error', description: message, variant: 'destructive' });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const getRoutes = useCallback(async (filters?: RouteFilters) => {
    setLoading(true);
    try {
      let query = (supabase.from('route_plans' as any).select('*') as any).order('scheduled_date', { ascending: false });

      if (filters?.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
        query = query.in('status', statuses);
      }
      if (filters?.driverId) query = query.eq('driver_id', filters.driverId);
      if (filters?.brand) query = query.eq('brand', filters.brand);
      if (filters?.dateFrom) query = query.gte('scheduled_date', filters.dateFrom);
      if (filters?.dateTo) query = query.lte('scheduled_date', filters.dateTo);

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      setRoutes((data || []) as RoutePlan[]);
      return (data || []) as RoutePlan[];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch routes');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getRouteWithStops = useCallback(async (routeId: string) => {
    try {
      const { data: route } = await (supabase.from('route_plans' as any).select('*').eq('id', routeId).single() as any);
      const { data: stops } = await supabase.from('route_stops').select('*, store:stores(id, name)').eq('route_id', routeId).order('planned_order', { ascending: true });

      const transformedStops = (stops || []).map((stop: any) => ({
        id: stop.id,
        route_id: stop.route_id,
        store_id: stop.store_id,
        order_index: stop.planned_order,
        status: stop.status as StopStatus,
        notes: stop.notes_to_worker,
        store: stop.store,
      }));

      return { ...route, stops: transformedStops } as RoutePlan;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch route');
      return null;
    }
  }, []);

  const updateRouteStatus = useCallback(async (routeId: string, status: RouteStatus) => {
    try {
      const updateData: any = { status, updated_at: new Date().toISOString() };
      if (status === 'completed') updateData.end_time = new Date().toTimeString().slice(0, 5);

      await (supabase.from('route_plans' as any).update(updateData).eq('id', routeId) as any);
      setRoutes(prev => prev.map(r => r.id === routeId ? { ...r, status } : r));
      toast({ title: 'Route Updated', description: `Route marked as ${status}` });
      return true;
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
      return false;
    }
  }, [toast]);

  const markStopCompleted = useCallback(async (stopId: string, status: StopStatus = 'visited', notes?: string) => {
    try {
      const updateData: any = { status };
      if (notes) updateData.notes_to_worker = notes;
      await supabase.from('route_stops').update(updateData).eq('id', stopId);
      toast({ title: 'Stop Updated', description: `Stop marked as ${status}` });
      return true;
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
      return false;
    }
  }, [toast]);

  return { routes, loading, error, buildRouteFromStores, saveRoute, getRoutes, getRouteWithStops, updateRouteStatus, markStopCompleted, refetch: () => getRoutes() };
}

export default useRouteBuilder;
