import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { OrgRole, Permission, getRoleDefaults, generateInviteCode } from './permissionEngine';

export interface Organization {
  id: string;
  org_type: 'store' | 'wholesaler';
  name: string;
  owner_user_id: string | null;
  billing_email: string | null;
  logo_url: string | null;
  settings: Record<string, unknown>;
  status: 'active' | 'suspended' | 'pending';
  created_at: string;
}

export interface OrganizationUser {
  id: string;
  org_id: string;
  user_id: string;
  role: OrgRole;
  permissions: Permission[];
  is_active: boolean;
  joined_at: string;
  profile?: {
    name: string;
    email: string;
    avatar_url: string | null;
  };
}

export interface OrganizationInvite {
  id: string;
  org_id: string;
  invited_email: string;
  invited_role: OrgRole;
  invite_code: string;
  expires_at: string;
  accepted: boolean;
  created_at: string;
}

// Hook to get user's organizations
export function useUserOrganizations() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-organizations', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('organization_users')
        .select(`
          *,
          organization:organizations(*)
        `)
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) throw error;

      return (data || []).map(ou => ({
        ...ou,
        organization: ou.organization as Organization,
        permissions: (ou.permissions as Permission[]) || getRoleDefaults(ou.role as OrgRole),
      })) as (OrganizationUser & { organization: Organization })[];
    },
    enabled: !!user,
  });
}

// Hook to get a specific organization
export function useOrganization(orgId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['organization', orgId],
    queryFn: async () => {
      if (!orgId) return null;

      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single();

      if (error) throw error;
      return data as Organization;
    },
    enabled: !!user && !!orgId,
  });
}

// Hook to get organization members
export function useOrganizationMembers(orgId: string | undefined) {
  return useQuery({
    queryKey: ['organization-members', orgId],
    queryFn: async () => {
      if (!orgId) return [];

      // Get organization users
      const { data: members, error } = await supabase
        .from('organization_users')
        .select('*')
        .eq('org_id', orgId)
        .order('role', { ascending: true });

      if (error) throw error;

      // Get profiles for all members
      const userIds = members?.map(m => m.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return (members || []).map(member => ({
        ...member,
        permissions: (member.permissions as Permission[]) || getRoleDefaults(member.role as OrgRole),
        profile: profileMap.get(member.user_id) || undefined,
      })) as OrganizationUser[];
    },
    enabled: !!orgId,
  });
}

// Hook to get organization invites
export function useOrganizationInvites(orgId: string | undefined) {
  return useQuery({
    queryKey: ['organization-invites', orgId],
    queryFn: async () => {
      if (!orgId) return [];

      const { data, error } = await supabase
        .from('organization_invites')
        .select('*')
        .eq('org_id', orgId)
        .eq('accepted', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as OrganizationInvite[];
    },
    enabled: !!orgId,
  });
}

// Hook to manage organization
export function useOrganizationManagement(orgId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const createOrganization = useMutation({
    mutationFn: async (data: { name: string; org_type: 'store' | 'wholesaler'; billing_email?: string }) => {
      if (!user) throw new Error('Not authenticated');

      // Create organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: data.name,
          org_type: data.org_type,
          owner_user_id: user.id,
          billing_email: data.billing_email || user.email,
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Add user as owner
      const { error: memberError } = await supabase
        .from('organization_users')
        .insert({
          org_id: org.id,
          user_id: user.id,
          role: 'owner',
          permissions: getRoleDefaults('owner'),
        });

      if (memberError) throw memberError;

      return org as Organization;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-organizations'] });
      toast.success('Organization created');
    },
    onError: (error) => {
      toast.error(`Failed to create organization: ${error.message}`);
    },
  });

  const inviteMember = useMutation({
    mutationFn: async (data: { email: string; role: OrgRole }) => {
      if (!orgId) throw new Error('No organization selected');

      const inviteCode = generateInviteCode();

      const { error } = await supabase
        .from('organization_invites')
        .insert({
          org_id: orgId,
          invited_email: data.email,
          invited_role: data.role,
          invite_code: inviteCode,
          invited_by: user?.id,
        });

      if (error) throw error;

      // Log activity
      await supabase.from('org_activity_logs').insert({
        org_id: orgId,
        user_id: user?.id,
        activity_type: 'invite_sent',
        description: `Invited ${data.email} as ${data.role}`,
        metadata: { email: data.email, role: data.role },
      });

      return { inviteCode };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['organization-invites', orgId] });
      toast.success(`Invite sent! Code: ${data.inviteCode}`);
    },
    onError: (error) => {
      toast.error(`Failed to send invite: ${error.message}`);
    },
  });

  const updateMemberRole = useMutation({
    mutationFn: async (data: { memberId: string; role: OrgRole; permissions?: Permission[] }) => {
      if (!orgId) throw new Error('No organization selected');

      const { error } = await supabase
        .from('organization_users')
        .update({
          role: data.role,
          permissions: data.permissions || getRoleDefaults(data.role),
        })
        .eq('id', data.memberId);

      if (error) throw error;

      // Log activity
      await supabase.from('org_activity_logs').insert({
        org_id: orgId,
        user_id: user?.id,
        activity_type: 'role_updated',
        description: `Updated member role to ${data.role}`,
        metadata: { member_id: data.memberId, new_role: data.role },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-members', orgId] });
      toast.success('Member role updated');
    },
    onError: (error) => {
      toast.error(`Failed to update role: ${error.message}`);
    },
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      if (!orgId) throw new Error('No organization selected');

      const { error } = await supabase
        .from('organization_users')
        .update({ is_active: false })
        .eq('id', memberId);

      if (error) throw error;

      // Log activity
      await supabase.from('org_activity_logs').insert({
        org_id: orgId,
        user_id: user?.id,
        activity_type: 'member_removed',
        description: 'Removed team member',
        metadata: { member_id: memberId },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-members', orgId] });
      toast.success('Member removed');
    },
    onError: (error) => {
      toast.error(`Failed to remove member: ${error.message}`);
    },
  });

  const cancelInvite = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from('organization_invites')
        .delete()
        .eq('id', inviteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-invites', orgId] });
      toast.success('Invite cancelled');
    },
  });

  const acceptInvite = useMutation({
    mutationFn: async (inviteCode: string) => {
      if (!user) throw new Error('Not authenticated');

      // Find the invite
      const { data: invite, error: findError } = await supabase
        .from('organization_invites')
        .select('*')
        .eq('invite_code', inviteCode)
        .eq('accepted', false)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (findError || !invite) throw new Error('Invalid or expired invite code');

      // Add user to organization
      const { error: joinError } = await supabase
        .from('organization_users')
        .insert({
          org_id: invite.org_id,
          user_id: user.id,
          role: invite.invited_role,
          permissions: getRoleDefaults(invite.invited_role as OrgRole),
        });

      if (joinError) throw joinError;

      // Mark invite as accepted
      await supabase
        .from('organization_invites')
        .update({ accepted: true, accepted_at: new Date().toISOString() })
        .eq('id', invite.id);

      // Log activity
      await supabase.from('org_activity_logs').insert({
        org_id: invite.org_id,
        user_id: user.id,
        activity_type: 'member_joined',
        description: `Joined organization as ${invite.invited_role}`,
      });

      return invite;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-organizations'] });
      toast.success('Successfully joined organization!');
    },
    onError: (error) => {
      toast.error(`Failed to accept invite: ${error.message}`);
    },
  });

  return {
    createOrganization,
    inviteMember,
    updateMemberRole,
    removeMember,
    cancelInvite,
    acceptInvite,
  };
}

// Hook to get current user's role in an organization
export function useCurrentOrgRole(orgId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['current-org-role', orgId, user?.id],
    queryFn: async () => {
      if (!orgId || !user) return null;

      const { data, error } = await supabase
        .from('organization_users')
        .select('*')
        .eq('org_id', orgId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (error) return null;

      return {
        ...data,
        permissions: (data.permissions as Permission[]) || getRoleDefaults(data.role as OrgRole),
      } as OrganizationUser;
    },
    enabled: !!orgId && !!user,
  });
}
