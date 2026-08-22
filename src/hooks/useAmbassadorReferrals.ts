/**
 * useAmbassadorReferrals — GasMask ambassador referral pipeline.
 *
 * Flow: ambassador shares /ambassador-referral/:code → recruit self-submits
 * (public, no account) → PENDING referral → owner/admin approves or declines.
 * Approval creates an ambassador invite stamped with the referrer's ambassador
 * id and delivers it via send-ambassador-invite (SMS + email). Attribution
 * rides referrer_ambassador_id → ambassador_invites.invited_by_ambassador_id →
 * ambassadors.recruited_by_ambassador_id (all three accept paths).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type ReferralStatus = 'pending' | 'approved' | 'declined';

export interface AmbassadorReferral {
  id: string;
  referrer_ambassador_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  region: string | null;
  notes: string | null;
  status: ReferralStatus;
  decline_reason: string | null;
  show_decline_reason: boolean;
  invite_id: string | null;
  resulting_ambassador_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface AmbassadorReferralWithNames extends AmbassadorReferral {
  referrer_name: string | null;
  resulting_ambassador_name: string | null;
}

const QUERY_KEY = 'ambassador-referral-requests';

/** Current user's ambassador identity (id + tracking_code for the share link). */
export function useMyAmbassadorIdentity() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['ambassador-identity', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('ambassadors')
        .select('id, name, tracking_code')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data?.[0] || null) as { id: string; name: string | null; tracking_code: string | null } | null;
    },
    enabled: !!user?.id,
  });
}

/** Ambassador: my own referrals (RLS scopes to referrer). */
export function useMyReferrals(ambassadorId: string | null | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, 'mine', ambassadorId],
    queryFn: async () => {
      if (!ambassadorId) return [];
      const { data, error } = await supabase
        .from('ambassador_referral_requests')
        .select('*')
        .eq('referrer_ambassador_id', ambassadorId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as AmbassadorReferral[];
    },
    enabled: !!ambassadorId,
  });
}

/** Owner/admin: all referrals, decorated with referrer + resulting ambassador names. */
export function useAllReferrals() {
  return useQuery({
    queryKey: [QUERY_KEY, 'all'],
    queryFn: async () => {
      const { data: referrals, error } = await supabase
        .from('ambassador_referral_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (referrals || []) as AmbassadorReferral[];

      const ids = new Set<string>();
      rows.forEach(r => {
        ids.add(r.referrer_ambassador_id);
        if (r.resulting_ambassador_id) ids.add(r.resulting_ambassador_id);
      });

      let names: Record<string, string | null> = {};
      if (ids.size > 0) {
        const { data: ambs, error: ambErr } = await supabase
          .from('ambassadors')
          .select('id, name')
          .in('id', [...ids]);
        if (ambErr) throw ambErr;
        names = Object.fromEntries((ambs || []).map(a => [a.id, a.name]));
      }

      return rows.map(r => ({
        ...r,
        referrer_name: names[r.referrer_ambassador_id] ?? null,
        resulting_ambassador_name: r.resulting_ambassador_id ? names[r.resulting_ambassador_id] ?? null : null,
      })) as AmbassadorReferralWithNames[];
    },
  });
}

/** Per-referrer stats for the approval queue: lifetime referred / approved. */
export function referralStatsByAmbassador(referrals: AmbassadorReferral[]) {
  const map: Record<string, { total: number; approved: number }> = {};
  for (const r of referrals) {
    const entry = (map[r.referrer_ambassador_id] ||= { total: 0, approved: 0 });
    entry.total += 1;
    if (r.status === 'approved') entry.approved += 1;
  }
  return map;
}

/** Owner/admin review. Approve also delivers the invite via SMS + email. */
export function useReviewReferral() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      request: AmbassadorReferral;
      decision: 'approve' | 'decline';
      reason?: string;
      showReason?: boolean;
    }) => {
      const { request, decision } = input;
      const { data, error } = await supabase.rpc('review_ambassador_referral', {
        p_request_id: request.id,
        p_decision: decision,
        p_reason: input.reason || null,
        p_show_reason: !!input.showReason,
      } as any);
      if (error) throw error;
      const result = data as any;
      if (!result?.success) throw new Error(result?.error || 'Review failed');

      if (decision === 'approve') {
        // Deliver through the existing invite dispatcher (resend path), both channels.
        try {
          const { data: sendData, error: sendErr } = await supabase.functions.invoke('send-ambassador-invite', {
            body: {
              invite_id: result.invite_id,
              name: request.full_name,
              email: request.email || '',
              phone: request.phone || '',
              channel: 'both',
            },
          });
          if (sendErr) {
            const detail = (sendErr as any)?.context ? await (sendErr as any).context.text() : sendErr.message;
            return { ...result, sent: false, sendError: detail || sendErr.message };
          }
          return { ...result, sent: !!sendData?.success, sendLog: sendData?.send_log || [], sendError: sendData?.error };
        } catch (e) {
          return { ...result, sent: false, sendError: String(e) };
        }
      }
      return result;
    },
    onSuccess: (result: any, input) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['all-ambassador-invites'] });
      queryClient.invalidateQueries({ queryKey: ['ambassador-invite-send-events'] });
      if (input.decision === 'approve') {
        if (result.sent) {
          toast.success('Referral approved — invite sent by text and email');
        } else {
          toast.warning(`Approved, but invite delivery failed: ${result.sendError || 'unknown error'}. Resend from Invite Governance.`);
        }
      } else {
        toast.success('Referral declined');
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/** Owner-facing referral tree: every ambassador + who recruited them. */
export interface ReferralTreeNode {
  id: string;
  name: string | null;
  tracking_code: string | null;
  recruited_by_ambassador_id: string | null;
  created_at: string;
}

export function useReferralTree() {
  return useQuery({
    queryKey: ['ambassador-referral-tree'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassadors')
        .select('id, name, tracking_code, recruited_by_ambassador_id, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ReferralTreeNode[];
    },
  });
}

/** Public: resolve a referral code to the referrer's first name. */
export function useReferrerInfo(code: string | undefined) {
  return useQuery({
    queryKey: ['ambassador-referrer-info', code],
    queryFn: async () => {
      if (!code) return null;
      const { data, error } = await supabase.rpc('get_ambassador_referrer_info', {
        p_referral_code: code,
      } as any);
      if (error) throw error;
      return data as any;
    },
    enabled: !!code,
    retry: false,
  });
}

/** Public: submit the referral form (no account needed). */
export function useSubmitReferral() {
  return useMutation({
    mutationFn: async (input: {
      referralCode: string;
      fullName: string;
      email?: string;
      phone?: string;
      region?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase.rpc('submit_ambassador_referral', {
        p_referral_code: input.referralCode,
        p_full_name: input.fullName,
        p_email: input.email || null,
        p_phone: input.phone || null,
        p_region: input.region || null,
        p_notes: input.notes || null,
      } as any);
      if (error) throw error;
      const result = data as any;
      if (!result?.success) {
        const msg =
          result?.error === 'invalid_referral_code' ? 'This referral link is no longer valid.' :
          result?.error === 'contact_required' ? 'Please provide a phone number or email.' :
          result?.error || 'Submission failed';
        throw new Error(msg);
      }
      return result as { success: true; duplicate: boolean; request_id: string };
    },
  });
}
