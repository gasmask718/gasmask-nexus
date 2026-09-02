/**
 * Hook for ambassador invite operations
 * Server-side enforced: token generation, validation, acceptance
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { isValidRecipientEmail, normalizeRecipientEmail } from '@/lib/validation/recipientEmail';


export interface AmbassadorInvite {
  id: string;
  invited_by_ambassador_id: string;
  invited_by_user_id: string;
  invite_token: string;
  email: string | null;
  phone: string | null;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expires_at: string;
  used_at: string | null;
  used_by_user_id: string | null;
  created_at: string;
  revoked_at: string | null;
  revoke_reason: string | null;
}

// Check if global invite toggle is enabled
export function useInvitesEnabled() {
  return useQuery({
    queryKey: ['ambassador-invites-enabled'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'ambassador_invites_enabled')
        .maybeSingle();
      if (error) return true; // default enabled
      return (data?.setting_value as any)?.enabled ?? true;
    },
  });
}

// Get my invites (ambassador)
export function useMyInvites() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-ambassador-invites', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('ambassador_invites')
        .select('*')
        .eq('invited_by_user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as AmbassadorInvite[];
    },
    enabled: !!user?.id,
  });
}

// Get all invites (admin/owner)
export function useAllInvites() {
  return useQuery({
    queryKey: ['all-ambassador-invites'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassador_invites')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as AmbassadorInvite[];
    },
  });
}

// Create invite
export function useCreateInvite() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ email, phone, targetAmbassadorId }: { email?: string; phone?: string; targetAmbassadorId?: string }) => {
      const { data, error } = await supabase.rpc('create_ambassador_invite', {
        p_email: email || null,
        p_phone: phone || null,
        p_region_id: null,
        p_target_ambassador_id: targetAmbassadorId || null,
      } as any);
      if (error) throw error;
      const result = data as any;
      if (!result?.success) throw new Error(result?.error || 'Failed to create invite');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-ambassador-invites'] });
      toast.success('Invite created successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

// Revoke invite (admin/owner)
export function useRevokeInvite() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ inviteId, reason }: { inviteId: string; reason?: string }) => {
      const { data, error } = await supabase.rpc('revoke_ambassador_invite', {
        p_invite_id: inviteId,
        p_reason: reason || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-ambassador-invites'] });
      queryClient.invalidateQueries({ queryKey: ['my-ambassador-invites'] });
      toast.success('Invite revoked');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

// Validate token (public)
export function useValidateInviteToken(token: string | null) {
  return useQuery({
    queryKey: ['validate-ambassador-invite', token],
    queryFn: async () => {
      if (!token) return null;
      const { data, error } = await supabase.rpc('validate_ambassador_invite', {
        p_token: token,
      });
      if (error) throw error;
      return data as any;
    },
    enabled: !!token,
  });
}

// Toggle global invites (admin/owner)
export function useToggleInvites() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from('system_settings')
        .update({ setting_value: { enabled } as any })
        .eq('setting_key', 'ambassador_invites_enabled');
      if (error) throw error;
    },
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ['ambassador-invites-enabled'] });
      toast.success(enabled ? 'Ambassador invites enabled' : 'Ambassador invites disabled');
    },
  });
}

// Send a new invite (create + deliver via SMS/email)
export function useSendAmbassadorInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      name?: string;
      email?: string;
      phone?: string;
      channel: 'sms' | 'email' | 'both';
      targetAmbassadorId?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('send-ambassador-invite', {
        body: {
          name: payload.name || '',
          email: payload.email || '',
          phone: payload.phone || '',
          channel: payload.channel,
          target_ambassador_id: payload.targetAmbassadorId || null,
        },
      });
      if (error) {
        const details = (error as any)?.context ? await (error as any).context.text() : error.message;
        throw new Error(details || error.message);
      }
      const r = data as any;
      if (!r?.success) throw new Error(r?.error || 'Invite send failed');
      return r as { invite_id: string; token: string; link: string; send_log: any[] };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-ambassador-invites'] });
      queryClient.invalidateQueries({ queryKey: ['all-ambassador-invites'] });
      toast.success('Invite sent');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// Resend an existing pending invite. An optional corrected `email` is applied
// to the SAME invite (same id, token, approval metadata and attribution) —
// never a duplicate invite.
export function useResendAmbassadorInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ inviteId, channel = 'both', email }: { inviteId: string; channel?: 'sms' | 'email' | 'both'; email?: string }) => {
      const corrected = normalizeRecipientEmail(email);
      if (corrected && !isValidRecipientEmail(corrected)) {
        throw new Error('That email is not a valid address (expected email@example.com).');
      }
      const { data, error } = await supabase.functions.invoke('send-ambassador-invite', {
        body: { invite_id: inviteId, channel, ...(corrected ? { email: corrected } : {}) },
      });
      if (error) {
        const details = (error as any)?.context ? await (error as any).context.text() : error.message;
        throw new Error(details || error.message);
      }
      const r = data as any;
      if (r?.email_invalid && !r?.success) {
        throw new Error('Email not sent — the invite\'s contact email is invalid. Use "Fix email" to correct it, then resend.');
      }
      if (!r?.success) throw new Error(r?.error || 'Resend failed');
      return r;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-ambassador-invites'] });
      queryClient.invalidateQueries({ queryKey: ['all-ambassador-invites'] });
      queryClient.invalidateQueries({ queryKey: ['ambassador-invite-send-events'] });
      toast.success('Invite resent');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}


// Delivery history: which channels each invite was sent over, and when.
// RLS: actors read their own send events; admin/owner read all.
export function useInviteSendEvents(inviteIds: string[]) {
  const key = [...inviteIds].sort().join(',');
  return useQuery({
    queryKey: ['ambassador-invite-send-events', key],
    queryFn: async () => {
      if (!inviteIds.length) return [];
      const { data, error } = await supabase
        .from('ambassador_invite_events')
        .select('invite_id, event_type, created_at, metadata')
        .in('invite_id', inviteIds)
        .eq('event_type', 'sent')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as { invite_id: string; event_type: string; created_at: string; metadata: any }[];
    },
    enabled: inviteIds.length > 0,
  });
}
