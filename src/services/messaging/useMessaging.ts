import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useEffect } from "react";

export interface MessageThread {
  id: string;
  thread_type: string;
  participants: Array<{ user_id: string; role: string; name?: string }>;
  last_message: string | null;
  last_message_at: string | null;
  subject: string | null;
  order_id: string | null;
  status: string;
  created_at: string;
  unread_count?: number;
}

export interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_role: string;
  receiver_id: string | null;
  receiver_role: string | null;
  message_text: string;
  translated_text: Record<string, string>;
  attachments: Array<{ url: string; type: string; name: string }>;
  read_by: string[];
  is_system_message: boolean;
  is_whisper: boolean;
  starred_by: string[];
  created_at: string;
}

export function useThreads(filter?: { type?: string; status?: string }) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['message-threads', user?.id, filter],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from('message_threads')
        .select('*')
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (filter?.type) {
        query = query.eq('thread_type', filter.type);
      }
      if (filter?.status) {
        query = query.eq('status', filter.status);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map(thread => ({
        ...thread,
        participants: thread.participants as MessageThread['participants'],
      })) as MessageThread[];
    },
    enabled: !!user,
  });
}

export function useThread(threadId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['message-thread', threadId],
    queryFn: async () => {
      if (!user || !threadId) return null;

      const { data, error } = await supabase
        .from('message_threads')
        .select('*')
        .eq('id', threadId)
        .single();

      if (error) throw error;

      return {
        ...data,
        participants: data.participants as MessageThread['participants'],
      } as MessageThread;
    },
    enabled: !!user && !!threadId,
  });
}

export function useMessages(threadId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['messages', threadId],
    queryFn: async () => {
      if (!user || !threadId) return [];

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (data || []).map(msg => ({
        ...msg,
        translated_text: msg.translated_text as Record<string, string>,
        attachments: msg.attachments as Message['attachments'],
      })) as Message[];
    },
    enabled: !!user && !!threadId,
  });

  // Real-time subscription
  useEffect(() => {
    if (!threadId) return;

    const channel = supabase
      .channel(`messages-${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${threadId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['messages', threadId] });
          queryClient.invalidateQueries({ queryKey: ['message-threads'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, queryClient]);

  return query;
}

export function useSendMessage() {
  const { user, userRole } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      threadId,
      messageText,
      receiverId,
      receiverRole,
      attachments = [],
      isWhisper = false,
    }: {
      threadId: string;
      messageText: string;
      receiverId?: string;
      receiverRole?: string;
      attachments?: Message['attachments'];
      isWhisper?: boolean;
    }) => {
      if (!user) throw new Error('Must be logged in');

      const { data, error } = await supabase
        .from('messages')
        .insert([{
          thread_id: threadId,
          sender_id: user.id,
          sender_role: userRole || 'user',
          receiver_id: receiverId,
          receiver_role: receiverRole,
          message_text: messageText,
          attachments,
          is_whisper: isWhisper,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.threadId] });
      queryClient.invalidateQueries({ queryKey: ['message-threads'] });
    },
    onError: (error) => {
      toast.error(`Failed to send message: ${error.message}`);
    },
  });
}

export function useCreateThread() {
  const { user, userRole } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      threadType,
      participants,
      subject,
      orderId,
      initialMessage,
    }: {
      threadType: string;
      participants: MessageThread['participants'];
      subject?: string;
      orderId?: string;
      initialMessage?: string;
    }) => {
      if (!user) throw new Error('Must be logged in');

      // Add current user to participants if not present
      const allParticipants = participants.some(p => p.user_id === user.id)
        ? participants
        : [...participants, { user_id: user.id, role: userRole || 'user' }];

      const { data: thread, error: threadError } = await supabase
        .from('message_threads')
        .insert([{
          thread_type: threadType,
          participants: allParticipants,
          subject,
          order_id: orderId,
        }])
        .select()
        .single();

      if (threadError) throw threadError;

      // Send initial message if provided
      if (initialMessage) {
        const receiver = participants.find(p => p.user_id !== user.id);
        await supabase.from('messages').insert([{
          thread_id: thread.id,
          sender_id: user.id,
          sender_role: userRole || 'user',
          receiver_id: receiver?.user_id,
          receiver_role: receiver?.role,
          message_text: initialMessage,
        }]);
      }

      return thread;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-threads'] });
      toast.success('Conversation started');
    },
    onError: (error) => {
      toast.error(`Failed to create conversation: ${error.message}`);
    },
  });
}

export function useMarkAsRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageIds: string[]) => {
      if (!user || messageIds.length === 0) return;

      // Update each message to add user to read_by array
      for (const id of messageIds) {
        const { data: msg } = await supabase
          .from('messages')
          .select('read_by')
          .eq('id', id)
          .single();
        
        if (msg && !msg.read_by?.includes(user.id)) {
          await supabase
            .from('messages')
            .update({ read_by: [...(msg.read_by || []), user.id] })
            .eq('id', id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['message-threads'] });
    },
  });
}

export function useUnreadCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['unread-messages', user?.id],
    queryFn: async () => {
      if (!user) return 0;

      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .neq('sender_id', user.id)
        .not('read_by', 'cs', `{${user.id}}`);

      if (error) return 0;
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 30000, // Poll every 30s
  });
}
