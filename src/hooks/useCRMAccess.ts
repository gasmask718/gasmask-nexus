import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type CRMAccessRole = 'view' | 'edit' | 'admin';

export interface CRMAccess {
  id: string;
  user_id: string;
  crm_id: string;
  access_role: CRMAccessRole;
  granted_by: string | null;
  granted_at: string;
  revoked_at: string | null;
  is_active: boolean;
  notes: string | null;
  crm?: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface CRMInvitation {
  id: string;
  email: string;
  invite_token: string;
  invited_by: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by_user_id: string | null;
  notes: string | null;
  assignments?: CRMInvitationAssignment[];
  inviter?: {
    name: string;
    email: string;
  };
}

export interface CRMInvitationAssignment {
  id: string;
  invitation_id: string;
  crm_id: string;
  access_role: CRMAccessRole;
  crm?: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface SendInviteData {
  email: string;
  crmAssignments: Array<{
    crmId: string;
    accessRole: CRMAccessRole;
  }>;
  notes?: string;
}

// Hook to get all CRM access records for management
export function useCRMAccessList() {
  return useQuery({
    queryKey: ['crm-access-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_user_access')
        .select(`
          *,
          crm:businesses(id, name, slug)
        `)
        .eq('is_active', true)
        .order('granted_at', { ascending: false });

      if (error) throw error;
      return data as CRMAccess[];
    },
  });
}

// Hook to get current user's CRM access
export function useUserCRMAccess() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-crm-access', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('crm_user_access')
        .select(`
          *,
          crm:businesses(id, name, slug)
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .is('revoked_at', null);

      if (error) throw error;
      return data as CRMAccess[];
    },
    enabled: !!user?.id,
  });
}

// Hook to check if user can access a specific CRM
export function useCanAccessCRM(crmId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['can-access-crm', crmId, user?.id],
    queryFn: async () => {
      if (!user?.id || !crmId) return { canAccess: false, canEdit: false, isAdmin: false };

      const { data: canAccess } = await supabase.rpc('can_access_crm', {
        _user_id: user.id,
        _crm_id: crmId,
      });

      const { data: canEdit } = await supabase.rpc('can_edit_crm', {
        _user_id: user.id,
        _crm_id: crmId,
      });

      const { data: isAdmin } = await supabase.rpc('is_crm_admin', {
        _user_id: user.id,
        _crm_id: crmId,
      });

      return {
        canAccess: canAccess ?? false,
        canEdit: canEdit ?? false,
        isAdmin: isAdmin ?? false,
      };
    },
    enabled: !!user?.id && !!crmId,
  });
}

// Hook to get all invitations
export function useCRMInvitations() {
  return useQuery({
    queryKey: ['crm-invitations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_invitations')
        .select(`
          *,
          assignments:crm_invitation_assignments(
            *,
            crm:businesses(id, name, slug)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch inviter profiles separately
      const inviterIds = [...new Set(data?.map(d => d.invited_by) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', inviterIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      return (data || []).map(invitation => ({
        ...invitation,
        inviter: profileMap.get(invitation.invited_by) || undefined,
      })) as CRMInvitation[];
    },
  });
}

// Hook to send a new invitation
export function useSendCRMInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SendInviteData) => {
      const { data: response, error } = await supabase.functions.invoke('send-crm-invite', {
        body: data,
      });

      if (error) throw error;
      if (response.error) throw new Error(response.error);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-invitations'] });
      toast.success('Invitation sent successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send invitation');
    },
  });
}

// Hook to revoke an invitation
export function useRevokeCRMInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from('crm_invitations')
        .update({ status: 'revoked' })
        .eq('id', invitationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-invitations'] });
      toast.success('Invitation revoked');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to revoke invitation');
    },
  });
}

// Hook to resend an expired or revoked invitation
export function useResendCRMInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invitation: CRMInvitation) => {
      // Mark old invitation as expired if not already
      if (invitation.status === 'pending') {
        await supabase
          .from('crm_invitations')
          .update({ status: 'expired' })
          .eq('id', invitation.id);
      }

      // Get assignments for the invitation
      const assignments = invitation.assignments || [];
      if (assignments.length === 0) {
        throw new Error('No CRM assignments found for this invitation');
      }

      // Create new invitation via the edge function
      const { data: response, error } = await supabase.functions.invoke('send-crm-invite', {
        body: {
          email: invitation.email,
          crmAssignments: assignments.map(a => ({
            crmId: a.crm_id,
            accessRole: a.access_role,
          })),
          notes: invitation.notes || `Re-invitation (original: ${invitation.id})`,
        },
      });

      if (error) throw error;
      if (response.error) throw new Error(response.error);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-invitations'] });
      toast.success('New invitation sent successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to resend invitation');
    },
  });
}

// Hook to update CRM access
export function useUpdateCRMAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      accessId,
      accessRole,
    }: {
      accessId: string;
      accessRole: CRMAccessRole;
    }) => {
      const { error } = await supabase
        .from('crm_user_access')
        .update({ access_role: accessRole })
        .eq('id', accessId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-access-list'] });
      toast.success('Access updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update access');
    },
  });
}

// Hook to revoke CRM access
export function useRevokeCRMAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accessId: string) => {
      const { error } = await supabase
        .from('crm_user_access')
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
        })
        .eq('id', accessId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-access-list'] });
      toast.success('Access revoked');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to revoke access');
    },
  });
}
