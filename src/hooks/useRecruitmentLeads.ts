/**
 * useRecruitmentLeads — Hook for the ambassador_leads recruitment pipeline
 * Governs: Lead → Qualified → Invite → Converted
 * No invite creation without a qualified lead.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type RecruitmentLeadStatus = 'new' | 'contacted' | 'qualified' | 'invited' | 'converted' | 'dead';

export interface RecruitmentLead {
  id: string;
  created_by_ambassador_id: string;
  created_by_user_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  region: string | null;
  status: RecruitmentLeadStatus;
  notes: string | null;
  invite_id: string | null;
  created_at: string;
  updated_at: string;
}

const QUERY_KEY = 'recruitment-leads';

export function useRecruitmentLeads() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get current user's ambassador record
  const ambassadorQuery = useQuery({
    queryKey: ['ambassador-self-record', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('ambassadors')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1);
      if (error || !data?.length) return null;
      return data[0];
    },
    enabled: !!user?.id,
  });

  const ambassadorId = ambassadorQuery.data?.id ?? null;

  // Fetch recruitment leads
  const leadsQuery = useQuery({
    queryKey: [QUERY_KEY, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('ambassador_leads')
        .select('*')
        .eq('created_by_user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as RecruitmentLead[];
    },
    enabled: !!user?.id,
    refetchOnMount: 'always',
  });

  // Create lead
  const createLead = useMutation({
    mutationFn: async (input: {
      full_name: string;
      email?: string;
      phone?: string;
      region?: string;
      notes?: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');
      if (!ambassadorId) throw new Error('No ambassador profile found');

      const { error } = await supabase
        .from('ambassador_leads')
        .insert({
          created_by_ambassador_id: ambassadorId,
          created_by_user_id: user.id,
          full_name: input.full_name,
          email: input.email || null,
          phone: input.phone || null,
          region: input.region || null,
          notes: input.notes || null,
          status: 'new' as RecruitmentLeadStatus,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Recruitment lead added');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Update lead
  const updateLead = useMutation({
    mutationFn: async (input: {
      id: string;
      full_name?: string;
      email?: string;
      phone?: string;
      region?: string;
      notes?: string;
      status?: RecruitmentLeadStatus;
    }) => {
      const updates: Record<string, any> = {};
      if (input.full_name !== undefined) updates.full_name = input.full_name;
      if (input.email !== undefined) updates.email = input.email || null;
      if (input.phone !== undefined) updates.phone = input.phone || null;
      if (input.region !== undefined) updates.region = input.region || null;
      if (input.notes !== undefined) updates.notes = input.notes || null;
      if (input.status !== undefined) updates.status = input.status;

      const { error } = await supabase
        .from('ambassador_leads')
        .update(updates)
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Lead updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Generate invite for a qualified lead
  const generateInvite = useMutation({
    mutationFn: async (lead: RecruitmentLead) => {
      if (lead.status !== 'qualified') {
        throw new Error('Lead must be qualified before generating an invite');
      }
      if (lead.invite_id) {
        throw new Error('This lead already has an invite');
      }

      // Call existing invite RPC
      const { data, error } = await supabase.rpc('create_ambassador_invite', {
        p_email: lead.email || null,
        p_phone: lead.phone || null,
        p_region_id: null,
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.success) throw new Error(result?.error || 'Failed to create invite');

      // Link invite to lead and update status
      const { error: updateError } = await supabase
        .from('ambassador_leads')
        .update({
          invite_id: result.invite_id,
          status: 'invited' as RecruitmentLeadStatus,
        })
        .eq('id', lead.id);
      if (updateError) throw updateError;

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['my-ambassador-invites'] });
      toast.success('Invite generated and linked to lead');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Status counts
  const statusCounts = (leadsQuery.data || []).reduce(
    (acc, lead) => {
      acc[lead.status] = (acc[lead.status] || 0) + 1;
      return acc;
    },
    {} as Record<RecruitmentLeadStatus, number>,
  );

  return {
    leads: leadsQuery.data || [],
    isLoading: leadsQuery.isLoading || ambassadorQuery.isLoading,
    ambassadorId,
    statusCounts,
    createLead,
    updateLead,
    generateInvite,
  };
}
