// ═══════════════════════════════════════════════════════════════════════════════
// STORE ESCALATIONS HOOK — Manages stores needing physical visits
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface StoreEscalation {
  id: string;
  store_id: string;
  outreach_plan_id: string | null;
  reason: 'unresponsive' | 'at_risk' | 'high_value' | 'manual';
  priority: number;
  attempts_made: number;
  contacts_attempted: number;
  last_attempt_at: string | null;
  status: 'pending' | 'assigned' | 'visited' | 'resolved' | 'dismissed';
  assigned_to: string | null;
  assigned_at: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
  store?: {
    id: string;
    name: string;
    address?: string;
    phone?: string;
  };
  assignee?: {
    id: string;
    name: string;
  };
}

const QUERY_KEY = 'store-escalations';

// Fetch escalations with optional status filter
export function useStoreEscalations(status?: string | string[]) {
  return useQuery({
    queryKey: [QUERY_KEY, status],
    queryFn: async () => {
      let query = supabase
        .from('store_escalations')
        .select(`
          *,
          store:store_master(id, store_name, address, phone)
        `)
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false });

      if (status) {
        if (Array.isArray(status)) {
          query = query.in('status', status);
        } else {
          query = query.eq('status', status);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Map store_name to name for interface compatibility
      return (data || []).map((item: any) => ({
        ...item,
        store: item.store ? {
          id: item.store.id,
          name: item.store.store_name,
          address: item.store.address,
          phone: item.store.phone,
        } : undefined,
      })) as StoreEscalation[];
    },
  });
}

// Fetch pending escalations (needs visit)
export function usePendingEscalations() {
  return useStoreEscalations(['pending', 'assigned']);
}

// Fetch escalations for route planning
export function useRouteCandidateEscalations() {
  return useQuery({
    queryKey: [QUERY_KEY, 'route-candidates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_escalations')
        .select(`
          *,
          store:store_master(id, store_name, address, phone, lat, lng)
        `)
        .in('status', ['pending', 'assigned'])
        .order('priority', { ascending: true });

      if (error) throw error;
      
      // Map store_name to name
      return (data || []).map((item: any) => ({
        ...item,
        store: item.store ? {
          id: item.store.id,
          name: item.store.store_name,
          address: item.store.address,
          phone: item.store.phone,
        } : undefined,
      })) as StoreEscalation[];
    },
  });
}

// Escalation stats for dashboard
export function useEscalationStats() {
  return useQuery({
    queryKey: [QUERY_KEY, 'stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_escalations')
        .select('status, reason, priority');

      if (error) throw error;

      const stats = {
        total: data?.length || 0,
        pending: 0,
        assigned: 0,
        visited: 0,
        resolved: 0,
        highPriority: 0, // priority <= 3
        byReason: {} as Record<string, number>,
      };

      (data || []).forEach((esc: any) => {
        // Count by status
        if (esc.status === 'pending') stats.pending++;
        if (esc.status === 'assigned') stats.assigned++;
        if (esc.status === 'visited') stats.visited++;
        if (esc.status === 'resolved') stats.resolved++;

        // Count high priority
        if (esc.priority <= 3 && ['pending', 'assigned'].includes(esc.status)) {
          stats.highPriority++;
        }

        // Count by reason
        stats.byReason[esc.reason] = (stats.byReason[esc.reason] || 0) + 1;
      });

      return stats;
    },
  });
}

// Assign an escalation to a user
export function useAssignEscalation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ escalationId, userId }: { escalationId: string; userId: string }) => {
      const { error } = await supabase
        .from('store_escalations')
        .update({
          status: 'assigned',
          assigned_to: userId,
          assigned_at: new Date().toISOString(),
        })
        .eq('id', escalationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Escalation assigned');
    },
    onError: (error: Error) => {
      toast.error(`Failed to assign: ${error.message}`);
    },
  });
}

// Mark as visited
export function useMarkEscalationVisited() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (escalationId: string) => {
      const { error } = await supabase
        .from('store_escalations')
        .update({
          status: 'visited',
        })
        .eq('id', escalationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Marked as visited');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });
}

// Resolve an escalation
export function useResolveEscalation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      escalationId, 
      notes 
    }: { 
      escalationId: string; 
      notes?: string;
    }) => {
      const { error } = await supabase
        .from('store_escalations')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolution_notes: notes,
        })
        .eq('id', escalationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Escalation resolved');
    },
    onError: (error: Error) => {
      toast.error(`Failed to resolve: ${error.message}`);
    },
  });
}

// Dismiss an escalation
export function useDismissEscalation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      escalationId, 
      notes 
    }: { 
      escalationId: string; 
      notes?: string;
    }) => {
      const { error } = await supabase
        .from('store_escalations')
        .update({
          status: 'dismissed',
          resolved_at: new Date().toISOString(),
          resolution_notes: notes,
        })
        .eq('id', escalationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Escalation dismissed');
    },
    onError: (error: Error) => {
      toast.error(`Failed to dismiss: ${error.message}`);
    },
  });
}

// Create a manual escalation
export function useCreateEscalation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      storeId, 
      reason = 'manual',
      priority = 5,
    }: { 
      storeId: string; 
      reason?: 'unresponsive' | 'at_risk' | 'high_value' | 'manual';
      priority?: number;
    }) => {
      const { data, error } = await supabase
        .rpc('escalate_store_to_visit', {
          p_store_id: storeId,
          p_reason: reason,
          p_priority: priority,
        });

      if (error) throw error;
      return data as string; // Returns escalation ID
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['follow-up-queue'] });
      toast.success('Store escalated for physical visit');
    },
    onError: (error: Error) => {
      toast.error(`Failed to escalate: ${error.message}`);
    },
  });
}
