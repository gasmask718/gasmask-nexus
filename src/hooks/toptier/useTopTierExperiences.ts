import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSimulationMode } from '@/hooks/useSimulationMode';
import { toast } from 'sonner';

export interface TopTierExperience {
  id: string;
  title: string;
  description: string | null;
  category: 'dining' | 'entertainment' | 'wellness' | 'adventure' | 'cultural' | 'nightlife' | 'shopping' | 'general';
  status: 'available' | 'booked' | 'pending' | 'completed' | 'cancelled';
  availability: 'open' | 'limited' | 'sold_out' | 'by_request';
  is_partner_provided: boolean;
  partner_id: string | null;
  partner_name: string | null;
  is_complimentary: boolean;
  price: number | null;
  revenue_generated: number;
  scheduled_date: string | null;
  scheduled_time: string | null;
  duration_hours: number | null;
  location: string | null;
  notes: string | null;
  special_requirements: string | null;
  max_guests: number | null;
  current_guests: number;
  created_at: string;
  updated_at: string;
  is_simulation: boolean;
}

export type CreateExperienceInput = Omit<TopTierExperience, 'id' | 'created_at' | 'updated_at' | 'is_simulation' | 'revenue_generated' | 'current_guests'>;

export function useTopTierExperiences() {
  const { simulationMode } = useSimulationMode();
  const queryClient = useQueryClient();

  const { data: experiences = [], isLoading, error, refetch } = useQuery({
    queryKey: ['tt-experiences', simulationMode],
    queryFn: async () => {
      const query = supabase
        .from('tt_experiences')
        .select('*')
        .order('created_at', { ascending: false });

      if (simulationMode !== undefined) {
        query.eq('is_simulation', simulationMode);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as TopTierExperience[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: Partial<CreateExperienceInput>) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('tt_experiences')
        .insert({
          ...input,
          created_by: user?.id,
          is_simulation: simulationMode ?? false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tt-experiences'] });
      queryClient.invalidateQueries({ queryKey: ['toptier-kpis'] });
      toast.success('Experience added successfully');
    },
    onError: (error) => {
      toast.error(`Failed to add experience: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TopTierExperience> & { id: string }) => {
      const { data, error } = await supabase
        .from('tt_experiences')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tt-experiences'] });
      queryClient.invalidateQueries({ queryKey: ['toptier-kpis'] });
      toast.success('Experience updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update experience: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tt_experiences')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tt-experiences'] });
      queryClient.invalidateQueries({ queryKey: ['toptier-kpis'] });
      toast.success('Experience removed successfully');
    },
    onError: (error) => {
      toast.error(`Failed to remove experience: ${error.message}`);
    },
  });

  return {
    experiences,
    isLoading,
    error,
    refetch,
    createExperience: createMutation.mutate,
    updateExperience: updateMutation.mutate,
    deleteExperience: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
