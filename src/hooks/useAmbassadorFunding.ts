import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FundingChecklistStep {
  id: string;
  step_key: string;
  step_label: string;
  step_order: number;
  status: string;
  completed_at: string | null;
  provider: string | null;
  notes: string | null;
}

/** The signed-in ambassador's own funding client record + infrastructure checklist. */
export function useMyFundingClient() {
  return useQuery({
    queryKey: ['my-funding-client'],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return null;

      const { data: client, error } = await supabase
        .from('funding_clients')
        .select('id, full_name, stage, status, intake_status, current_dfs_score, score_tu, score_eq, score_ex, funding_target, funding_received, target_funding_amount, current_funding_ceiling, projected_funding_ceiling, consent_signed, created_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      if (!client) return null;

      const { data: checklist, error: clErr } = await supabase
        .from('funding_infrastructure_checklist')
        .select('id, step_key, step_label, step_order, status, completed_at, provider, notes')
        .eq('client_id', client.id)
        .order('step_order');
      if (clErr) throw clErr;

      return { client, checklist: (checklist ?? []) as FundingChecklistStep[] };
    },
  });
}

/** Ambassadors flag interest themselves; staff still approve and route manually. */
export function useExpressFundingInterest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ambassadorId: string) => {
      const { error } = await supabase
        .from('ambassadors')
        .update({
          funding_interest_expressed: true,
          funding_interest_expressed_at: new Date().toISOString(),
        })
        .eq('id', ambassadorId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-funding-client'] });
      qc.invalidateQueries({ queryKey: ['current-user-profile'] });
      qc.invalidateQueries({ queryKey: ['funding-invite-candidates'] });
    },
  });
}

export interface FundingInviteCandidate {
  id: string;
  name: string | null;
  email: string | null;
  phone_primary: string | null;
  city: string | null;
  state: string | null;
  status: string | null;
  funding_interest_expressed: boolean | null;
  funding_interest_expressed_at: string | null;
  funding_qualified: boolean | null;
  funding_qualified_at: string | null;
  funding_client_id: string | null;
}

/** Admin view: every ambassador who raised their hand or is already routed. */
export function useFundingInviteCandidates() {
  return useQuery({
    queryKey: ['funding-invite-candidates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassadors')
        .select('id, name, email, phone_primary, city, state, status, funding_interest_expressed, funding_interest_expressed_at, funding_qualified, funding_qualified_at, funding_client_id')
        .or('funding_interest_expressed.eq.true,funding_qualified.eq.true')
        .order('funding_interest_expressed_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as FundingInviteCandidate[];
    },
  });
}

/** Staff-triggered only. Calls the existing RPC — no client-side backend logic. */
export function useRouteAmbassadorToFunding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ambassadorId: string) => {
      const { data, error } = await supabase.rpc('route_ambassador_to_funding', {
        p_ambassador_id: ambassadorId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['funding-invite-candidates'] });
      qc.invalidateQueries({ queryKey: ['funding-sms-queue'] });
    },
  });
}

/** Queue visibility for admins (staff-only RLS). */
export function useFundingSmsQueue() {
  return useQuery({
    queryKey: ['funding-sms-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funding_sms_queue')
        .select('id, status, phone_number, message_body, related_kind, related_id, attempts, error, queued_at, sent_at')
        .order('queued_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useProcessFundingSmsQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('funding-sms-queue-processor', {
        body: { limit: 25 },
      });
      if (error) throw error;
      return data as { claimed: number; sent: number; blocked: number; failed: number; requeued: number };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['funding-sms-queue'] }),
  });
}
