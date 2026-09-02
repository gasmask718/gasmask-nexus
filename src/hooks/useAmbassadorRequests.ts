/**
 * useAmbassadorRequests — Hook for the ambassador invite REQUEST pipeline
 * (ambassador_invite_requests). Ambassadors REQUEST, owner/admin APPROVE/REJECT.
 *
 * Review runs through the review_ambassador_invite_request RPC, which creates
 * the invite with the REQUESTER's attribution (invited_by_ambassador_id) and
 * stamps owner_approved_at/by. Approval then delivers the invite by SMS + email
 * through send-ambassador-invite. Public referral-link submissions land in the
 * same table (source='public_referral') via submit_ambassador_referral.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type RequestStatus = 'pending' | 'approved' | 'rejected';

export interface AmbassadorRequest {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  territory: string | null;
  justification: string | null;
  requested_by: string;
  requested_by_ambassador_id: string | null;
  source: string;
  status: RequestStatus;
  reviewed_by: string | null;
  review_notes: string | null;
  show_review_notes: boolean;
  generated_invite_id: string | null;
  resulting_ambassador_id: string | null;
  created_at: string;
  updated_at: string;
}

const QUERY_KEY = 'ambassador-invite-requests';

// Ambassador: fetch my requests
export function useMyRequests() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [QUERY_KEY, 'mine', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('ambassador_invite_requests')
        .select('*')
        .eq('requested_by', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as AmbassadorRequest[];
    },
    enabled: !!user?.id,
  });
}

// Admin: fetch all requests
export function useAllRequests() {
  return useQuery({
    queryKey: [QUERY_KEY, 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassador_invite_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as AmbassadorRequest[];
    },
  });
}

// Ambassador: submit a request (phone optional — a recruit may be text-only)
export function useSubmitRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      full_name: string;
      email?: string;
      phone?: string;
      territory?: string;
      justification: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');
      if (!input.email?.trim() && !input.phone?.trim()) {
        throw new Error('Give at least one way to reach them — email or phone');
      }

      // Get ambassador ID
      const { data: amb } = await supabase
        .from('ambassadors')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1);

      const { error } = await supabase
        .from('ambassador_invite_requests')
        .insert({
          full_name: input.full_name,
          email: input.email?.trim() || null,
          phone: input.phone?.trim() || null,
          territory: input.territory || null,
          justification: input.justification,
          requested_by: user.id,
          requested_by_ambassador_id: amb?.[0]?.id || null,
          source: 'ambassador_request',
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Request submitted for review');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// Admin: approve request → invite created with requester's attribution +
// owner approval stamp, then delivered by text and email.
export function useApproveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ request, notes }: { request: AmbassadorRequest; notes?: string }) => {
      const { data, error } = await supabase.rpc('review_ambassador_invite_request', {
        p_request_id: request.id,
        p_decision: 'approve',
        p_notes: notes || null,
        p_show_notes: true,
      } as any);
      if (error) throw error;
      const result = data as any;
      if (!result?.success) throw new Error(result?.error || 'Failed to approve request');

      // Deliver through the existing dispatcher (resend path), both channels.
      // The recipient email is validated dispatcher-side: an invalid address is
      // reported back as email_invalid instead of being handed to the provider.
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
        return {
          ...result,
          sent: !!sendData?.success,
          emailInvalid: !!sendData?.email_invalid,
          invalidEmail: sendData?.invalid_email,
          sendError: sendData?.error,
        };
      } catch (e) {
        return { ...result, sent: false, sendError: String(e) };
      }
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['all-ambassador-invites'] });
      queryClient.invalidateQueries({ queryKey: ['ambassador-invite-send-events'] });
      if (result?.sent) {
        toast.success('Request approved — invite sent by text and email');
      } else if (result?.emailInvalid) {
        toast.warning(
          'Approved. Invite created, but email was not sent because the contact email is invalid. Correct the email and resend the invite from Invite Governance.',
        );
      } else {
        toast.warning(`Approved and invite created, but delivery failed: ${result?.sendError || 'unknown error'}. Resend from Invite Governance.`);
      }
    },

    onError: (err: Error) => toast.error(err.message),
  });
}

// Admin: reject request (reason required)
export function useRejectRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, notes, showNotes = true }: { requestId: string; notes: string; showNotes?: boolean }) => {
      const { data, error } = await supabase.rpc('review_ambassador_invite_request', {
        p_request_id: requestId,
        p_decision: 'decline',
        p_notes: notes,
        p_show_notes: showNotes,
      } as any);
      if (error) throw error;
      const result = data as any;
      if (!result?.success) throw new Error(result?.error || 'Failed to reject request');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Request rejected');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
