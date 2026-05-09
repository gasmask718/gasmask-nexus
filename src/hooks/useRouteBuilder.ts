// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE BUILDER HOOK — Canonical writer for `routes` + `route_stops`
// ═══════════════════════════════════════════════════════════════════════════════
// Step 1 (B1 fix, Session 7): Repointed from ghost `route_plans` table to the
// canonical `routes` table. Column mapping:
//   driver_id      → routes.assigned_to
//   region         → routes.territory
//   scheduled_date → routes.date
//   brand          → routes.brand_ids[] (single-element array)
//   name/start_time/end_time/total_stops/notes/created_by → additive columns
//   stop.order_index → route_stops.planned_order
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type RouteStatus = 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type StopStatus = 'pending' | 'visited' | 'skipped';

export interface RoutePlan {
  id: string;
  name: string | null;
  status: RouteStatus;
  driver_id?: string | null;
  brand?: string | null;
  region?: string | null;
  scheduled_date: string;
  start_time?: string | null;
  end_time?: string | null;
  total_stops: number;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  stops?: RouteStop[];
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

// Map a `routes` row → RoutePlan shape used by the rest of the app.
function rowToRoutePlan(row: any): RoutePlan {
  return {
    id: row.id,
    name: row.name ?? null,
    status: (row.status as RouteStatus) ?? 'draft',
    driver_id: row.assigned_to ?? null,
    brand: Array.isArray(row.brand_ids) && row.brand_ids.length > 0 ? row.brand_ids[0] : null,
    region: row.territory ?? null,
    scheduled_date: row.date,
    start_time: row.start_time ?? null,
    end_time: row.end_time ?? null,
    total_stops: row.total_stops ?? 0,
    notes: row.notes ?? null,
    created_by: row.created_by ?? null,
    created_at: row.created_at,
  };
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

  const saveRoute = useCallback(async (
    routePayload: Awaited<ReturnType<typeof buildRouteFromStores>>
  ) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();

      const { data: route, error: routeError } = await supabase
        .from('routes')
        .insert({
          name: routePayload.name,
          type: 'delivery',
          status: 'scheduled',
          date: routePayload.scheduled_date,
          assigned_to: routePayload.driver_id ?? null,
          territory: routePayload.region ?? null,
          brand_ids: routePayload.brand ? [routePayload.brand] : [],
          start_time: routePayload.start_time ?? null,
          total_stops: routePayload.total_stops,
          notes: routePayload.notes ?? null,
          created_by: userData.user?.id ?? null,
        })
        .select()
        .single();

      if (routeError) throw routeError;

      if (routePayload.stops?.length && route?.id) {
        const stopsToInsert = routePayload.stops.map((stop) => ({
          route_id: route.id,
          store_id: stop.store_id,
          planned_order: stop.order_index,
          status: 'pending',
        }));

        const { error: stopsError } = await supabase
          .from('route_stops')
          .insert(stopsToInsert);
        if (stopsError) throw stopsError;
      }

      toast({
        title: 'Route Created',
        description: `${routePayload.name} with ${routePayload.total_stops} stops`,
      });
      return rowToRoutePlan(route);
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
      let query = supabase
        .from('routes')
        .select('*')
        .order('date', { ascending: false });

      if (filters?.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
        query = query.in('status', statuses);
      }
      if (filters?.driverId) query = query.eq('assigned_to', filters.driverId);
      if (filters?.brand) query = query.contains('brand_ids', [filters.brand]);
      if (filters?.dateFrom) query = query.gte('date', filters.dateFrom);
      if (filters?.dateTo) query = query.lte('date', filters.dateTo);

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      const mapped = (data || []).map(rowToRoutePlan);
      setRoutes(mapped);
      return mapped;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch routes');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getRouteWithStops = useCallback(async (routeId: string) => {
    try {
      const { data: route, error: routeErr } = await supabase
        .from('routes')
        .select('*')
        .eq('id', routeId)
        .single();
      if (routeErr) throw routeErr;

      const { data: stops } = await supabase
        .from('route_stops')
        .select('*, store:stores(id, name)')
        .eq('route_id', routeId)
        .order('planned_order', { ascending: true });

      const transformedStops: RouteStop[] = (stops || []).map((stop: any) => ({
        id: stop.id,
        route_id: stop.route_id,
        store_id: stop.store_id,
        order_index: stop.planned_order,
        status: stop.status as StopStatus,
        notes: stop.notes_to_worker,
        store: stop.store,
      }));

      return { ...rowToRoutePlan(route), stops: transformedStops };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch route');
      return null;
    }
  }, []);

  const updateRouteStatus = useCallback(async (routeId: string, status: RouteStatus) => {
    try {
      const updateData: Record<string, unknown> = { status };
      if (status === 'completed') {
        updateData.end_time = new Date().toTimeString().slice(0, 8);
        updateData.completed_at = new Date().toISOString();
      }
      if (status === 'in_progress') {
        updateData.started_at = new Date().toISOString();
      }

      const { error: updErr } = await supabase
        .from('routes')
        .update(updateData)
        .eq('id', routeId);
      if (updErr) throw updErr;

      setRoutes((prev) => prev.map((r) => (r.id === routeId ? { ...r, status } : r)));
      toast({ title: 'Route Updated', description: `Route marked as ${status}` });
      return true;
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  const markStopCompleted = useCallback(async (
    stopId: string,
    status: StopStatus = 'visited',
    notes?: string,
  ) => {
    try {
      const updateData: Record<string, unknown> = { status };
      if (notes) updateData.notes_to_worker = notes;
      const { error: stopErr } = await supabase
        .from('route_stops')
        .update(updateData)
        .eq('id', stopId);
      if (stopErr) throw stopErr;

      toast({ title: 'Stop Updated', description: `Stop marked as ${status}` });
      return true;
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  return {
    routes,
    loading,
    error,
    buildRouteFromStores,
    saveRoute,
    getRoutes,
    getRouteWithStops,
    updateRouteStatus,
    markStopCompleted,
    refetch: () => getRoutes(),
  };
}

export default useRouteBuilder;
