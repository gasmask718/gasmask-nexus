import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * VA messaging data layer.
 *
 * Every query filters by `assigned_va = auth.uid()` at the query level in
 * addition to the RLS policies, so a policy regression cannot silently widen
 * what a VA sees.
 */

export type OutboundStatus = 'pending' | 'approved' | 'sent' | 'rejected' | 'edited' | 'failed';

export interface VALead {
  id: string;
  business_name: string | null;
  phone_number: string | null;
  lead_status: string | null;
}

export interface ThreadMessage {
  id: string;
  direction: 'outbound' | 'inbound';
  body: string;
  created_at: string;
  status: OutboundStatus | null;
  message_type: string | null;
  channel: string | null;
  resolved: boolean | null;
}

export interface Conversation {
  lead: VALead;
  lastMessage: ThreadMessage | null;
  unreadInbound: number;
  messageCount: number;
}

export const normalizePhone = (p: string | null | undefined) => (p || '').replace(/\D/g, '');

const LEAD_LIMIT = 500;

/** All leads assigned to this VA, optionally filtered server-side by search. */
export function useVAAssignedLeads(search: string) {
  const { user } = useAuth();
  const term = search.trim();

  return useQuery({
    queryKey: ['va-msg-leads', user?.id, term],
    enabled: !!user,
    queryFn: async () => {
      let q = (supabase as any)
        .from('brandaro_qualified_leads')
        .select('id, business_name, phone_number, lead_status')
        .eq('assigned_va', user!.id)
        .order('created_at', { ascending: false })
        .limit(LEAD_LIMIT);
      if (term) {
        const safe = term.replace(/[%,()]/g, '');
        q = q.or(`business_name.ilike.%${safe}%,phone_number.ilike.%${safe}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as VALead[];
    },
  });
}

/** Message activity across all of this VA's leads, folded into conversations. */
export function useVAConversations(search: string) {
  const { user } = useAuth();
  const { data: leads = [], isLoading: leadsLoading, error: leadsError } = useVAAssignedLeads(search);
  const leadIds = useMemo(() => leads.map((l) => l.id), [leads]);

  const activity = useQuery({
    queryKey: ['va-msg-activity', user?.id, leadIds],
    enabled: !!user && leadIds.length > 0,
    refetchInterval: 30_000,
    queryFn: async () => {
      const [outRes, inRes] = await Promise.all([
        (supabase as any)
          .from('brandaro_pending_messages')
          .select('id, lead_id, message_body, status, message_type, created_at')
          .in('lead_id', leadIds)
          .order('created_at', { ascending: false })
          .limit(1000),
        (supabase as any)
          .from('brandaro_inbound_messages')
          .select('id, lead_id, message, channel, resolved, created_at')
          .in('lead_id', leadIds)
          .order('created_at', { ascending: false })
          .limit(1000),
      ]);
      if (outRes.error) throw outRes.error;
      if (inRes.error) throw inRes.error;

      const byLead = new Map<string, ThreadMessage[]>();
      const push = (leadId: string | null, m: ThreadMessage) => {
        if (!leadId) return;
        const arr = byLead.get(leadId) ?? [];
        arr.push(m);
        byLead.set(leadId, arr);
      };

      (outRes.data || []).forEach((r: any) =>
        push(r.lead_id, {
          id: r.id,
          direction: 'outbound',
          body: r.message_body,
          created_at: r.created_at,
          status: r.status,
          message_type: r.message_type,
          channel: null,
          resolved: null,
        }),
      );
      (inRes.data || []).forEach((r: any) =>
        push(r.lead_id, {
          id: r.id,
          direction: 'inbound',
          body: r.message,
          created_at: r.created_at,
          status: null,
          message_type: null,
          channel: r.channel,
          resolved: r.resolved,
        }),
      );

      return byLead;
    },
  });

  const conversations: Conversation[] = useMemo(() => {
    const map = activity.data;
    return leads
      .map((lead) => {
        const msgs = (map?.get(lead.id) ?? []).slice().sort(
          (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
        );
        return {
          lead,
          lastMessage: msgs[0] ?? null,
          messageCount: msgs.length,
          unreadInbound: msgs.filter((m) => m.direction === 'inbound' && m.resolved !== true).length,
        };
      })
      .sort((a, b) => {
        const at = a.lastMessage ? +new Date(a.lastMessage.created_at) : 0;
        const bt = b.lastMessage ? +new Date(b.lastMessage.created_at) : 0;
        return bt - at;
      });
  }, [leads, activity.data]);

  return {
    conversations,
    isLoading: leadsLoading || (leadIds.length > 0 && activity.isLoading),
    error: (leadsError as Error | null) ?? (activity.error as Error | null),
  };
}

/** Full merged timeline for one lead (outbound drafts/sends + inbound replies). */
export function useVAThread(lead: VALead | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['va-msg-thread', user?.id, lead?.id],
    enabled: !!user && !!lead,
    refetchInterval: 30_000,
    queryFn: async () => {
      const phone = normalizePhone(lead!.phone_number);

      const [outRes, inRes] = await Promise.all([
        (supabase as any)
          .from('brandaro_pending_messages')
          .select('id, message_body, status, message_type, created_at')
          .eq('lead_id', lead!.id)
          .order('created_at', { ascending: true })
          .limit(500),
        (supabase as any)
          .from('brandaro_inbound_messages')
          .select('id, message, channel, resolved, created_at')
          .eq('lead_id', lead!.id)
          .order('created_at', { ascending: true })
          .limit(500),
      ]);
      if (outRes.error) throw outRes.error;
      if (inRes.error) throw inRes.error;

      const messages: ThreadMessage[] = [
        ...(outRes.data || []).map((r: any) => ({
          id: r.id,
          direction: 'outbound' as const,
          body: r.message_body,
          created_at: r.created_at,
          status: r.status as OutboundStatus,
          message_type: r.message_type,
          channel: null,
          resolved: null,
        })),
        ...(inRes.data || []).map((r: any) => ({
          id: r.id,
          direction: 'inbound' as const,
          body: r.message,
          created_at: r.created_at,
          status: null,
          message_type: null,
          channel: r.channel,
          resolved: r.resolved,
        })),
      ];

      // Phone-only inbound rows (lead_id never stamped) still belong in the thread.
      if (phone) {
        const { data: orphans } = await (supabase as any)
          .from('brandaro_inbound_messages')
          .select('id, message, channel, resolved, created_at, sender_phone')
          .is('lead_id', null)
          .limit(200);
        (orphans || [])
          .filter((r: any) => normalizePhone(r.sender_phone).endsWith(phone.slice(-10)))
          .forEach((r: any) =>
            messages.push({
              id: r.id,
              direction: 'inbound',
              body: r.message,
              created_at: r.created_at,
              status: null,
              message_type: null,
              channel: r.channel,
              resolved: r.resolved,
            }),
          );
      }

      return messages.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    },
  });
}

/** Badge count: unresolved inbound replies across this VA's leads. */
export function useVAUnreadInbound() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['va-msg-unread', user?.id],
    enabled: !!user,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data: leads } = await (supabase as any)
        .from('brandaro_qualified_leads')
        .select('id')
        .eq('assigned_va', user!.id)
        .limit(LEAD_LIMIT);
      const ids = (leads || []).map((l: any) => l.id);
      if (!ids.length) return 0;
      const { count } = await (supabase as any)
        .from('brandaro_inbound_messages')
        .select('id', { count: 'exact', head: true })
        .in('lead_id', ids)
        .not('resolved', 'is', true);
      return count || 0;
    },
  });
}

/** Invalidate every VA messaging query after a send. */
export function useVAMessagingRefresh() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['va-msg-thread'] });
    qc.invalidateQueries({ queryKey: ['va-msg-activity'] });
    qc.invalidateQueries({ queryKey: ['va-msg-unread'] });
  };
}
