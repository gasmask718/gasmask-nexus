import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect } from "react";

export interface Communication {
  id: string;
  entity_type: 'influencer' | 'ambassador' | 'store' | 'wholesaler' | 'driver' | 'biker';
  entity_id: string;
  channel: string;
  direction: 'inbound' | 'outbound';
  subject: string | null;
  message_body: string;
  external_message_id: string | null;
  sender: string;
  recipient: string;
  status: 'draft' | 'sent' | 'delivered' | 'read' | 'failed';
  occurred_at: string;
  created_by: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface NewCommunication {
  entity_type: 'influencer' | 'ambassador' | 'store' | 'wholesaler' | 'driver' | 'biker';
  entity_id: string;
  channel: string;
  direction: 'inbound' | 'outbound';
  subject?: string;
  message_body: string;
  sender: string;
  recipient: string;
  status?: string;
  metadata?: Record<string, any>;
}

export function useCommunications(entityType: string, entityId: string) {
  const queryClient = useQueryClient();
  const queryKey = ['communications', entityType, entityId];

  const { data: communications, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communications')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('occurred_at', { ascending: true });

      if (error) throw error;
      return data as Communication[];
    },
    enabled: !!entityId && !!entityType,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!entityId || !entityType) return;

    const channel = supabase
      .channel(`communications-${entityType}-${entityId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'communications',
          filter: `entity_id=eq.${entityId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [entityId, entityType, queryClient, queryKey]);

  return { communications, isLoading, error, refetch };
}

export function useSendCommunication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: NewCommunication) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('Not authenticated');

      const { data: inserted, error } = await supabase
        .from('communications')
        .insert({
          ...data,
          created_by: user.id,
          occurred_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return inserted;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ 
        queryKey: ['communications', data.entity_type, data.entity_id] 
      });
      toast.success('Message logged');
    },
    onError: (error: Error) => {
      toast.error(`Failed to log message: ${error.message}`);
    },
  });
}

export function useCommunicationStats(entityType: string, entityId: string) {
  return useQuery({
    queryKey: ['communication-stats', entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communications')
        .select('channel, direction, status, occurred_at')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId);

      if (error) throw error;

      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const stats = {
        total: data.length,
        last7Days: data.filter(c => new Date(c.occurred_at) >= sevenDaysAgo).length,
        last30Days: data.filter(c => new Date(c.occurred_at) >= thirtyDaysAgo).length,
        byChannel: {} as Record<string, number>,
        inbound: data.filter(c => c.direction === 'inbound').length,
        outbound: data.filter(c => c.direction === 'outbound').length,
        lastContact: data.length > 0 ? 
          data.reduce((latest, c) => 
            new Date(c.occurred_at) > new Date(latest.occurred_at) ? c : latest
          ).occurred_at : null,
      };

      data.forEach(c => {
        stats.byChannel[c.channel] = (stats.byChannel[c.channel] || 0) + 1;
      });

      return stats;
    },
    enabled: !!entityId && !!entityType,
  });
}
