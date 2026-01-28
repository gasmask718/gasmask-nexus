/**
 * Ambassador Influencers Hook - MASTER GENIUS ARCHITECT
 * Lane-separated influencer management with safe unassignment (never delete)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export interface PortfolioInfluencer {
  assignment_id: string;
  influencer_id: string;
  name: string;
  username: string | null;
  platform: string | null;
  followers: number | null;
  engagement_rate: number | null;
  city: string | null;
  niche: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  assignment_type: 'assigned' | 'sourced' | 'referred';
  active: boolean;
  is_primary: boolean;
  commission_rate: number;
  start_date: string | null;
  assigned_at: string;
}

export function useAmbassadorInfluencers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get ambassador record for current user
  const ambassadorQuery = useQuery({
    queryKey: ['ambassador-self', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('ambassadors')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: !!user?.id,
  });

  const ambassadorId = ambassadorQuery.data?.id;

  // Fetch assigned influencers from influencer_assignments (RLS enforced)
  const influencersQuery = useQuery({
    queryKey: ['ambassador-portfolio-influencers', ambassadorId],
    queryFn: async () => {
      if (!ambassadorId) return [];

      const { data, error } = await supabase
        .from('influencer_assignments')
        .select(`
          id,
          influencer_id,
          assignment_type,
          active,
          is_primary,
          commission_rate,
          start_date,
          created_at,
          influencer:influencers!influencer_id (
            id,
            name,
            username,
            platform,
            followers,
            engagement_rate,
            city,
            niche,
            email,
            phone,
            status
          )
        `)
        .eq('ambassador_id', ambassadorId)
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform to PortfolioInfluencer format
      return (data || []).map((a: any): PortfolioInfluencer => ({
        assignment_id: a.id,
        influencer_id: a.influencer_id,
        name: a.influencer?.name || 'Unknown Influencer',
        username: a.influencer?.username,
        platform: a.influencer?.platform,
        followers: a.influencer?.followers,
        engagement_rate: a.influencer?.engagement_rate,
        city: a.influencer?.city,
        niche: a.influencer?.niche,
        email: a.influencer?.email,
        phone: a.influencer?.phone,
        status: a.influencer?.status,
        assignment_type: a.assignment_type || 'sourced',
        active: a.active,
        is_primary: a.is_primary,
        commission_rate: a.commission_rate || 0,
        start_date: a.start_date,
        assigned_at: a.created_at,
      }));
    },
    enabled: !!ambassadorId,
  });

  // MASTER GENIUS ARCHITECT: Unassign influencer (never delete, only deactivate)
  const unassignInfluencerMutation = useMutation({
    mutationFn: async (influencerId: string) => {
      if (!ambassadorId) throw new Error('Ambassador profile not found');

      const { error } = await supabase
        .from('influencer_assignments')
        .update({
          active: false,
          unassigned_at: new Date().toISOString(),
          unassigned_by: user?.id,
        })
        .eq('influencer_id', influencerId)
        .eq('ambassador_id', ambassadorId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ambassador-portfolio-influencers', ambassadorId] });
      toast.success('Influencer removed from your portfolio');
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove influencer: ${error.message}`);
    },
  });

  // Metrics
  const calculateMetrics = () => {
    const influencers = influencersQuery.data || [];
    return {
      total: influencers.length,
      assigned: influencers.filter(i => i.assignment_type === 'assigned').length,
      sourced: influencers.filter(i => i.assignment_type === 'sourced').length,
      referred: influencers.filter(i => i.assignment_type === 'referred').length,
      active: influencers.filter(i => i.status === 'active').length,
    };
  };

  return {
    ambassador: ambassadorQuery.data,
    influencers: influencersQuery.data || [],
    metrics: calculateMetrics(),
    isLoading: ambassadorQuery.isLoading || influencersQuery.isLoading,
    isError: ambassadorQuery.isError || influencersQuery.isError,
    // Mutations
    unassignInfluencer: unassignInfluencerMutation.mutateAsync,
    isUnassigning: unassignInfluencerMutation.isPending,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['ambassador-portfolio-influencers', ambassadorId] });
    },
  };
}
