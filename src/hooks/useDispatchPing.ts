// ═══════════════════════════════════════════════════════════════════════════════
// DISPATCH PING HOOK — Ping Worker Command Action
// Phase 3.6 critical command action
// ═══════════════════════════════════════════════════════════════════════════════

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PingWorkerParams {
  workerId: string;
  workerName: string;
  routeId?: string;
  reason?: string;
}

interface PingResult {
  success: boolean;
  interventionId: string;
  timestamp: string;
}

export function useDispatchPing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workerId, workerName, routeId, reason }: PingWorkerParams): Promise<PingResult> => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('Must be logged in to ping workers');
      
      // Create dispatch intervention record
      const { data, error } = await supabase
        .from('dispatch_interventions')
        .insert({
          route_id: routeId || null,
          intervention_type: 'ping_worker',
          reason: reason || 'Command ping from Live Map',
          performed_by: user.id,
          justification: `Ping sent to ${workerName} from Live Map Command Center`,
          before_state: {
            worker_id: workerId,
            worker_name: workerName,
            source: 'live_map_command',
            timestamp: new Date().toISOString(),
          },
        })
        .select('id, created_at')
        .single();

      if (error) throw error;

      // In a real system, this would trigger:
      // - Push notification to worker's device
      // - SMS/WhatsApp message
      // - In-app notification
      // For now, we just log the intent

      return {
        success: true,
        interventionId: data.id,
        timestamp: data.created_at,
      };
    },
    onSuccess: (_, variables) => {
      toast.success(`Ping sent to ${variables.workerName}`, {
        description: 'Worker will be notified to check in',
      });
      queryClient.invalidateQueries({ queryKey: ['dispatch-interventions'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to ping worker', {
        description: error.message,
      });
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACKNOWLEDGE PING HOOK — For workers to acknowledge pings
// ═══════════════════════════════════════════════════════════════════════════════

export function useAcknowledgePing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (interventionId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('dispatch_interventions')
        .update({
          approved_at: new Date().toISOString(),
          approved_by: user?.id,
          after_state: { acknowledged: true, acknowledged_at: new Date().toISOString() },
        })
        .eq('id', interventionId);

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      toast.success('Ping acknowledged');
      queryClient.invalidateQueries({ queryKey: ['dispatch-interventions'] });
    },
  });
}
