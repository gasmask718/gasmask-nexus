/**
 * Ambassador Communications hooks
 * - Threads = every assigned store (always shown), joined with last message + unread count.
 * - Live messages per store with realtime subscription.
 * - Templates CRUD on ambassador_message_templates.
 * - KPI rollup from ambassador_activity_log.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useViewAs } from '@/contexts/ViewAsContext';
import { toast } from 'sonner';
import { useEffect } from 'react';
import { verifiedInsert, mutationErrorMessage } from '@/lib/verifiedMutation';

export interface MessageThread {
  id: string;
  store_id: string;
  store_name: string;
  contact_name: string;
  contact_phone: string | null;
  borough_id: string | null;
  language_preference: string | null;
  last_visit_at: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  channel: 'sms' | 'whatsapp' | 'email' | 'internal';
  owed_amount: number | null;
}

export interface AmbassadorMessage {
  id: string;
  store_id: string | null;
  ambassador_id: string | null;
  content: string;
  body_translated: string | null;
  direction: 'inbound' | 'outbound';
  status: string;
  media_urls: string[];
  channel: string;
  created_at: string;
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
  recording_url: string | null;
  transcript: string | null;
  ai_assisted: boolean;
  follow_up_required: boolean;
  follow_up_date: string | null;
  created_at: string;
}

export interface MessageTemplate {
  id: string;
  ambassador_id: string | null;
  is_global: boolean;
  name: string;
  category: string;
  body_en: string;
  body_ar: string;
  variables: string[];
  usage_count: number;
  last_used_at: string | null;
}

/**
 * Resolve current ambassador row (cached).
 * - If admin is impersonating via ViewAsContext, returns that ambassador's row.
 * - Otherwise resolves from auth.uid(); picks the oldest row (deterministic) when
 *   multiple ambassador records share the same user_id (legacy seed data).
 */
export function useCurrentAmbassador() {
  const { user } = useAuth();
  const { viewAsAmbassador } = useViewAs();
  const impersonatedId = viewAsAmbassador?.id ?? null;

  return useQuery({
    queryKey: ['current-ambassador', user?.id, impersonatedId],
    queryFn: async () => {
      // Impersonation path — fetch the target ambassador directly
      if (impersonatedId) {
        const { data, error } = await supabase
          .from('ambassadors')
          .select('id, name, twilio_number, phone_primary')
          .eq('id', impersonatedId)
          .limit(1);
        if (error) throw error;
        return data?.[0] ?? null;
      }

      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('ambassadors')
        .select('id, name, twilio_number, phone_primary, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!user?.id || !!impersonatedId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Public helper — effective ambassador id (impersonated or own). */
export function useEffectiveAmbassadorId(): string | null {
  const { viewAsAmbassador } = useViewAs();
  const ambQ = useCurrentAmbassador();
  return viewAsAmbassador?.id ?? ambQ.data?.id ?? null;
}

/** Threads = one per assigned store, enriched with last message + unread count. */
export function useAmbassadorThreads() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const ambQ = useCurrentAmbassador();
  const ambassadorId = ambQ.data?.id;

  const threadsQuery = useQuery({
    queryKey: ['ambassador-threads-v2', ambassadorId],
    queryFn: async (): Promise<MessageThread[]> => {
      if (!ambassadorId) return [];

      // 1a. Stores via ambassador_assignments (primary join). Excludes soft-deleted.
      const { data: assignments, error: aErr } = await supabase
        .from('ambassador_assignments')
        .select(`
          store_id,
          store:store_master!store_id(
            id, store_name, owner_name, phone, borough_id,
            language_preference, last_visit_at, owed_amount, deleted_at
          )
        `)
        .eq('ambassador_id', ambassadorId)
        .eq('active', true)
        .not('store_id', 'is', null);
      if (aErr) throw aErr;

      const storesMap = new Map<string, any>();
      for (const a of assignments || []) {
        const s = a.store as any;
        if (s?.id && !s.deleted_at && s.store_name) storesMap.set(s.id, s);
      }

      // 1b. Fallback — direct assignment on store_master.assigned_ambassador_id
      const { data: directStores, error: dErr } = await supabase
        .from('store_master')
        .select('id, store_name, owner_name, phone, borough_id, language_preference, last_visit_at, owed_amount')
        .eq('assigned_ambassador_id', ambassadorId)
        .is('deleted_at', null)
        .not('store_name', 'is', null);
      if (dErr) throw dErr;
      for (const s of directStores || []) {
        if (s?.id && !storesMap.has(s.id)) storesMap.set(s.id, s);
      }

      // Defensive contamination guard: filter rows whose store_name matches an ambassador
      if (storesMap.size) {
        const candidateNames = Array.from(storesMap.values()).map((s) => s.store_name).filter(Boolean);
        if (candidateNames.length) {
          const { data: ambs } = await supabase
            .from('ambassadors')
            .select('name')
            .in('name', candidateNames);
          const ambNames = new Set((ambs || []).map((a: any) => (a.name || '').trim().toLowerCase()));
          for (const [id, s] of storesMap) {
            if (ambNames.has((s.store_name || '').trim().toLowerCase())) {
              if (import.meta.env.DEV) {
                // eslint-disable-next-line no-console
                console.warn('[useAmbassadorThreads] Filtered contaminated store (matches ambassador name):', s);
              }
              storesMap.delete(id);
            }
          }
        }
      }

      const stores = Array.from(storesMap.values());

      // 2. Latest message per store (single batched query)
      const storeIds = stores.map((s) => s.id);
      let lastByStore = new Map<string, any>();
      if (storeIds.length) {
        const { data: msgs } = await supabase
          .from('communication_messages')
          .select('store_id, content, created_at, direction, status')
          .eq('ambassador_id', ambassadorId)
          .in('store_id', storeIds)
          .order('created_at', { ascending: false })
          .limit(500);
        for (const m of msgs || []) {
          if (!lastByStore.has(m.store_id!)) lastByStore.set(m.store_id!, m);
        }
      }

      return stores.map((s): MessageThread => {
        const last = lastByStore.get(s.id);
        return {
          id: s.id,
          store_id: s.id,
          store_name: s.store_name || 'Unknown store',
          contact_name: s.owner_name || 'Owner',
          contact_phone: s.phone,
          borough_id: s.borough_id,
          language_preference: s.language_preference,
          last_visit_at: s.last_visit_at,
          owed_amount: s.owed_amount,
          last_message: last?.content || '',
          last_message_at: last?.created_at || s.last_visit_at || new Date(0).toISOString(),
          unread_count: 0, // populated below via separate count if needed
          channel: 'sms',
        };
      }).sort((a, b) =>
        new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
      );
    },
    enabled: !!ambassadorId,
  });

  // Realtime: refresh thread list when new inbound arrives for this ambassador
  useEffect(() => {
    if (!ambassadorId) return;
    const ch = supabase
      .channel(`amb-threads-${ambassadorId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'communication_messages', filter: `ambassador_id=eq.${ambassadorId}` },
        () => queryClient.invalidateQueries({ queryKey: ['ambassador-threads-v2', ambassadorId] })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ambassadorId, queryClient]);

  // Send message via edge function
  const sendMessageMutation = useMutation({
    mutationFn: async (input: { storeId: string; phone: string; content: string; bodyAr?: string; mediaUrls?: string[]; templateId?: string | null }) => {
      const { data, error } = await supabase.functions.invoke('ambassador-send-sms', {
        body: {
          store_id: input.storeId,
          to_phone: input.phone,
          body: input.content,
          body_translated: input.bodyAr,
          media_urls: input.mediaUrls || [],
          template_id: input.templateId || null,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['ambassador-threads-v2'] });
      queryClient.invalidateQueries({ queryKey: ['store-messages', vars.storeId] });
      queryClient.invalidateQueries({ queryKey: ['ambassador-kpis'] });
    },
    onError: (e: Error) => toast.error(`Send failed: ${e.message}`),
  });

  return {
    threads: threadsQuery.data || [],
    isLoading: threadsQuery.isLoading || ambQ.isLoading,
    ambassador: ambQ.data,
    sendMessage: sendMessageMutation.mutateAsync,
    isSending: sendMessageMutation.isPending,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['ambassador-threads-v2'] }),
  };
}

/** Live messages for one store, scoped to the current ambassador. */
export function useStoreMessages(storeId: string | null) {
  const queryClient = useQueryClient();
  const ambQ = useCurrentAmbassador();
  const ambassadorId = ambQ.data?.id;

  const messagesQuery = useQuery({
    queryKey: ['store-messages', storeId, ambassadorId],
    queryFn: async (): Promise<AmbassadorMessage[]> => {
      if (!storeId || !ambassadorId) return [];
      const { data, error } = await supabase
        .from('communication_messages')
        .select('id, store_id, ambassador_id, content, body_translated, direction, status, media_urls, channel, created_at')
        .eq('ambassador_id', ambassadorId)
        .eq('store_id', storeId)
        .order('created_at', { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data || []).map((m: any) => ({
        ...m,
        content: m.content || '',
        media_urls: Array.isArray(m.media_urls) ? m.media_urls : [],
      }));
    },
    enabled: !!storeId && !!ambassadorId,
  });

  useEffect(() => {
    if (!storeId || !ambassadorId) return;
    const ch = supabase
      .channel(`store-msgs-${storeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'communication_messages', filter: `store_id=eq.${storeId}` },
        () => queryClient.invalidateQueries({ queryKey: ['store-messages', storeId, ambassadorId] })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [storeId, ambassadorId, queryClient]);

  return messagesQuery;
}

/** Log a call. Used by click-to-call and AI-assisted flows. */
export function useLogCall() {
  const queryClient = useQueryClient();
  const ambQ = useCurrentAmbassador();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      storeId: string;
      phone: string;
      type: 'inbound' | 'outbound' | 'missed';
      duration?: number;
      outcome?: string;
      notes?: string;
      aiAssisted?: boolean;
      recordingUrl?: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');
      const ambassadorId = ambQ.data?.id;
      const { data, error } = await supabase
        .from('communication_logs')
        .insert({
          store_id: input.storeId,
          ambassador_id: ambassadorId,
          created_by: user.id,
          channel: 'call',
          direction: input.type === 'inbound' ? 'inbound' : 'outbound',
          summary: input.notes || `${input.type} call`,
          outcome: input.outcome || input.type,
          call_duration: input.duration || null,
          recipient_phone: input.phone,
          ai_assisted: !!input.aiAssisted,
          recording_url: input.recordingUrl || null,
        })
        .select()
        .single();
      if (error) throw error;

      if (ambassadorId) {
        await verifiedInsert('log ambassador call activity', () =>
          supabase.from('ambassador_activity_log').insert({
            ambassador_id: ambassadorId,
            store_id: input.storeId,
            action_type: input.aiAssisted ? 'ai_call_made' : 'call_made',
            metadata: { phone: input.phone, outcome: input.outcome },
          }),
        );
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ambassador-call-history'] });
      queryClient.invalidateQueries({ queryKey: ['ambassador-kpis'] });
    },
    onError: (e: unknown) => toast.error(`Log failed: ${mutationErrorMessage(e)}`, { duration: 8000 }),
  });
}

export function useCallHistory() {
  const ambQ = useCurrentAmbassador();
  const ambassadorId = ambQ.data?.id;

  return useQuery({
    queryKey: ['ambassador-call-history', ambassadorId],
    queryFn: async (): Promise<CallLog[]> => {
      if (!ambassadorId) return [];
      const { data, error } = await (supabase
        .from('communication_logs') as any)
        .select('*, store:store_master!store_id(store_name, owner_name, phone)')
        .eq('ambassador_id', ambassadorId)
        .eq('channel', 'call')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []).map((log: any): CallLog => ({
        id: log.id,
        store_id: log.store_id || '',
        store_name: log.store?.store_name || 'Unknown',
        contact_name: log.store?.owner_name || 'Contact',
        phone: log.recipient_phone || log.store?.phone || '',
        type: log.direction === 'inbound' ? 'inbound' : 'outbound',
        duration_seconds: log.call_duration,
        outcome: log.outcome,
        notes: log.summary,
        recording_url: log.recording_url,
        transcript: log.transcription,
        ai_assisted: !!log.ai_assisted,
        follow_up_required: !!log.follow_up_required,
        follow_up_date: log.follow_up_date,
        created_at: log.created_at,
      }));
    },
    enabled: !!ambassadorId,
  });
}

/** Templates CRUD */
export function useTemplates() {
  const queryClient = useQueryClient();
  const ambQ = useCurrentAmbassador();
  const ambassadorId = ambQ.data?.id;

  const listQuery = useQuery({
    queryKey: ['ambassador-templates', ambassadorId],
    queryFn: async (): Promise<MessageTemplate[]> => {
      const { data, error } = await supabase
        .from('ambassador_message_templates')
        .select('*')
        .order('usage_count', { ascending: false });
      if (error) throw error;
      return (data || []).map((t: any) => ({
        ...t,
        variables: Array.isArray(t.variables) ? t.variables : [],
      }));
    },
    enabled: !!ambassadorId,
  });

  const upsert = useMutation({
    mutationFn: async (input: Partial<MessageTemplate> & { id?: string }) => {
      const payload: any = {
        name: input.name,
        category: input.category || 'custom',
        body_en: input.body_en || '',
        body_ar: input.body_ar || '',
        variables: input.variables || [],
        ambassador_id: ambassadorId,
        is_global: false,
      };
      if (input.id) {
        const { error } = await supabase
          .from('ambassador_message_templates')
          .update(payload)
          .eq('id', input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ambassador_message_templates')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ambassador-templates'] });
      toast.success('Template saved');
    },
    onError: (e: Error) => toast.error(`Save failed: ${e.message}`),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ambassador_message_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ambassador-templates'] });
      toast.success('Template deleted');
    },
    onError: (e: Error) => toast.error(`Delete failed: ${e.message}`),
  });

  const recordUsage = useMutation({
    mutationFn: async (id: string) => {
      const tpl = listQuery.data?.find((t) => t.id === id);
      if (!tpl) return;
      await supabase
        .from('ambassador_message_templates')
        .update({ usage_count: (tpl.usage_count || 0) + 1, last_used_at: new Date().toISOString() })
        .eq('id', id);
    },
  });

  return {
    templates: listQuery.data || [],
    isLoading: listQuery.isLoading,
    upsert: upsert.mutateAsync,
    isSaving: upsert.isPending,
    remove: remove.mutateAsync,
    recordUsage: recordUsage.mutate,
  };
}

/** Render a template body, replacing {{vars}} with store/ambassador data. */
export function renderTemplate(body: string, ctx: Record<string, string | number | null | undefined>) {
  return body.replace(/\{\{\s*([\w_]+)\s*\}\}/g, (_, key) => {
    const v = ctx[key];
    return v == null ? '' : String(v);
  });
}

/** KPI strip: today's totals + 24h response rate */
export function useAmbassadorKPIs() {
  const ambQ = useCurrentAmbassador();
  const ambassadorId = ambQ.data?.id;

  return useQuery({
    queryKey: ['ambassador-kpis', ambassadorId],
    queryFn: async () => {
      if (!ambassadorId) return { messages: 0, calls: 0, storesContacted: 0, responseRate: 0 };

      const todayIso = new Date(); todayIso.setHours(0, 0, 0, 0);
      const since = todayIso.toISOString();

      const [{ count: msgCount }, { count: callCount }, { data: contacted }, { data: yesterdayOut }, { data: replies }] = await Promise.all([
        supabase.from('communication_messages').select('id', { count: 'exact', head: true }).eq('ambassador_id', ambassadorId).eq('direction', 'outbound').gte('created_at', since),
        supabase.from('communication_logs').select('id', { count: 'exact', head: true }).eq('ambassador_id', ambassadorId).eq('channel', 'call').gte('created_at', since),
        supabase.from('communication_messages').select('store_id').eq('ambassador_id', ambassadorId).gte('created_at', since),
        supabase.from('communication_messages').select('store_id, created_at').eq('ambassador_id', ambassadorId).eq('direction', 'outbound').gte('created_at', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()),
        supabase.from('communication_messages').select('store_id, created_at').eq('ambassador_id', ambassadorId).eq('direction', 'inbound').gte('created_at', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()),
      ]);

      const stores = new Set((contacted || []).map((r: any) => r.store_id).filter(Boolean));
      const outCount = (yesterdayOut || []).length;
      const replyStores = new Set((replies || []).map((r: any) => r.store_id));
      const respondedOutbound = (yesterdayOut || []).filter((o: any) => replyStores.has(o.store_id)).length;
      const responseRate = outCount ? Math.round((respondedOutbound / outCount) * 100) : 0;

      return {
        messages: msgCount || 0,
        calls: callCount || 0,
        storesContacted: stores.size,
        responseRate,
      };
    },
    enabled: !!ambassadorId,
  });
}

/** Activity feed for a store (re-exported for store sidebar). */
export function useStoreActivityTimeline(storeId: string | null) {
  return useQuery({
    queryKey: ['store-activity', storeId],
    queryFn: async () => {
      if (!storeId) return [];
      const { data, error } = await supabase
        .from('communication_logs')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) return [];
      return data || [];
    },
    enabled: !!storeId,
  });
}

/** Generic activity logger (kept for back-compat). */
export function useLogStoreActivity() {
  const { user } = useAuth();
  const ambQ = useCurrentAmbassador();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { storeId: string; channel: string; summary: string; outcome?: string; messageContent?: string }) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase.from('communication_logs').insert({
        store_id: input.storeId,
        ambassador_id: ambQ.data?.id,
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
      queryClient.invalidateQueries({ queryKey: ['store-activity'] });
    },
  });
}
