// ═══════════════════════════════════════════════════════════════════════════════
// OUTREACH PLANS HOOK — Manages outreach plans and their items
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface OutreachPlan {
  id: string;
  store_id: string;
  window_start: string;
  window_end: string;
  status: 'draft' | 'approved' | 'running' | 'completed' | 'cancelled';
  approved_by: string | null;
  approved_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_items: number;
  items_sent: number;
  items_responded: number;
  escalated_to_visit: boolean;
  created_at: string;
  updated_at: string;
  store?: {
    id: string;
    name: string;
    address?: string;
  };
}

export interface OutreachPlanItem {
  id: string;
  plan_id: string;
  contact_id: string;
  channel: 'text' | 'call';
  scheduled_at: string;
  template_id: string | null;
  status: 'pending' | 'sent' | 'failed' | 'skipped' | 'responded';
  stop_if_response: boolean;
  executed_at: string | null;
  communication_log_id: string | null;
  outcome: string | null;
  created_at: string;
  contact?: {
    id: string;
    name: string;
    phone: string;
  };
}

const QUERY_KEY = 'outreach-plans';

// Fetch all outreach plans with optional status filter
export function useOutreachPlans(status?: string | string[]) {
  return useQuery({
    queryKey: [QUERY_KEY, status],
    queryFn: async () => {
      let query = supabase
        .from('outreach_plans')
        .select(`
          *,
          store:store_master(id, store_name, address)
        `)
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
          address: item.store.address 
        } : undefined,
      })) as OutreachPlan[];
    },
  });
}

// Fetch draft plans specifically
export function useDraftOutreachPlans() {
  return useOutreachPlans('draft');
}

// Fetch approved/running plans
export function useActiveOutreachPlans() {
  return useOutreachPlans(['approved', 'running']);
}

// Fetch a single plan with its items
export function useOutreachPlan(planId: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, planId],
    queryFn: async () => {
      if (!planId) return null;

      const { data: planData, error: planError } = await supabase
        .from('outreach_plans')
        .select(`
          *,
          store:store_master(id, store_name, address)
        `)
        .eq('id', planId)
        .single();

      if (planError) throw planError;

      const { data: items, error: itemsError } = await supabase
        .from('outreach_plan_items')
        .select(`
          *,
          contact:store_contacts(id, name, phone)
        `)
        .eq('plan_id', planId)
        .order('scheduled_at', { ascending: true });

      if (itemsError) throw itemsError;

      // Map store_name to name
      const plan = {
        ...planData,
        store: planData.store ? {
          id: (planData.store as any).id,
          name: (planData.store as any).store_name,
          address: (planData.store as any).address,
        } : undefined,
      } as OutreachPlan;

      return {
        plan,
        items: (items || []) as OutreachPlanItem[],
      };
    },
    enabled: !!planId,
  });
}

// Fetch plans for a specific store
export function useStoreOutreachPlans(storeId: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, 'store', storeId],
    queryFn: async () => {
      if (!storeId) return [];

      const { data, error } = await supabase
        .from('outreach_plans')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return (data || []) as OutreachPlan[];
    },
    enabled: !!storeId,
  });
}

// Generate a new outreach plan for a store
export function useGenerateOutreachPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (storeId: string) => {
      const { data, error } = await supabase
        .rpc('generate_store_outreach_plan', { p_store_id: storeId });

      if (error) throw error;
      return data as string; // Returns plan ID
    },
    onSuccess: (planId) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Outreach plan generated');
      return planId;
    },
    onError: (error: Error) => {
      toast.error(`Failed to generate plan: ${error.message}`);
    },
  });
}

// Approve a plan
export function useApprovePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (planId: string) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('outreach_plans')
        .update({
          status: 'approved',
          approved_by: user.user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', planId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Plan approved');
    },
    onError: (error: Error) => {
      toast.error(`Failed to approve: ${error.message}`);
    },
  });
}

// Cancel a plan
export function useCancelPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase
        .from('outreach_plans')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
        })
        .eq('id', planId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Plan cancelled');
    },
    onError: (error: Error) => {
      toast.error(`Failed to cancel: ${error.message}`);
    },
  });
}

// Mark item as sent/skipped
export function useUpdatePlanItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      itemId, 
      status, 
      outcome,
      communicationLogId 
    }: { 
      itemId: string; 
      status: 'sent' | 'failed' | 'skipped' | 'responded';
      outcome?: string;
      communicationLogId?: string;
    }) => {
      const { error } = await supabase
        .from('outreach_plan_items')
        .update({
          status,
          outcome,
          communication_log_id: communicationLogId,
          executed_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update item: ${error.message}`);
    },
  });
}

// Queue stats
export function useOutreachQueueStats() {
  return useQuery({
    queryKey: [QUERY_KEY, 'stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outreach_plans')
        .select('status');

      if (error) throw error;

      const stats = {
        draft: 0,
        approved: 0,
        running: 0,
        completed: 0,
        cancelled: 0,
      };

      (data || []).forEach((plan: any) => {
        if (stats.hasOwnProperty(plan.status)) {
          stats[plan.status as keyof typeof stats]++;
        }
      });

      return stats;
    },
  });
}
