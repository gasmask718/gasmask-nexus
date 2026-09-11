/**
 * useFieldRouteOptimizer — start address + real-road resequencing for ONE canonical
 * route (public.routes + public.route_stops) via the field-route-optimize function.
 *
 * Changing the start address marks the existing sequence stale and recalculates it.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface RouteStartInfo {
  id: string;
  start_address: string | null;
  start_lat: number | null;
  start_lng: number | null;
  sequence_stale: boolean | null;
  optimized_at: string | null;
  estimated_distance_km: number | null;
  estimated_duration_minutes: number | null;
}

export function useRouteStart(routeId: string | undefined) {
  return useQuery({
    queryKey: ['route-start', routeId],
    queryFn: async (): Promise<RouteStartInfo | null> => {
      if (!routeId) return null;
      const { data, error } = await supabase
        .from('routes')
        .select(
          'id, start_address, start_lat, start_lng, sequence_stale, optimized_at, estimated_distance_km, estimated_duration_minutes',
        )
        .eq('id', routeId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as RouteStartInfo) ?? null;
    },
    enabled: !!routeId,
  });
}

export function useOptimizeFieldRoute() {
  const qc = useQueryClient();

  const invalidate = (routeId: string) => {
    qc.invalidateQueries({ queryKey: ['route-start', routeId] });
    qc.invalidateQueries({ queryKey: ['ambassador-routes'] });
    qc.invalidateQueries({ queryKey: ['my-assigned-routes'] });
  };

  /** Marks the current order as no longer valid for the new start point. */
  const markStale = useMutation({
    mutationFn: async (routeId: string) => {
      const { error } = await supabase
        .from('routes')
        .update({ sequence_stale: true } as never)
        .eq('id', routeId);
      if (error) throw error;
    },
    onSuccess: (_d, routeId) => invalidate(routeId),
  });

  const optimize = useMutation({
    mutationFn: async (input: { routeId: string; startAddress: string; autoFill?: number }) => {
      const { data, error } = await supabase.functions.invoke('field-route-optimize', {
        body: {
          routeId: input.routeId,
          startAddress: input.startAddress,
          autoFill: input.autoFill ?? 0,
        },
      });
      if (error) {
        const details =
          typeof (error as { context?: { text?: () => Promise<string> } }).context?.text ===
          'function'
            ? await (error as unknown as { context: { text: () => Promise<string> } }).context.text()
            : error.message;
        throw new Error(details);
      }
      if (data?.error) throw new Error(data.error);
      return data as {
        routingMode: string;
        startAddress: string;
        optimizedStops: number;
        autoFilled: number;
        unmappedStops: number;
        estimatedMinutes: number;
        estimatedKm: number;
      };
    },
    onSuccess: (res, input) => {
      invalidate(input.routeId);
      const via = res.routingMode === 'mapbox_driving_matrix' ? 'driving times' : 'distance only';
      toast.success(
        `Route resequenced (${res.optimizedStops} stops, ${res.estimatedMinutes} min, ${via})`,
      );
      if (res.unmappedStops > 0) {
        toast.warning(`${res.unmappedStops} stop(s) have no map location and were left at the end`);
      }
    },
    onError: (e: Error) => toast.error(e.message || 'Could not resequence the route'),
  });

  return {
    optimize: optimize.mutateAsync,
    isOptimizing: optimize.isPending,
    markStale: markStale.mutateAsync,
  };
}
