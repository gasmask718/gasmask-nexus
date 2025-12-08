// ═══════════════════════════════════════════════════════════════════════════════
// USE FOLLOW-UPS HOOK — React hook for follow-up queue management
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface FollowUpQueueItem {
  id: string;
  store_id: string | null;
  business_id: string | null;
  vertical_id: string | null;
  brand: string | null;
  reason: string;
  recommended_action: string;
  priority: number;
  due_at: string;
  context: Record<string, any>;
  status: string;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  store?: { id: string; name: string } | null;
  business?: { id: string; name: string } | null;
  vertical?: { id: string; name: string; slug: string } | null;
}

const QUERY_KEY = 'follow-up-queue';

async function fetchFollowUps(status?: string | string[]): Promise<FollowUpQueueItem[]> {
  const client = supabase as any;
  let query = client
    .from('follow_up_queue')
    .select(`*, store:store_master(id, name), business:businesses(id, name), vertical:brand_verticals(id, name, slug)`)
    .order('priority', { ascending: true })
    .order('due_at', { ascending: true });

  if (status) {
    if (Array.isArray(status)) {
      query = query.in('status', status);
    } else {
      query = query.eq('status', status);
    }
  }

  const { data, error } = await query;
  if (error) return [];
  return data || [];
}

export function usePendingFollowUps() {
  return useQuery({
    queryKey: [QUERY_KEY, 'pending'],
    queryFn: () => fetchFollowUps('pending'),
  });
}

export function useDueTodayFollowUps() {
  return useQuery({
    queryKey: [QUERY_KEY, 'due-today'],
    queryFn: async () => {
      const client = supabase as any;
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();
      
      const { data } = await client
        .from('follow_up_queue')
        .select(`*, store:store_master(id, name), business:businesses(id, name), vertical:brand_verticals(id, name, slug)`)
        .in('status', ['pending', 'in_progress'])
        .gte('due_at', startOfDay)
        .lte('due_at', endOfDay)
        .order('priority', { ascending: true });
      
      return data || [];
    },
  });
}

export function useOverdueFollowUps() {
  return useQuery({
    queryKey: [QUERY_KEY, 'overdue'],
    queryFn: () => fetchFollowUps('overdue'),
  });
}

export function useCompletedFollowUps(limit = 50) {
  return useQuery({
    queryKey: [QUERY_KEY, 'completed', limit],
    queryFn: async () => {
      const client = supabase as any;
      const { data } = await client
        .from('follow_up_queue')
        .select(`*, store:store_master(id, name), business:businesses(id, name), vertical:brand_verticals(id, name, slug)`)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(limit);
      return data || [];
    },
  });
}

export function useFollowUpQueueStats() {
  return useQuery({
    queryKey: [QUERY_KEY, 'stats'],
    queryFn: async () => {
      const client = supabase as any;
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

      const { data: all } = await client.from('follow_up_queue').select('status');
      const { data: dueToday } = await client
        .from('follow_up_queue')
        .select('id')
        .in('status', ['pending', 'in_progress'])
        .gte('due_at', startOfDay)
        .lte('due_at', endOfDay);

      const pending = all?.filter((i: any) => i.status === 'pending').length || 0;
      const overdue = all?.filter((i: any) => i.status === 'overdue').length || 0;
      const completed = all?.filter((i: any) => i.status === 'completed').length || 0;

      return { pending, dueToday: dueToday?.length || 0, overdue, completed };
    },
  });
}

export function useCompleteFollowUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const client = supabase as any;
      await client.from('follow_up_queue').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Follow-up completed');
    },
  });
}

export function useCancelFollowUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const client = supabase as any;
      await client.from('follow_up_queue').update({ status: 'canceled' }).eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Follow-up canceled');
    },
  });
}

export function useTriggerFollowUpNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const client = supabase as any;
      await client.from('follow_up_queue').update({ status: 'in_progress', due_at: new Date().toISOString() }).eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Follow-up triggered');
    },
  });
}

export function useRunFollowUpEngine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('follow-up-engine');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success(`Engine created ${data?.followUpsCreated || 0} new follow-ups`);
    },
    onError: () => toast.error('Failed to run follow-up engine'),
  });
}
