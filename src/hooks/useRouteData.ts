import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Types
export interface Route {
  id: string;
  date: string;
  type: string;
  assigned_to?: string;
  territory?: string;
  status?: string;
  estimated_distance_km?: number;
  estimated_duration_minutes?: number;
  estimated_profit?: number;
  optimization_score?: number;
  is_optimized?: boolean;
  created_at?: string;
  assignee?: { id: string; name: string; role: string };
  stops?: RouteStop[];
  stops_count?: number;
}

export interface RouteStop {
  id: string;
  route_id?: string;
  store_id?: string;
  planned_order?: number;
  planned_arrival_time?: string;
  notes_to_worker?: string;
  status?: string;
  created_at?: string;
  store?: { id: string; name: string; address_line1?: string; address_city?: string };
}

// All Routes Hook
export function useRoutes(filters?: { date?: string; status?: string; type?: string; territory?: string }) {
  return useQuery({
    queryKey: ["routes", filters],
    queryFn: async () => {
      let query = supabase
        .from("routes")
        .select(`
          *,
          assignee:profiles!routes_assigned_to_fkey(id, name, role),
          route_stops(count)
        `)
        .order("date", { ascending: false });

      if (filters?.date) query = query.eq("date", filters.date);
      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.type) query = query.eq("type", filters.type);
      if (filters?.territory) query = query.eq("territory", filters.territory);

      const { data, error } = await query;
      if (error) throw error;
      
      return data.map((route: any) => ({
        ...route,
        stops_count: route.route_stops?.[0]?.count || 0,
      })) as Route[];
    },
  });
}

// Single Route with Stops
export function useRouteWithStops(routeId?: string) {
  return useQuery({
    queryKey: ["route", routeId],
    queryFn: async () => {
      if (!routeId) return null;
      
      const { data: route, error: routeError } = await supabase
        .from("routes")
        .select(`
          *,
          assignee:profiles!routes_assigned_to_fkey(id, name, role)
        `)
        .eq("id", routeId)
        .single();
      
      if (routeError) throw routeError;

      const { data: stops, error: stopsError } = await supabase
        .from("route_stops")
        .select(`
          *,
          store:stores(id, name, address_city, lat, lng)
        `)
        .eq("route_id", routeId)
        .order("planned_order");
      
      if (stopsError) throw stopsError;

      return { 
        ...route, 
        stops: stops.map((s: any) => ({
          ...s,
          store: s.store ? { 
            id: s.store.id, 
            name: s.store.name, 
            address_city: s.store.address_city 
          } : undefined
        }))
      } as Route;
    },
    enabled: !!routeId,
  });
}

// Create Route
export function useCreateRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (route: { date: string; type: string; [key: string]: unknown }) => {
      const { data, error } = await supabase
        .from("routes")
        .insert([route])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routes"] });
      toast.success("Route created");
    },
    onError: (error) => toast.error(error.message),
  });
}

// Update Route
export function useUpdateRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Route> & { id: string }) => {
      const { data, error } = await supabase
        .from("routes")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["routes"] });
      queryClient.invalidateQueries({ queryKey: ["route", data.id] });
      toast.success("Route updated");
    },
    onError: (error) => toast.error(error.message),
  });
}

// Delete Route
export function useDeleteRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (routeId: string) => {
      const { error } = await supabase
        .from("routes")
        .delete()
        .eq("id", routeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routes"] });
      toast.success("Route deleted");
    },
    onError: (error) => toast.error(error.message),
  });
}

// Add Stop to Route
export function useAddRouteStop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (stop: { route_id: string; planned_order: number; [key: string]: unknown }) => {
      const { data, error } = await supabase
        .from("route_stops")
        .insert([stop])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["route", data.route_id] });
      queryClient.invalidateQueries({ queryKey: ["routes"] });
      toast.success("Stop added");
    },
    onError: (error) => toast.error(error.message),
  });
}

// Update Route Stop
export function useUpdateRouteStop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<RouteStop> & { id: string }) => {
      const { data, error } = await supabase
        .from("route_stops")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["route", data.route_id] });
      toast.success("Stop updated");
    },
    onError: (error) => toast.error(error.message),
  });
}

// Remove Stop from Route
export function useRemoveRouteStop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ stopId, routeId }: { stopId: string; routeId: string }) => {
      const { error } = await supabase
        .from("route_stops")
        .delete()
        .eq("id", stopId);
      if (error) throw error;
      return { routeId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["route", data.routeId] });
      queryClient.invalidateQueries({ queryKey: ["routes"] });
      toast.success("Stop removed");
    },
    onError: (error) => toast.error(error.message),
  });
}

// Route Stats
export function useRouteStats(dateRange?: { from: string; to: string }) {
  return useQuery({
    queryKey: ["route-stats", dateRange],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      let query = supabase.from("routes").select("id, status, type, date, estimated_distance_km, optimization_score");
      
      if (dateRange) {
        query = query.gte("date", dateRange.from).lte("date", dateRange.to);
      } else {
        query = query.eq("date", today);
      }

      const { data, error } = await query;
      if (error) throw error;

      const stats = {
        total: data.length,
        planned: data.filter(r => r.status === "planned").length,
        active: data.filter(r => r.status === "active").length,
        completed: data.filter(r => r.status === "completed").length,
        cancelled: data.filter(r => r.status === "cancelled").length,
        totalDistance: data.reduce((sum, r) => sum + (r.estimated_distance_km || 0), 0),
        avgOptimizationScore: data.length > 0 
          ? Math.round(data.reduce((sum, r) => sum + (r.optimization_score || 0), 0) / data.length)
          : 0,
        byType: {
          driver: data.filter(r => r.type === "driver").length,
          biker: data.filter(r => r.type === "biker").length,
        }
      };

      return stats;
    },
  });
}

// Available Personnel for Routes
export function useAvailablePersonnel() {
  return useQuery({
    queryKey: ["available-personnel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, role")
        .in("role", ["driver", "biker"])
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}
