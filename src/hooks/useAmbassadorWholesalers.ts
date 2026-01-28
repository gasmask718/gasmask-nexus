/**
 * Ambassador Wholesalers Hook - MASTER GENIUS ARCHITECT
 * Lane-separated wholesaler management with safe unassignment (never delete)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export interface PortfolioWholesaler {
  assignment_id: string;
  wholesaler_id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  status: string | null;
  assignment_type: 'assigned' | 'sourced' | 'referred';
  active: boolean;
  is_primary: boolean;
  commission_rate: number;
  start_date: string | null;
  assigned_at: string;
}

export function useAmbassadorWholesalers() {
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

  // Fetch assigned wholesalers from wholesaler_assignments (RLS enforced)
  const wholesalersQuery = useQuery({
    queryKey: ['ambassador-portfolio-wholesalers', ambassadorId],
    queryFn: async () => {
      if (!ambassadorId) return [];

      const { data, error } = await supabase
        .from('wholesaler_assignments')
        .select(`
          id,
          wholesaler_id,
          assignment_type,
          active,
          is_primary,
          commission_rate,
          start_date,
          created_at,
          wholesaler:wholesalers!wholesaler_id (
            id,
            name,
            contact_name,
            phone,
            email,
            address,
            city,
            state,
            status
          )
        `)
        .eq('ambassador_id', ambassadorId)
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform to PortfolioWholesaler format
      return (data || []).map((a: any): PortfolioWholesaler => ({
        assignment_id: a.id,
        wholesaler_id: a.wholesaler_id,
        name: a.wholesaler?.name || 'Unknown Wholesaler',
        contact_name: a.wholesaler?.contact_name,
        phone: a.wholesaler?.phone,
        email: a.wholesaler?.email,
        address: a.wholesaler?.address,
        city: a.wholesaler?.city,
        state: a.wholesaler?.state,
        status: a.wholesaler?.status,
        assignment_type: a.assignment_type || 'assigned',
        active: a.active,
        is_primary: a.is_primary,
        commission_rate: a.commission_rate || 0,
        start_date: a.start_date,
        assigned_at: a.created_at,
      }));
    },
    enabled: !!ambassadorId,
  });

  // MASTER GENIUS ARCHITECT: Unassign wholesaler (never delete, only deactivate)
  // "Remove from My Wholesalers" = deactivate assignment, wholesaler remains in system
  const unassignWholesalerMutation = useMutation({
    mutationFn: async (wholesalerId: string) => {
      if (!ambassadorId) throw new Error('Ambassador profile not found');

      const { error } = await supabase
        .from('wholesaler_assignments')
        .update({
          active: false,
          unassigned_at: new Date().toISOString(),
          unassigned_by: ambassadorId,
        })
        .eq('wholesaler_id', wholesalerId)
        .eq('ambassador_id', ambassadorId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ambassador-portfolio-wholesalers', ambassadorId] });
      toast.success('Wholesaler removed from your portfolio');
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove wholesaler: ${error.message}`);
    },
  });

  // Metrics
  const calculateMetrics = () => {
    const wholesalers = wholesalersQuery.data || [];
    return {
      total: wholesalers.length,
      assigned: wholesalers.filter(w => w.assignment_type === 'assigned').length,
      sourced: wholesalers.filter(w => w.assignment_type === 'sourced').length,
      referred: wholesalers.filter(w => w.assignment_type === 'referred').length,
      active: wholesalers.filter(w => w.status === 'active').length,
    };
  };

  return {
    ambassador: ambassadorQuery.data,
    wholesalers: wholesalersQuery.data || [],
    metrics: calculateMetrics(),
    isLoading: ambassadorQuery.isLoading || wholesalersQuery.isLoading,
    isError: ambassadorQuery.isError || wholesalersQuery.isError,
    // Mutations
    unassignWholesaler: unassignWholesalerMutation.mutateAsync,
    isUnassigning: unassignWholesalerMutation.isPending,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['ambassador-portfolio-wholesalers', ambassadorId] });
    },
  };
}
