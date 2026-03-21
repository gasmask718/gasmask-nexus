import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CommunicationPlaybook {
  id: string;
  name: string;
  description: string | null;
  status: string;
  trigger_type: string;
  trigger_config: Record<string, any>;
  conditions: any[];
  actions: any[];
  run_count: number;
  last_triggered_at: string | null;
  last_run_result: string | null;
  require_approval: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlaybookExecution {
  id: string;
  playbook_id: string;
  triggered_by: string | null;
  trigger_data: any;
  conditions_passed: boolean;
  actions_executed: any[];
  actions_failed: any[];
  status: string;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

export function useCommunicationPlaybooks() {
  return useQuery({
    queryKey: ['communication-playbooks'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('communication_playbooks')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as CommunicationPlaybook[];
    },
  });
}

export function usePlaybookExecutions(playbookId?: string) {
  return useQuery({
    queryKey: ['playbook-executions', playbookId],
    queryFn: async () => {
      let query = (supabase as any)
        .from('playbook_executions')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50);
      if (playbookId) query = query.eq('playbook_id', playbookId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as PlaybookExecution[];
    },
    enabled: playbookId !== undefined,
  });
}

export function useCreatePlaybookMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (playbook: Partial<CommunicationPlaybook>) => {
      const { data, error } = await (supabase as any)
        .from('communication_playbooks')
        .insert(playbook)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['communication-playbooks'] });
      toast.success('Playbook created');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdatePlaybookMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CommunicationPlaybook> }) => {
      const { error } = await (supabase as any)
        .from('communication_playbooks')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['communication-playbooks'] });
      toast.success('Playbook updated');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeletePlaybookMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('communication_playbooks')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['communication-playbooks'] });
      toast.success('Playbook deleted');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useRunPlaybookMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ playbookId, triggerData, storeId, leadId }: {
      playbookId: string;
      triggerData?: Record<string, any>;
      storeId?: string;
      leadId?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('execute-playbook', {
        body: {
          playbook_id: playbookId,
          trigger_data: triggerData || { trigger_type: 'manual' },
          store_id: storeId,
          lead_id: leadId,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['communication-playbooks'] });
      qc.invalidateQueries({ queryKey: ['playbook-executions'] });
      const failed = data?.actions_failed?.length || 0;
      if (failed > 0) {
        toast.warning(`Playbook ran with ${failed} failed action(s)`);
      } else {
        toast.success(`Playbook executed — ${data?.actions_executed?.length || 0} actions completed`);
      }
    },
    onError: (e: any) => toast.error(e.message),
  });
}
