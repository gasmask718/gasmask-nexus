import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { toast } from 'sonner';

/**
 * Scoped communications for field portals (ambassador / driver / biker).
 *
 * READ  → public.v_field_store_comms (RLS-scoped to assigned stores,
 *         recording URLs stripped out of the view entirely).
 * WRITE → field-portal-comms edge function, which re-checks assignment
 *         server-side and sends from the BUSINESS number.
 */

export interface FieldCommEntry {
  id: string;
  store_id: string | null;
  channel: string | null;
  call_type: string | null;
  direction: string | null;
  status: string | null;
  delivery_status: string | null;
  outcome: string | null;
  summary: string | null;
  message_content: string | null;
  notes: string | null;
  transcription: string | null;
  call_duration: number | null;
  duration_seconds: number | null;
  sender_phone: string | null;
  recipient_phone: string | null;
  started_at: string | null;
  answered_at: string | null;
  ended_at: string | null;
  sent_at: string | null;
  created_at: string | null;
  created_by: string | null;
}

/** The set of store IDs assigned to the signed-in field worker. */
export function useMyFieldStoreIds() {
  return useQuery({
    queryKey: ['my-field-store-ids'],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await (supabase as any).rpc('my_field_store_ids');
      if (error) throw error;
      return ((data as { store_id: string }[]) || [])
        .map((r) => r.store_id)
        .filter(Boolean);
    },
    staleTime: 60_000,
  });
}

/** Call + text history for ONE assigned store. RLS blocks unassigned stores. */
export function useFieldStoreComms(storeId?: string) {
  return useQuery({
    queryKey: ['field-store-comms', storeId],
    enabled: !!storeId,
    queryFn: async (): Promise<FieldCommEntry[]> => {
      const { data, error } = await (supabase as any)
        .from('v_field_store_comms')
        .select('*')
        .eq('store_id', storeId!)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as FieldCommEntry[];
    },
    staleTime: 15_000,
  });
}

async function invokeComms(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('field-portal-comms', {
    body: payload,
  });
  if (error) {
    const details =
      error instanceof FunctionsHttpError ? await error.context.text() : error.message;
    let parsed: any = null;
    try {
      parsed = JSON.parse(details);
    } catch {
      /* plain text */
    }
    throw new Error(parsed?.message || parsed?.error || details);
  }
  return data;
}

export function useSendFieldSms(storeId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      message: string;
      to_phone?: string | null;
      contact_id?: string | null;
    }) =>
      invokeComms({
        action: 'send_sms',
        store_id: storeId,
        message: vars.message,
        to_phone: vars.to_phone ?? null,
        contact_id: vars.contact_id ?? null,
      }),
    onSuccess: (data: any) => {
      // Suppression is a named outcome, not an error: the worker must know the
      // text did NOT go out and that a call is the honest fallback.
      if (data?.suppressed) {
        toast.warning(data.message || 'Store has opted out of texts — not sent. Call instead.');
      } else {
        toast.success('Text sent');
      }
      qc.invalidateQueries({ queryKey: ['field-store-comms', storeId] });
    },
    onError: (e: Error) => toast.error(e.message || 'Could not send text'),
  });
}

export function useStartFieldCall(storeId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      to_phone?: string | null;
      contact_id?: string | null;
      notes?: string | null;
    }) =>
      invokeComms({
        action: 'start_call',
        store_id: storeId,
        to_phone: vars.to_phone ?? null,
        contact_id: vars.contact_id ?? null,
        notes: vars.notes ?? null,
      }),
    onSuccess: (data: any) => {
      toast.success(data?.message || 'Your phone will ring shortly — answer to connect.');
      qc.invalidateQueries({ queryKey: ['field-store-comms', storeId] });
    },
    onError: (e: Error) => toast.error(e.message || 'Could not place call'),
  });
}
