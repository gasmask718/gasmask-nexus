import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect } from "react";

export interface OrderMessage {
  id: string;
  order_id: string;
  sender_user_id: string;
  sender_role: 'customer' | 'vendor' | 'admin' | 'system';
  vendor_id: string | null;
  message_body: string;
  message_type: 'standard' | 'system' | 'dispute_related';
  is_read: boolean;
  attachment_url: string | null;
  is_archived: boolean;
  created_at: string;
}

// Rate limit: track sends in memory
const sendTimestamps: number[] = [];
const RATE_LIMIT_WINDOW = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX = 5;

function checkRateLimit(): boolean {
  const now = Date.now();
  // Purge old entries
  while (sendTimestamps.length > 0 && now - sendTimestamps[0] > RATE_LIMIT_WINDOW) {
    sendTimestamps.shift();
  }
  return sendTimestamps.length < RATE_LIMIT_MAX;
}

export function useOrderMessages(orderId: string, vendorId?: string | null) {
  const queryClient = useQueryClient();

  const messagesQuery = useQuery({
    queryKey: ['order-messages', orderId, vendorId],
    queryFn: async () => {
      let query = supabase
        .from('order_messages')
        .select('*')
        .eq('order_id', orderId)
        .eq('is_archived', false)
        .order('created_at', { ascending: true });

      // If vendor context, filter to their thread
      if (vendorId) {
        query = query.or(`vendor_id.eq.${vendorId},vendor_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as OrderMessage[];
    },
    enabled: !!orderId,
  });

  // Realtime subscription
  useEffect(() => {
    if (!orderId) return;

    const channel = supabase
      .channel(`order-messages-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_messages',
          filter: `order_id=eq.${orderId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['order-messages', orderId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, queryClient]);

  const sendMessage = useMutation({
    mutationFn: async ({
      messageBody,
      senderRole,
      vendorId: msgVendorId,
    }: {
      messageBody: string;
      senderRole: 'customer' | 'vendor' | 'admin';
      vendorId?: string | null;
    }) => {
      // Rate limit check
      if (!checkRateLimit()) {
        throw new Error('Message rate limit reached. Please wait before sending more messages.');
      }

      // Sanitize: strip HTML tags
      const sanitized = messageBody.replace(/<[^>]*>/g, '').trim();
      if (!sanitized || sanitized.length === 0) {
        throw new Error('Message cannot be empty');
      }
      if (sanitized.length > 2000) {
        throw new Error('Message too long (max 2000 characters)');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('order_messages')
        .insert({
          order_id: orderId,
          sender_user_id: user.id,
          sender_role: senderRole,
          vendor_id: msgVendorId || null,
          message_body: sanitized,
        });

      if (error) throw error;
      sendTimestamps.push(Date.now());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-messages', orderId] });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const markAsRead = useMutation({
    mutationFn: async (messageIds: string[]) => {
      const { error } = await supabase
        .from('order_messages')
        .update({ is_read: true })
        .in('id', messageIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-messages', orderId] });
    },
  });

  const unreadCount = messagesQuery.data?.filter(m => !m.is_read).length || 0;

  return {
    messages: messagesQuery.data || [],
    isLoading: messagesQuery.isLoading,
    unreadCount,
    sendMessage: sendMessage.mutateAsync,
    isSending: sendMessage.isPending,
    markAsRead: markAsRead.mutateAsync,
  };
}

// Hook for unread count badge (lightweight)
export function useOrderUnreadCount(orderId: string) {
  return useQuery({
    queryKey: ['order-messages-unread', orderId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('order_messages')
        .select('*', { count: 'exact', head: true })
        .eq('order_id', orderId)
        .eq('is_read', false)
        .eq('is_archived', false);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!orderId,
  });
}
