// usePendingRouteStops — Step 6: queue of AI-flagged delivery requests awaiting human approval.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type PendingStopStatus = 'pending_approval' | 'approved' | 'rejected' | 'edited';

export interface PendingRouteStop {
  id: string;
  bland_call_log_id: string | null;
  store_id: string;
  store_name: string | null;
  requested_day: string | null;
  requested_window: 'morning' | 'afternoon' | 'evening' | null;
  urgency: 'today' | 'this_week' | 'next_week' | 'no_rush' | null;
  intent_summary: string | null;
  recommended_boxes: number | null;
  recommended_brand: string | null;
  estimated_revenue: number | null;
  confidence_level: 'high' | 'medium' | 'low' | null;
  ai_payload: any;
  status: PendingStopStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  route_stop_id: string | null;
  created_at: string;
  updated_at: string;
}

export function usePendingRouteStops() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['pending_route_stops'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('pending_route_stops')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as PendingRouteStop[];
    },
    refetchInterval: 30_000,
  });

  const reject = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await (supabase as any)
        .from('pending_route_stops')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          approved_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Stop rejected');
      qc.invalidateQueries({ queryKey: ['pending_route_stops'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to reject'),
  });

  const markApproved = useMutation({
    mutationFn: async ({ id, route_stop_id }: { id: string; route_stop_id?: string }) => {
      const { error } = await (supabase as any)
        .from('pending_route_stops')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          route_stop_id: route_stop_id ?? null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending_route_stops'] });
    },
  });

  const stops = query.data || [];
  const pendingCount = stops.filter((s) => s.status === 'pending_approval').length;

  return {
    stops,
    pendingCount,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    reject: reject.mutateAsync,
    markApproved: markApproved.mutateAsync,
  };
}
