import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface WorkItem {
  id: string;
  business_id?: string;
  contact_id?: string;
  direction?: string;
  channel: string;
  content?: string;
  phone_number?: string;
  status: string;
  priority?: string;
  owner_user_id?: string;
  assigned_at?: string;
  due_at?: string;
  sla_deadline?: string;
  first_response_at?: string;
  resolved_at?: string;
  escalation_level?: number;
  escalated_to?: string;
  escalation_reason?: string;
  snoozed_until?: string;
  snooze_reason?: string;
  actor_type?: string;
  created_at: string;
  updated_at?: string;
}

export interface WorkOwnershipActions {
  assign: (itemId: string, userId: string) => Promise<void>;
  resolve: (itemId: string) => Promise<void>;
  escalate: (itemId: string, toUserId: string, reason: string) => Promise<void>;
  snooze: (itemId: string, until: Date, reason: string) => Promise<void>;
  setPriority: (itemId: string, priority: string) => Promise<void>;
  setStatus: (itemId: string, status: string) => Promise<void>;
}

export function useWorkItems(businessId?: string, filters?: {
  status?: string[];
  priority?: string[];
  channel?: string[];
  ownerId?: string;
  unassigned?: boolean;
}) {
  return useQuery({
    queryKey: ['work-items', businessId, filters],
    queryFn: async () => {
      let query = supabase
        .from('communication_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (businessId) {
        query = query.eq('business_id', businessId);
      }

      if (filters?.status?.length) {
        query = query.in('status', filters.status);
      }

      if (filters?.priority?.length) {
        query = query.in('priority', filters.priority);
      }

      if (filters?.channel?.length) {
        query = query.in('channel', filters.channel);
      }

      if (filters?.ownerId) {
        query = query.eq('owner_user_id', filters.ownerId);
      }

      if (filters?.unassigned) {
        query = query.is('owner_user_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as WorkItem[];
    }
  });
}

export function useWorkOwnershipActions(): WorkOwnershipActions {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const updateItem = async (itemId: string, updates: Partial<WorkItem>) => {
    const { error } = await supabase
      .from('communication_messages')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', itemId);
    
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['work-items'] });
  };

  return {
    assign: async (itemId: string, userId: string) => {
      await updateItem(itemId, {
        owner_user_id: userId,
        assigned_at: new Date().toISOString(),
        assigned_by: user?.id
      } as any);
      toast.success('Item assigned');
    },

    resolve: async (itemId: string) => {
      await updateItem(itemId, {
        status: 'resolved',
        resolved_at: new Date().toISOString()
      });
      toast.success('Item resolved');
    },

    escalate: async (itemId: string, toUserId: string, reason: string) => {
      const { data: current } = await supabase
        .from('communication_messages')
        .select('escalation_level')
        .eq('id', itemId)
        .single();

      await updateItem(itemId, {
        status: 'escalated',
        escalation_level: (current?.escalation_level || 0) + 1,
        escalated_to: toUserId,
        escalation_reason: reason
      } as any);
      toast.success('Item escalated');
    },

    snooze: async (itemId: string, until: Date, reason: string) => {
      await updateItem(itemId, {
        status: 'snoozed',
        snoozed_until: until.toISOString(),
        snooze_reason: reason
      } as any);
      toast.success(`Snoozed until ${until.toLocaleDateString()}`);
    },

    setPriority: async (itemId: string, priority: string) => {
      await updateItem(itemId, { priority } as any);
      toast.success(`Priority set to ${priority}`);
    },

    setStatus: async (itemId: string, status: string) => {
      await updateItem(itemId, { status });
      toast.success(`Status updated to ${status}`);
    }
  };
}

export function useCallDispositions(callLogId?: string) {
  return useQuery({
    queryKey: ['call-dispositions', callLogId],
    queryFn: async () => {
      let query = supabase.from('call_dispositions').select('*');
      if (callLogId) {
        query = query.eq('call_log_id', callLogId);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!callLogId || callLogId === undefined
  });
}

export function useCreateDisposition() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (disposition: {
      call_log_id: string;
      business_name?: string;
      disposition_code: string;
      reason_category?: string;
      follow_up_required?: boolean;
      follow_up_type?: string;
      follow_up_scheduled_at?: string;
      notes?: string;
      recording_consent_given?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('call_dispositions')
        .insert({ ...disposition, created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-dispositions'] });
      toast.success('Disposition saved');
    }
  });
}

export function useEscalationRules(businessName?: string) {
  return useQuery({
    queryKey: ['escalation-rules', businessName],
    queryFn: async () => {
      let query = supabase.from('escalation_rules').select('*').eq('is_active', true);
      if (businessName) {
        query = query.eq('business_name', businessName);
      }
      const { data, error } = await query.order('priority', { ascending: true });
      if (error) throw error;
      return data;
    }
  });
}

export function useComplianceLogs(contactId?: string) {
  return useQuery({
    queryKey: ['compliance-logs', contactId],
    queryFn: async () => {
      let query = supabase.from('communication_compliance_logs').select('*');
      if (contactId) {
        query = query.eq('contact_id', contactId);
      }
      const { data, error } = await query.order('logged_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });
}

export function useDeliveryStatus(sourceId?: string) {
  return useQuery({
    queryKey: ['delivery-status', sourceId],
    queryFn: async () => {
      let query = supabase.from('communication_delivery_status').select('*');
      if (sourceId) {
        query = query.eq('source_id', sourceId);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });
}
