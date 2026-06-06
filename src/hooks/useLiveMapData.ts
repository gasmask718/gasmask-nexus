// ═══════════════════════════════════════════════════════════════════════════════
// LIVE MAP DATA HOOKS — Floor 4 Command Plane
// Real-time route tracking, worker positions, alerts & exceptions
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GeocodingService } from "@/services/geocoding";
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
  // Ambassador-specific (populated when role='ambassador' and a field_session is active)
  session_id?: string;
  session_started_at?: string;
  session_trigger?: 'manual' | 'route' | 'visit_run';
  stores_visited_session?: number;
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

export interface LiveDeliveryTask {
  id: string;
  biker_id: string | null;
  driver_id: string | null;
  biker_user_id: string | null;
  driver_user_id: string | null;
  delivery_lat: number;
  delivery_lng: number;
  delivery_address: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  delivery_notes: string | null;
  status: string;
  worker_name: string | null;
  order_number: string | null;
  total_amount: number | null;
  created_at: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
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

// Compute freshness status from timestamp
function computeStatus(updatedAt: string): 'active' | 'stale' | 'offline' {
  const ageMs = Date.now() - new Date(updatedAt).getTime();
  if (ageMs > 30 * 60 * 1000) return 'offline';
  if (ageMs > 5 * 60 * 1000) return 'stale';
  return 'active';
}

// Fetch worker locations from drivers_live_location + location_events for bikers/drivers
export function useLiveWorkers() {
  return useQuery({
    queryKey: ['live-map-workers'],
    queryFn: async () => {
      // 1) Existing drivers_live_location source
      const { data: dllData } = await supabase
        .from('drivers_live_location')
        .select(`
          id, driver_id, lat, lng, updated_at,
          profile:profiles!drivers_live_location_driver_id_fkey(id, name, role, avatar_url)
        `);

      const seenUserIds = new Set<string>();
      const seenRecordIds = new Set<string>();
      const workers: WorkerLocation[] = (dllData || []).map(loc => {
        seenUserIds.add(loc.driver_id);
        return {
          id: loc.id,
          worker_id: loc.driver_id,
          name: loc.profile?.name || 'Unknown',
          role: loc.profile?.role || 'worker',
          avatar_url: loc.profile?.avatar_url,
          lat: loc.lat,
          lng: loc.lng,
          updated_at: loc.updated_at,
          status: computeStatus(loc.updated_at),
        };
      });

      // 2) Fetch ALL bikers + drivers (not just active with user_id)
      const [{ data: bikers }, { data: drivers }] = await Promise.all([
        supabase.from('bikers').select('id, user_id, full_name, status'),
        supabase.from('drivers').select('id, user_id, full_name, status'),
      ]);

      // Build list of all field workers, marking which ones we still need location for
      const allFieldWorkers = [
        ...(bikers || []).map(b => ({ userId: b.user_id, name: b.full_name || 'Biker', role: 'biker' as const, recordId: b.id, workerStatus: b.status })),
        ...(drivers || []).map(d => ({ userId: d.user_id, name: d.full_name || 'Driver', role: 'driver' as const, recordId: d.id, workerStatus: d.status })),
      ];

      // Workers with user_ids that aren't already in drivers_live_location
      const needLocationWorkers = allFieldWorkers.filter(w => w.userId && !seenUserIds.has(w.userId));

      // Fetch latest location_events for workers with user_ids
      const latestByUser = new Map<string, { lat: number; lng: number; created_at: string }>();
      if (needLocationWorkers.length > 0) {
        const userIds = needLocationWorkers.map(w => w.userId!);
        const { data: events } = await supabase
          .from('location_events')
          .select('user_id, lat, lng, created_at')
          .in('user_id', userIds)
          .order('created_at', { ascending: false })
          .limit(500);

        for (const ev of events || []) {
          // Skip (0,0) login pings — find the first real GPS fix
          if (ev.lat === 0 && ev.lng === 0) continue;
          if (!latestByUser.has(ev.user_id)) {
            latestByUser.set(ev.user_id, { lat: ev.lat, lng: ev.lng, created_at: ev.created_at! });
          }
        }
      }

      // Add all field workers to the list
      for (const fw of allFieldWorkers) {
        // Skip if already added via drivers_live_location
        if (fw.userId && seenUserIds.has(fw.userId)) continue;
        if (seenRecordIds.has(fw.recordId)) continue;
        seenRecordIds.add(fw.recordId);

        // Try to get GPS from location_events
        const loc = fw.userId ? latestByUser.get(fw.userId) : null;
        const lat = loc ? Number(loc.lat) : 0;
        const lng = loc ? Number(loc.lng) : 0;
        const hasValidGps = lat !== 0 && lng !== 0 && !!lat && !!lng;

        const updatedAt = loc?.created_at || new Date(0).toISOString();

        workers.push({
          id: fw.recordId,
          worker_id: fw.userId || fw.recordId,
          name: fw.name,
          role: fw.role,
          lat: hasValidGps ? lat : 0,
          lng: hasValidGps ? lng : 0,
          updated_at: updatedAt,
          status: hasValidGps ? computeStatus(updatedAt) : 'offline',
        });
      }

      return workers;
    },
    refetchInterval: 10000,
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

// Fetch ALL delivery tasks (every order from /grabba/assignments) for map pins
export function useLiveDeliveryTasks() {
  return useQuery({
    queryKey: ['live-map-delivery-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_tasks')
        .select(`
          id, biker_id, driver_id, delivery_lat, delivery_lng, delivery_address,
          recipient_name, recipient_phone, delivery_notes, status, created_at,
          store_order:store_orders(order_number, total_amount, store_id)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return [] as LiveDeliveryTask[];

      // Auto-repair missing destination coordinates from delivery_address
      // so trajectory lines can render immediately in /live-map.
      const geocodeOverrides = new Map<string, { lat: number; lng: number }>();
      const missingCoords = data.filter(
        (t) => (!t.delivery_lat || !t.delivery_lng) && !!t.delivery_address
      );

      if (missingCoords.length > 0) {
        await Promise.all(
          missingCoords.map(async (task) => {
            try {
              const geo = await GeocodingService.geocodeAddress(task.delivery_address);
              if ('lat' in geo && geo.lat && geo.lng) {
                geocodeOverrides.set(task.id, { lat: geo.lat, lng: geo.lng });

                // Best-effort persistence back to database (may be blocked by RLS for non-managers)
                const { error: updateError } = await supabase
                  .from('delivery_tasks')
                  .update({ delivery_lat: geo.lat, delivery_lng: geo.lng })
                  .eq('id', task.id);

                if (updateError) {
                  console.warn('Could not persist geocoded delivery coordinates:', updateError.message);
                }
              }
            } catch (geocodeError) {
              console.warn('Geocoding failed for delivery task:', task.id, geocodeError);
            }
          })
        );
      }

      // Resolve user_ids and names from biker/driver record IDs
      const bikerIds = [...new Set(data.map(t => t.biker_id).filter(Boolean))];
      const driverIds = [...new Set(data.map(t => t.driver_id).filter(Boolean))];

      const [{ data: bikers }, { data: drivers }] = await Promise.all([
        bikerIds.length > 0
          ? supabase.from('bikers').select('id, user_id, full_name').in('id', bikerIds)
          : Promise.resolve({ data: [] as any[] }),
        driverIds.length > 0
          ? supabase.from('drivers').select('id, user_id, full_name').in('id', driverIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const bikerMap = Object.fromEntries((bikers || []).map(b => [b.id, { user_id: b.user_id, name: b.full_name }]));
      const driverMap = Object.fromEntries((drivers || []).map(d => [d.id, { user_id: d.user_id, name: d.full_name }]));

      // Fetch store pickup coordinates for fallback trajectory lines
      const storeIds = [...new Set(data.map(t => (t.store_order as any)?.store_id).filter(Boolean))];
      let storeMap: Record<string, { lat: number; lng: number }> = {};
      if (storeIds.length > 0) {
        const { data: storesData } = await supabase
          .from('stores')
          .select('id, lat, lng')
          .in('id', storeIds);
        storeMap = Object.fromEntries(
          (storesData || [])
            .filter(s => s.lat && s.lng)
            .map(s => [s.id, { lat: Number(s.lat), lng: Number(s.lng) }])
        );
      }

      return data.map(t => {
        const bikerInfo = t.biker_id ? bikerMap[t.biker_id] : null;
        const driverInfo = t.driver_id ? driverMap[t.driver_id] : null;
        const order = t.store_order as any;
        const storeCoords = order?.store_id ? storeMap[order.store_id] : null;
        const overrideCoords = geocodeOverrides.get(t.id);

        // Use geocoded override, then delivery coords, fallback to store pickup coords
        const deliveryLat = overrideCoords?.lat ?? (Number(t.delivery_lat) || storeCoords?.lat || 0);
        const deliveryLng = overrideCoords?.lng ?? (Number(t.delivery_lng) || storeCoords?.lng || 0);

        return {
          id: t.id,
          biker_id: t.biker_id || null,
          driver_id: t.driver_id || null,
          biker_user_id: bikerInfo?.user_id || null,
          driver_user_id: driverInfo?.user_id || null,
          delivery_lat: deliveryLat,
          delivery_lng: deliveryLng,
          delivery_address: t.delivery_address,
          recipient_name: t.recipient_name,
          recipient_phone: t.recipient_phone,
          delivery_notes: t.delivery_notes,
          status: t.status,
          worker_name: bikerInfo?.name || driverInfo?.name || null,
          order_number: order?.order_number || null,
          total_amount: order?.total_amount || null,
          created_at: t.created_at,
          pickup_lat: storeCoords?.lat || null,
          pickup_lng: storeCoords?.lng || null,
        };
      }) as LiveDeliveryTask[];
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
        { event: 'INSERT', schema: 'public', table: 'location_events' },
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_tasks' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['live-map-delivery-tasks'] });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [queryClient]);
}
