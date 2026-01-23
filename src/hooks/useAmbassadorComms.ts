/**
 * Ambassador Communications Hook - Messages and call logging
 * Integrates with communication_logs table for activity tracking
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface MessageThread {
  id: string;
  store_id: string;
  store_name: string;
  contact_name: string;
  contact_phone: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  channel: 'sms' | 'whatsapp' | 'email' | 'internal';
}

export interface Message {
  id: string;
  thread_id: string;
  content: string;
  direction: 'inbound' | 'outbound';
  status: 'sent' | 'delivered' | 'read' | 'failed';
  created_at: string;
  sender_name?: string;
}

export interface CallLog {
  id: string;
  store_id: string;
  store_name: string;
  contact_name: string;
  phone: string;
  type: 'inbound' | 'outbound' | 'missed';
  duration_seconds: number | null;
  outcome: string | null;
  notes: string | null;
  created_at: string;
}

/**
 * Fetch message threads for ambassador's stores
 */
export function useAmbassadorThreads() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get ambassador's store IDs first
  const storesQuery = useQuery({
    queryKey: ['ambassador-store-ids-for-comms', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data: ambassador } = await supabase
        .from('ambassadors')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!ambassador) return [];

      const { data: assignments } = await supabase
        .from('ambassador_assignments')
        .select('store_id, store:store_master!store_id(store_name, phone, owner_name)')
        .eq('ambassador_id', ambassador.id)
        .eq('active', true)
        .not('store_id', 'is', null);

      return (assignments || []).map(a => ({
        store_id: a.store_id,
        store_name: (a.store as any)?.store_name || 'Unknown',
        contact_name: (a.store as any)?.owner_name || 'Owner',
        phone: (a.store as any)?.phone,
      }));
    },
    enabled: !!user?.id,
  });

  // Fetch threads from communication_messages
  const threadsQuery = useQuery({
    queryKey: ['ambassador-threads', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('communication_messages')
        .select('*')
        .eq('owner_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.log('Threads query error (expected if table different):', error.message);
        return [];
      }

      return data || [];
    },
    enabled: !!user?.id,
  });

  // Build synthetic threads from stores for now
  const stores = storesQuery.data || [];
  const threads: MessageThread[] = stores.map((store) => ({
    id: store.store_id,
    store_id: store.store_id,
    store_name: store.store_name,
    contact_name: store.contact_name,
    contact_phone: store.phone,
    last_message: 'Start a conversation',
    last_message_at: new Date().toISOString(),
    unread_count: 0,
    channel: 'sms' as const,
  }));

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (input: { storeId: string; phone: string; content: string; contactName: string }) => {
      // Call the send-sms edge function
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          to: input.phone,
          message: input.content,
          contact_id: input.storeId,
          contact_name: input.contactName,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ambassador-threads'] });
      toast.success('Message sent');
    },
    onError: (error: Error) => {
      toast.error(`Failed to send message: ${error.message}`);
    },
  });

  return {
    threads,
    stores: storesQuery.data || [],
    isLoading: storesQuery.isLoading || threadsQuery.isLoading,
    sendMessage: sendMessageMutation.mutateAsync,
    isSending: sendMessageMutation.isPending,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['ambassador-threads'] });
    },
  };
}

/**
 * Log a call attempt for activity tracking
 */
export function useLogCall() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      storeId: string;
      phone: string;
      type: 'inbound' | 'outbound' | 'missed';
      duration?: number;
      outcome?: string;
      notes?: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Log to communication_logs table with correct schema
      const { error } = await supabase
        .from('communication_logs')
        .insert({
          store_id: input.storeId,
          created_by: user.id,
          channel: 'call',
          direction: input.type === 'inbound' ? 'inbound' : 'outbound',
          summary: input.notes || `${input.type} call`,
          outcome: input.outcome || input.type,
          call_duration: input.duration || null,
          recipient_phone: input.phone,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ambassador-store-activity'] });
      toast.success('Call logged');
    },
    onError: (error: Error) => {
      toast.error(`Failed to log call: ${error.message}`);
    },
  });
}

/**
 * Fetch call history for ambassador's stores
 */
export function useCallHistory() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['ambassador-call-history', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('communication_logs')
        .select('*, store:store_master!store_id(store_name, owner_name, phone)')
        .eq('created_by', user.id)
        .eq('channel', 'call')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.log('Call history error:', error.message);
        return [];
      }

      return (data || []).map((log): CallLog => ({
        id: log.id,
        store_id: log.store_id || '',
        store_name: (log.store as any)?.store_name || 'Unknown Store',
        contact_name: (log.store as any)?.owner_name || 'Contact',
        phone: log.recipient_phone || (log.store as any)?.phone || '',
        type: log.direction === 'inbound' ? 'inbound' : 'outbound',
        duration_seconds: log.call_duration,
        outcome: log.outcome,
        notes: log.summary,
        created_at: log.created_at,
      }));
    },
    enabled: !!user?.id,
  });
}

/**
 * Log a store activity (visit, note, message, etc.)
 */
export function useLogStoreActivity() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      storeId: string;
      channel: 'call' | 'sms' | 'email' | 'visit' | 'note';
      summary: string;
      outcome?: string;
      messageContent?: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('communication_logs')
        .insert({
          store_id: input.storeId,
          created_by: user.id,
          channel: input.channel,
          direction: 'outbound',
          summary: input.summary,
          outcome: input.outcome || null,
          message_content: input.messageContent || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ambassador-store-activity'] });
      queryClient.invalidateQueries({ queryKey: ['store-activity'] });
      toast.success('Activity logged');
    },
    onError: (error: Error) => {
      toast.error(`Failed to log activity: ${error.message}`);
    },
  });
}

/**
 * Fetch activity timeline for a specific store
 */
export function useStoreActivityTimeline(storeId: string | null) {
  return useQuery({
    queryKey: ['store-activity', storeId],
    queryFn: async () => {
      if (!storeId) return [];

      const { data, error } = await supabase
        .from('communication_logs')
        .select('*, created_by_profile:profiles!created_by(name)')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.log('Activity timeline error:', error.message);
        return [];
      }

      return data || [];
    },
    enabled: !!storeId,
  });
}
