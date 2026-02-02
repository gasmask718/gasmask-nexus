// ═══════════════════════════════════════════════════════════════════════════════
// LIVE MAP DATA HOOKS — Floor 4 Command Plane
// Real-time route tracking, worker positions, alerts & exceptions
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useCallback } from "react";

export interface WorkerLocation {
  id: string;
  worker_id: string;
  name: string;
  role: string;
  avatar_url?: string;
  lat: number;
  lng: number;
  updated_at: string;
  route_id?: string;
  status: 'active' | 'stale' | 'offline';
  autonomy_level?: string;
}

export interface LiveRoute {
  id: string;
  date: string;
  territory: string;
  status: string;
  route_state: string;
  assigned_to: string | null;
  type: string;
  started_at: string | null;
  completed_at: string | null;
  estimated_duration_minutes: number | null;
  estimated_distance_km: number | null;
  assignee: {
    id: string;
    name: string;
    role: string;
    avatar_url?: string;
  } | null;
  stops: LiveStop[];
  completedStops: number;
  totalStops: number;
  progressPercent: number;
  hasAlerts: boolean;
  alertCount: number;
}

export interface LiveStop {
  id: string;
  route_id: string;
  store_id: string;
  planned_order: number;
  status: string;
  actual_arrival: string | null;
  actual_departure: string | null;
  was_on_time: boolean | null;
  notes_to_worker: string | null;
  store: {
    id: string;
    name: string;
    lat: number | null;
    lng: number | null;
    address_street: string | null;
    address_city: string | null;
    phone: string | null;
  } | null;
}

export interface LiveAlert {
  id: string;
  route_id: string | null;
  stop_id: string | null;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string | null;
  sla_deadline: string | null;
  sla_breached: boolean;
  escalation_level: number;
  status: string;
  created_at: string;
  lat?: number;
  lng?: number;
}

// Fetch all active routes with stops and assignees
export function useLiveRoutes() {
  return useQuery({
    queryKey: ['live-map-routes'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('routes')
        .select(`
          id,
          date,
          territory,
          status,
          route_state,
          assigned_to,
          type,
          started_at,
          completed_at,
          estimated_duration_minutes,
          estimated_distance_km,
          assignee:profiles!routes_assigned_to_fkey(id, name, role, avatar_url),
          route_stops(
            id,
            route_id,
            store_id,
            planned_order,
            status,
            actual_arrival,
            actual_departure,
            was_on_time,
            notes_to_worker,
            store:stores(id, name, lat, lng, address_street, address_city, phone)
          )
        `)
        .gte('date', today)
        .in('status', ['planned', 'active', 'in_progress', 'paused'])
        .order('date', { ascending: true });

      if (error) throw error;

      // Enrich with computed fields
      const enriched: LiveRoute[] = (data || []).map(route => {
        const stops = (route.route_stops || []).sort((a: any, b: any) => a.planned_order - b.planned_order);
        const completedStops = stops.filter((s: any) => s.status === 'completed').length;
        const totalStops = stops.length;
        
        return {
          id: route.id,
          date: route.date,
          territory: route.territory,
          status: route.status,
          route_state: route.route_state,
          assigned_to: route.assigned_to,
          type: route.type,
          started_at: route.started_at,
          completed_at: route.completed_at,
          estimated_duration_minutes: route.estimated_duration_minutes,
          estimated_distance_km: route.estimated_distance_km,
          assignee: route.assignee,
          stops,
          completedStops,
          totalStops,
          progressPercent: totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0,
          hasAlerts: false, // Will be enriched by alerts query
          alertCount: 0,
        };
      });

      return enriched;
    },
    refetchInterval: 15000, // Refresh every 15 seconds
  });
}

// Fetch worker locations from drivers_live_location
export function useLiveWorkers() {
  return useQuery({
    queryKey: ['live-map-workers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drivers_live_location')
        .select(`
          id,
          driver_id,
          lat,
          lng,
          updated_at,
          profile:profiles!drivers_live_location_driver_id_fkey(id, name, role, avatar_url)
        `);

      if (error) throw error;

      const now = new Date();
      const staleThreshold = 5 * 60 * 1000; // 5 minutes

      const workers: WorkerLocation[] = (data || []).map(loc => {
        const lastUpdate = new Date(loc.updated_at);
        const ageMs = now.getTime() - lastUpdate.getTime();
        
        let status: 'active' | 'stale' | 'offline' = 'active';
        if (ageMs > 30 * 60 * 1000) status = 'offline';
        else if (ageMs > staleThreshold) status = 'stale';

        return {
          id: loc.id,
          worker_id: loc.driver_id,
          name: loc.profile?.name || 'Unknown',
          role: loc.profile?.role || 'worker',
          avatar_url: loc.profile?.avatar_url,
          lat: loc.lat,
          lng: loc.lng,
          updated_at: loc.updated_at,
          status,
        };
      });

      return workers;
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });
}

// Fetch open alerts with location context
export function useLiveAlerts() {
  return useQuery({
    queryKey: ['live-map-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_alerts')
        .select(`
          id,
          route_id,
          stop_id,
          alert_type,
          severity,
          title,
          description,
          sla_deadline,
          sla_breached,
          escalation_level,
          status,
          created_at
        `)
        .in('status', ['open', 'acknowledged', 'in_progress'])
        .order('severity', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (data || []) as LiveAlert[];
    },
    refetchInterval: 10000,
  });
}

// Fetch open exceptions
export function useLiveExceptions() {
  return useQuery({
    queryKey: ['live-map-exceptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_exceptions')
        .select(`
          id,
          delivery_id,
          exception_type,
          severity,
          description,
          created_at,
          resolved_at
        `)
        .is('resolved_at', null)
        .order('severity', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });
}

// Combined map state management
export function useMapState() {
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);
  const [selectedStop, setSelectedStop] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);
  const [followWorker, setFollowWorker] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-74.006, 40.7128]);
  const [mapZoom, setMapZoom] = useState(11);

  const clearSelection = useCallback(() => {
    setSelectedRoute(null);
    setSelectedWorker(null);
    setSelectedStop(null);
    setSelectedAlert(null);
  }, []);

  const selectRoute = useCallback((routeId: string | null) => {
    clearSelection();
    setSelectedRoute(routeId);
  }, [clearSelection]);

  const selectWorker = useCallback((workerId: string | null) => {
    clearSelection();
    setSelectedWorker(workerId);
  }, [clearSelection]);

  const selectStop = useCallback((stopId: string | null) => {
    clearSelection();
    setSelectedStop(stopId);
  }, [clearSelection]);

  const selectAlert = useCallback((alertId: string | null) => {
    clearSelection();
    setSelectedAlert(alertId);
  }, [clearSelection]);

  const toggleFollowWorker = useCallback((workerId: string | null) => {
    setFollowWorker(prev => prev === workerId ? null : workerId);
  }, []);

  return {
    selectedRoute,
    selectedWorker,
    selectedStop,
    selectedAlert,
    followWorker,
    mapCenter,
    mapZoom,
    selectRoute,
    selectWorker,
    selectStop,
    selectAlert,
    toggleFollowWorker,
    setMapCenter,
    setMapZoom,
    clearSelection,
  };
}

// Real-time subscription hook
export function useLiveMapSubscription() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('live-map-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drivers_live_location' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['live-map-workers'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'routes' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['live-map-routes'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'route_stops' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['live-map-routes'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_alerts' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['live-map-alerts'] });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [queryClient]);
}
