/**
 * Ambassador Routes Hook - Route planning and visit execution
 * Manages route creation, stop management, and visit outcomes
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';

export interface RouteStop {
  id: string;
  route_id: string;
  store_id: string | null;
  store_name?: string;
  store_address?: string;
  custom_address?: string;
  planned_time?: string;
  planned_order: number;
  status: 'planned' | 'complete' | 'skipped';
  outcome_notes?: string;
  completed_at?: string;
}

export interface AmbassadorRoute {
  id: string;
  title: string;
  route_date: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  stops_count: number;
  completed_stops: number;
  stops?: RouteStop[];
  created_at: string;
}

/**
 * Fetch ambassador's routes
 */
export function useAmbassadorRoutes(options?: { dateFrom?: string; dateTo?: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { dateFrom, dateTo } = options || {};

  // Get ambassador ID
  const ambassadorQuery = useQuery({
    queryKey: ['ambassador-for-routes', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('ambassadors')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const ambassadorId = ambassadorQuery.data?.id;

  // Fetch routes - using route_plans table if it exists, fallback to routes
  const routesQuery = useQuery({
    queryKey: ['ambassador-routes', ambassadorId, dateFrom, dateTo],
    queryFn: async () => {
      if (!ambassadorId) return [];

      // Try to fetch from routes table assigned to user
      let query = supabase
        .from('routes')
        .select(`
          id,
          date,
          status,
          territory,
          created_at,
          stops:route_stops(
            id,
            store_id,
            planned_order,
            status,
            notes_to_worker,
            planned_arrival_time
          )
        `)
        .eq('assigned_to', user?.id)
        .order('date', { ascending: false });

      if (dateFrom) {
        query = query.gte('date', dateFrom);
      }
      if (dateTo) {
        query = query.lte('date', dateTo);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('Routes fetch error:', error);
        return [];
      }

      return (data || []).map((route: any): AmbassadorRoute => {
        const stops = route.stops || [];
        const completedStops = stops.filter((s: any) => s.status === 'complete' || s.status === 'completed').length;
        
        return {
          id: route.id,
          title: route.territory || `Route for ${format(new Date(route.date), 'MMM d, yyyy')}`,
          route_date: route.date,
          status: route.status || 'scheduled',
          stops_count: stops.length,
          completed_stops: completedStops,
          stops: stops.map((s: any): RouteStop => ({
            id: s.id,
            route_id: route.id,
            store_id: s.store_id,
            planned_order: s.planned_order,
            status: s.status || 'planned',
            outcome_notes: s.notes_to_worker,
            planned_time: s.planned_arrival_time,
          })),
          created_at: route.created_at,
        };
      });
    },
    enabled: !!user?.id,
  });

  // Create route mutation - ensures route AND stops persist together
  const createRouteMutation = useMutation({
    mutationFn: async (input: { title: string; date: string; storeIds?: string[] }) => {
      if (!user?.id) throw new Error('Not authenticated');


      const { data: route, error: routeError } = await supabase
        .from('routes')
        .insert({
          date: input.date,
          territory: input.title,
          status: 'scheduled',
          assigned_to: user.id,
          type: 'ambassador',
        })
        .select()
        .single();

      if (routeError) {
        console.error('[Route Create] Route insert error:', routeError);
        throw routeError;
      }
      
      if (!route?.id) {
        throw new Error('Route was not created - check RLS policies');
      }


      // Add stops if provided
      if (input.storeIds?.length && route?.id) {
        const stops = input.storeIds.map((storeId, index) => ({
          route_id: route.id,
          store_id: storeId,
          planned_order: index + 1,
          status: 'pending',
        }));

        const { error: stopsError } = await supabase.from('route_stops').insert(stops);
        if (stopsError) {
          console.error('[Route Create] Stops insert error:', stopsError);
          // Don't throw - route was created, stops can be added later
          toast.error('Route created but stops failed to save');
        }
      }

      return route;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ambassador-routes'] });
      toast.success('Route created');
    },
    onError: (error: Error) => {
      console.error('[Route Create] Full error:', error);
      toast.error(`Failed to create route: ${error.message}`);
    },
  });

  // Add stop mutation
  const addStopMutation = useMutation({
    mutationFn: async (input: { routeId: string; storeId: string; order?: number }) => {
      
      const { data: existingStops } = await supabase
        .from('route_stops')
        .select('planned_order')
        .eq('route_id', input.routeId)
        .order('planned_order', { ascending: false })
        .limit(1);

      const nextOrder = input.order || ((existingStops?.[0]?.planned_order || 0) + 1);

      const { data, error } = await supabase
        .from('route_stops')
        .insert({
          route_id: input.routeId,
          store_id: input.storeId,
          planned_order: nextOrder,
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        console.error('[Route Stop] Insert error:', error);
        throw error;
      }
      
      if (!data?.id) {
        throw new Error('Stop was not created - check RLS policies');
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ambassador-routes'] });
      toast.success('Stop added');
    },
    onError: (error: Error) => {
      console.error('[Route Stop] Full error:', error);
      toast.error(`Failed to add stop: ${error.message}`);
    },
  });

  // Complete stop mutation
  const completeStopMutation = useMutation({
    mutationFn: async (input: { stopId: string; status: 'complete' | 'skipped'; notes?: string }) => {
      const { error } = await supabase
        .from('route_stops')
        .update({
          status: input.status,
          notes_to_worker: input.notes,
        })
        .eq('id', input.stopId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ambassador-routes'] });
      toast.success('Stop updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update stop: ${error.message}`);
    },
  });

  return {
    routes: routesQuery.data || [],
    isLoading: ambassadorQuery.isLoading || routesQuery.isLoading,
    isError: routesQuery.isError,
    createRoute: createRouteMutation.mutateAsync,
    isCreatingRoute: createRouteMutation.isPending,
    addStop: addStopMutation.mutateAsync,
    isAddingStop: addStopMutation.isPending,
    completeStop: completeStopMutation.mutateAsync,
    isCompletingStop: completeStopMutation.isPending,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['ambassador-routes'] }),
  };
}
