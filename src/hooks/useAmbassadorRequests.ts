/**
 * useAmbassadorRequests — Hook for ambassador invite REQUEST pipeline
 * Ambassadors REQUEST, Admins APPROVE/REJECT.
 * No direct invite generation by ambassadors.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type RequestStatus = 'pending' | 'approved' | 'rejected';

export interface AmbassadorRequest {
  id: string;
  full_name: string;
  email: string;
  territory: string | null;
  justification: string;
  requested_by: string;
  requested_by_ambassador_id: string | null;
  status: RequestStatus;
  reviewed_by: string | null;
  review_notes: string | null;
  generated_invite_id: string | null;
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

// Ambassador: submit a request
export function useSubmitRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      full_name: string;
      email: string;
      territory?: string;
      justification: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

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
          email: input.email,
          territory: input.territory || null,
          justification: input.justification,
          requested_by: user.id,
          requested_by_ambassador_id: amb?.[0]?.id || null,
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

// Admin: approve request
export function useApproveRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ requestId, notes }: { requestId: string; notes?: string }) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Get the request details
      const { data: request, error: fetchErr } = await supabase
        .from('ambassador_invite_requests')
        .select('*')
        .eq('id', requestId)
        .single();
      if (fetchErr || !request) throw new Error('Request not found');

      // Generate invite via existing RPC
      const { data: inviteResult, error: inviteErr } = await supabase.rpc('create_ambassador_invite', {
        p_email: request.email || null,
        p_phone: null,
        p_region_id: null,
      });
      if (inviteErr) throw inviteErr;
      const result = inviteResult as any;
      if (!result?.success) throw new Error(result?.error || 'Failed to generate invite');

      // Update request status
      const { error: updateErr } = await supabase
        .from('ambassador_invite_requests')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          review_notes: notes || null,
          generated_invite_id: result.invite_id || null,
        })
        .eq('id', requestId);
      if (updateErr) throw updateErr;

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['all-ambassador-invites'] });
      toast.success('Request approved — invite generated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// Admin: reject request
export function useRejectRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ requestId, notes }: { requestId: string; notes: string }) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('ambassador_invite_requests')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          review_notes: notes,
        })
        .eq('id', requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Request rejected');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
