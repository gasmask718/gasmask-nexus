// ═══════════════════════════════════════════════════════════════════════════════
// AUTO ANALYTICS — Floor 4 Phase 3.5
// Automatic analytics computation on route completion
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useComputeRouteAnalytics, useUpdateWorkerPerformance } from "./useRouteAnalytics";
import { useFloor4PlaybookActions } from "./useFloor4Playbook";
import { useAlertActions } from "./useDeliveryAlerts";

export interface ComputationLog {
  id: string;
  route_id: string;
  worker_id: string | null;
  computation_type: string;
  status: 'pending' | 'success' | 'failed';
  error_message: string | null;
  computed_at: string;
  duration_ms: number | null;
}

// Fetch pending computations
export function usePendingComputations() {
  return useQuery({
    queryKey: ['pending-computations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('analytics_computation_log')
        .select(`
          *,
          route:routes(id, territory, date, assigned_to)
        `)
        .eq('status', 'pending')
        .order('computed_at', { ascending: true });
      
      if (error) throw error;
      return data as (ComputationLog & { route: any })[];
    },
    refetchInterval: 10000, // Check every 10 seconds
  });
}

// Fetch recent computation history
export function useComputationHistory(limit = 50) {
  return useQuery({
    queryKey: ['computation-history', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('analytics_computation_log')
        .select('*')
        .order('computed_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data as ComputationLog[];
    },
  });
}

// Process pending analytics computations
export function useProcessPendingAnalytics() {
  const queryClient = useQueryClient();
  const computeAnalytics = useComputeRouteAnalytics();
  const updateWorkerPerformance = useUpdateWorkerPerformance();
  const { evaluateWorker } = useFloor4PlaybookActions();
  const { createAlert } = useAlertActions();
  
  return useMutation({
    mutationFn: async (computationId: string) => {
      const startTime = Date.now();
      
      // Get the computation record
      const { data: computation, error: fetchError } = await supabase
        .from('analytics_computation_log')
        .select('*')
        .eq('id', computationId)
        .single();
      
      if (fetchError) throw fetchError;
      
      try {
        // 1. Compute route analytics
        await computeAnalytics.mutateAsync(computation.route_id);
        
        // 2. Update worker performance
        if (computation.worker_id) {
          await updateWorkerPerformance.mutateAsync(computation.worker_id);
          
          // 3. Evaluate playbook rules
          await evaluateWorker.mutateAsync(computation.worker_id);
        }
        
        const duration = Date.now() - startTime;
        
        // Mark as success
        const { error: updateError } = await supabase
          .from('analytics_computation_log')
          .update({
            status: 'success',
            duration_ms: duration,
          })
          .eq('id', computationId);
        
        if (updateError) throw updateError;
        
        return { success: true, duration };
      } catch (error: any) {
        // Mark as failed
        await supabase
          .from('analytics_computation_log')
          .update({
            status: 'failed',
            error_message: error.message,
            duration_ms: Date.now() - startTime,
          })
          .eq('id', computationId);
        
        // Create alert for failed computation
        await createAlert.mutateAsync({
          alertType: 'stalled_route',
          severity: 'high',
          title: 'Analytics computation failed',
          description: `Failed to compute analytics for route: ${error.message}`,
          routeId: computation.route_id,
          slaMinutes: 60,
        });
        
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-computations'] });
      queryClient.invalidateQueries({ queryKey: ['computation-history'] });
    },
    onError: (error: Error) => {
      console.error('Analytics computation failed:', error);
    },
  });
}

// Process all pending computations
export function useProcessAllPending() {
  const queryClient = useQueryClient();
  const processSingle = useProcessPendingAnalytics();
  
  return useMutation({
    mutationFn: async () => {
      const { data: pending, error } = await supabase
        .from('analytics_computation_log')
        .select('id')
        .eq('status', 'pending')
        .limit(10); // Process in batches
      
      if (error) throw error;
      
      const results = await Promise.allSettled(
        (pending || []).map(p => processSingle.mutateAsync(p.id))
      );
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      return { successful, failed };
    },
    onSuccess: ({ successful, failed }) => {
      queryClient.invalidateQueries({ queryKey: ['pending-computations'] });
      if (successful > 0) {
        toast.success(`Processed ${successful} route(s)`);
      }
      if (failed > 0) {
        toast.error(`${failed} computation(s) failed`);
      }
    },
  });
}

// Computation stats
export function useComputationStats() {
  return useQuery({
    queryKey: ['computation-stats'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('analytics_computation_log')
        .select('status, duration_ms, computed_at')
        .gte('computed_at', `${today}T00:00:00`);
      
      if (error) throw error;
      
      const pending = data.filter(c => c.status === 'pending').length;
      const successful = data.filter(c => c.status === 'success').length;
      const failed = data.filter(c => c.status === 'failed').length;
      
      const avgDuration = data
        .filter(c => c.status === 'success' && c.duration_ms)
        .reduce((sum, c) => sum + (c.duration_ms || 0), 0) / (successful || 1);
      
      return {
        pending,
        successful,
        failed,
        total: data.length,
        avgDurationMs: Math.round(avgDuration),
      };
    },
    refetchInterval: 30000,
  });
}
