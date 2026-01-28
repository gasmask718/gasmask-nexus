/**
 * Ambassador Recruits Hook - MASTER GENIUS ARCHITECT
 * Track ambassadors recruited by this ambassador (parent-child relationship)
 * Uses recruited_by_ambassador_id on ambassadors table
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export interface RecruitedAmbassador {
  id: string;
  name: string | null;
  phone_primary: string | null;
  phone_secondary: string | null;
  phone_whatsapp: string | null;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  tracking_code: string | null;
  tier: string | null;
  total_earnings: number;
  is_active: boolean;
  created_at: string;
  user_id: string | null;
}

export function useAmbassadorRecruits() {
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

  // Fetch ambassadors recruited by this ambassador
  const recruitsQuery = useQuery({
    queryKey: ['ambassador-portfolio-recruits', ambassadorId],
    queryFn: async () => {
      if (!ambassadorId) return [];

      const { data, error } = await supabase
        .from('ambassadors')
        .select('*')
        .eq('recruited_by_ambassador_id', ambassadorId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform to RecruitedAmbassador format
      return (data || []).map((a: any): RecruitedAmbassador => ({
        id: a.id,
        name: a.name,
        phone_primary: a.phone_primary,
        phone_secondary: a.phone_secondary,
        phone_whatsapp: a.phone_whatsapp,
        city: a.city,
        state: a.state,
        neighborhood: a.neighborhood,
        tracking_code: a.tracking_code,
        tier: a.tier,
        total_earnings: Number(a.total_earnings || 0),
        is_active: a.is_active,
        created_at: a.created_at,
        user_id: a.user_id,
      }));
    },
    enabled: !!ambassadorId,
  });

  // MASTER GENIUS ARCHITECT: Remove recruit relationship (set recruited_by to null)
  // Does NOT delete the ambassador, only removes the parent-child relationship
  const removeRecruitMutation = useMutation({
    mutationFn: async (recruitId: string) => {
      if (!ambassadorId) throw new Error('Ambassador profile not found');

      const { error } = await supabase
        .from('ambassadors')
        .update({
          recruited_by_ambassador_id: null,
        })
        .eq('id', recruitId)
        .eq('recruited_by_ambassador_id', ambassadorId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ambassador-portfolio-recruits', ambassadorId] });
      toast.success('Ambassador removed from your recruits');
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove recruit: ${error.message}`);
    },
  });

  // Metrics
  const calculateMetrics = () => {
    const recruits = recruitsQuery.data || [];
    return {
      total: recruits.length,
      active: recruits.filter(r => r.is_active).length,
      inactive: recruits.filter(r => !r.is_active).length,
      totalEarnings: recruits.reduce((sum, r) => sum + r.total_earnings, 0),
    };
  };

  return {
    ambassador: ambassadorQuery.data,
    recruits: recruitsQuery.data || [],
    metrics: calculateMetrics(),
    isLoading: ambassadorQuery.isLoading || recruitsQuery.isLoading,
    isError: ambassadorQuery.isError || recruitsQuery.isError,
    // Mutations
    removeRecruit: removeRecruitMutation.mutateAsync,
    isRemoving: removeRecruitMutation.isPending,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['ambassador-portfolio-recruits', ambassadorId] });
    },
  };
}
