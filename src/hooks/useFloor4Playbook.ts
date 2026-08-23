// ═══════════════════════════════════════════════════════════════════════════════
// FLOOR 4 PLAYBOOK ENGINE — Phase 3.5 Operational Activation
// Rule-based engine for actionable CTAs based on performance & alerts
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export type Floor4PlaybookRule = 
  | 'declining_performance'
  | 'sla_breach'
  | 'critical_exception'
  | 'high_performer'
  | 'capacity_warning'
  | 'stalled_route';

export type Floor4ActionType = 
  | 'coaching'
  | 'reduce_load'
  | 'promote_autonomy'
  | 'increase_capacity'
  | 'reassign_route'
  | 'pause_route'
  | 'escalate'
  | 'notify_manager';

export type Floor4ActionStatus = 'pending' | 'in_progress' | 'completed' | 'dismissed';

export interface Floor4PlaybookAction {
  id: string;
  worker_id: string | null;
  route_id: string | null;
  alert_id: string | null;
  playbook_rule: Floor4PlaybookRule;
  action_type: Floor4ActionType;
  action_label: string;
  priority: number;
  status: Floor4ActionStatus;
  context: Record<string, any> | null;
  created_at: string;
  completed_at: string | null;
  completed_by: string | null;
  dismissed_reason: string | null;
}

// Fetch pending playbook actions
export function useFloor4PendingActions() {
  return useQuery({
    queryKey: ['floor4-playbook-actions-pending'],
    queryFn: async () => {
      // Cast breaks TS2589 deep-instantiation on the embedded select; runtime unchanged
      const { data, error } = await (supabase
        .from('playbook_actions') as any)
        .select(`
          *,
          worker:profiles!playbook_actions_worker_id_fkey(id, name, role, avatar_url)
        `)
        .eq('status', 'pending')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as (Floor4PlaybookAction & { worker: any })[];
    },
    refetchInterval: 30000,
  });
}

// Fetch actions by worker
export function useFloor4WorkerActions(workerId: string) {
  return useQuery({
    queryKey: ['floor4-playbook-actions-worker', workerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('playbook_actions')
        .select('*')
        .eq('worker_id', workerId)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data as Floor4PlaybookAction[];
    },
    enabled: !!workerId,
  });
}

// Playbook action mutations
export function useFloor4PlaybookActions() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // Complete an action
  const completeAction = useMutation({
    mutationFn: async (actionId: string) => {
      const { error } = await supabase
        .from('playbook_actions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user?.id,
        })
        .eq('id', actionId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floor4-playbook-actions-pending'] });
      toast.success('Action completed');
    },
    onError: (error: Error) => {
      toast.error(`Failed to complete action: ${error.message}`);
    },
  });
  
  // Dismiss an action
  const dismissAction = useMutation({
    mutationFn: async ({ actionId, reason }: { actionId: string; reason: string }) => {
      const { error } = await supabase
        .from('playbook_actions')
        .update({
          status: 'dismissed',
          dismissed_reason: reason,
          completed_at: new Date().toISOString(),
          completed_by: user?.id,
        })
        .eq('id', actionId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floor4-playbook-actions-pending'] });
      toast.success('Action dismissed');
    },
    onError: (error: Error) => {
      toast.error(`Failed to dismiss action: ${error.message}`);
    },
  });
  
  // Start working on an action
  const startAction = useMutation({
    mutationFn: async (actionId: string) => {
      const { error } = await supabase
        .from('playbook_actions')
        .update({ status: 'in_progress' })
        .eq('id', actionId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floor4-playbook-actions-pending'] });
      toast.success('Started working on action');
    },
  });
  
  // Trigger playbook evaluation for a worker
  const evaluateWorker = useMutation({
    mutationFn: async (workerId: string) => {
      const { error } = await supabase.rpc('evaluate_playbook_rules', {
        p_worker_id: workerId,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floor4-playbook-actions-pending'] });
    },
  });
  
  return {
    completeAction,
    dismissAction,
    startAction,
    evaluateWorker,
  };
}

// Playbook action stats
export function useFloor4PlaybookStats() {
  return useQuery({
    queryKey: ['floor4-playbook-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('playbook_actions')
        .select('playbook_rule, status, action_type')
        .eq('status', 'pending');
      
      if (error) throw error;
      
      return {
        total: data.length,
        byRule: {
          declining_performance: data.filter(a => a.playbook_rule === 'declining_performance').length,
          high_performer: data.filter(a => a.playbook_rule === 'high_performer').length,
          sla_breach: data.filter(a => a.playbook_rule === 'sla_breach').length,
          critical_exception: data.filter(a => a.playbook_rule === 'critical_exception').length,
        },
        byType: {
          coaching: data.filter(a => a.action_type === 'coaching').length,
          reduce_load: data.filter(a => a.action_type === 'reduce_load').length,
          promote_autonomy: data.filter(a => a.action_type === 'promote_autonomy').length,
          escalate: data.filter(a => a.action_type === 'escalate').length,
        },
      };
    },
    refetchInterval: 60000,
  });
}
