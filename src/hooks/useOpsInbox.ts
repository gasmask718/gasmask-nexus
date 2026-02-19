import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface OpsThread {
  id: string;
  type: string;
  title: string;
  entity_type: string | null;
  entity_id: string | null;
  created_by: string;
  created_at: string;
  closed_at: string | null;
  status: string;
  priority: string;
  targeting: Record<string, any>;
  metadata: Record<string, any>;
  // Joined
  latest_message?: string;
  unread?: boolean;
  recipient_state?: {
    read_at: string | null;
    acknowledged_at: string | null;
    resolved_at: string | null;
    snoozed_until: string | null;
  };
}

export interface OpsMessage {
  id: string;
  thread_id: string;
  sender_user_id: string | null;
  sender_type: string;
  body: string;
  attachments: any;
  created_at: string;
}

export function useOpsInboxThreads(filter?: { status?: string; type?: string }) {
  return useQuery({
    queryKey: ['ops-inbox-threads', filter],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get recipient rows for current user
      let recipientQuery = supabase
        .from('ops_inbox_recipients')
        .select('thread_id, read_at, acknowledged_at, resolved_at, snoozed_until')
        .eq('user_id', user.id)
        .order('delivered_at', { ascending: false })
        .limit(50);

      const { data: recipients, error: rErr } = await recipientQuery;
      if (rErr || !recipients?.length) return [];

      const threadIds = recipients.map(r => r.thread_id);

      let threadQuery = supabase
        .from('ops_inbox_threads')
        .select('*')
        .in('id', threadIds)
        .order('created_at', { ascending: false });

      if (filter?.status) threadQuery = threadQuery.eq('status', filter.status);
      if (filter?.type) threadQuery = threadQuery.eq('type', filter.type);

      const { data: threads, error: tErr } = await threadQuery;
      if (tErr) throw tErr;

      // Get latest message per thread
      const { data: messages } = await supabase
        .from('ops_inbox_messages')
        .select('thread_id, body, created_at')
        .in('thread_id', threadIds)
        .order('created_at', { ascending: false });

      const latestByThread = new Map<string, string>();
      messages?.forEach(m => {
        if (!latestByThread.has(m.thread_id)) latestByThread.set(m.thread_id, m.body);
      });

      const recipientMap = new Map(recipients.map(r => [r.thread_id, r]));

      return (threads || []).map(t => ({
        ...t,
        latest_message: latestByThread.get(t.id) || '',
        unread: !recipientMap.get(t.id)?.read_at,
        recipient_state: recipientMap.get(t.id) || null,
      })) as OpsThread[];
    },
    staleTime: 30_000,
  });
}

export function useOpsThreadMessages(threadId: string | undefined) {
  return useQuery({
    queryKey: ['ops-inbox-messages', threadId],
    queryFn: async () => {
      if (!threadId) return [];
      const { data, error } = await supabase
        .from('ops_inbox_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as OpsMessage[];
    },
    enabled: !!threadId,
  });
}

export function useOpsUnreadCount() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['ops-inbox-unread-count'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;
      const { count, error } = await supabase
        .from('ops_inbox_recipients')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null);
      if (error) return 0;
      return count || 0;
    },
    staleTime: 15_000,
  });

  // Realtime subscription for live updates
  useEffect(() => {
    const channel = supabase
      .channel('ops-inbox-unread')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ops_inbox_recipients',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['ops-inbox-unread-count'] });
        queryClient.invalidateQueries({ queryKey: ['ops-inbox-threads'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}

export function useMarkThreadRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (threadId: string) => {
      const { error } = await supabase.rpc('mark_ops_thread_read', { p_thread_id: threadId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ops-inbox-unread-count'] });
      qc.invalidateQueries({ queryKey: ['ops-inbox-threads'] });
    },
  });
}

export function useAckThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (threadId: string) => {
      const { error } = await supabase.rpc('ack_ops_thread', { p_thread_id: threadId });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ops-inbox-threads'] }); },
  });
}

export function useResolveThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (threadId: string) => {
      const { error } = await supabase.rpc('resolve_ops_thread', { p_thread_id: threadId });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ops-inbox-threads'] }); },
  });
}

export function useSnoozeThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ threadId, until }: { threadId: string; until: string }) => {
      const { error } = await supabase.rpc('snooze_ops_thread', { p_thread_id: threadId, p_until: until });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ops-inbox-threads'] }); },
  });
}

export function useReplyToThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ threadId, body }: { threadId: string; body: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('ops_inbox_messages').insert({
        thread_id: threadId,
        sender_user_id: user.id,
        sender_type: 'user',
        body,
      });
      if (error) throw error;
    },
    onSuccess: (_, { threadId }) => {
      qc.invalidateQueries({ queryKey: ['ops-inbox-messages', threadId] });
    },
  });
}
