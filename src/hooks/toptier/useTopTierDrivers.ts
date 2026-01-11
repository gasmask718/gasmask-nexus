import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSimulationMode } from '@/hooks/useSimulationMode';
import { toast } from 'sonner';

export interface TopTierDriver {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
  status: 'active' | 'inactive' | 'on_leave' | 'terminated';
  duty_status: 'on_duty' | 'off_duty' | 'break';
  assignment_status: 'assigned' | 'unassigned' | 'pending';
  has_vehicle: boolean;
  vehicle_id: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  vehicle_color: string | null;
  license_plate: string | null;
  intake_notes: string | null;
  admin_notes: string | null;
  hired_date: string | null;
  rating: number;
  total_trips: number;
  created_at: string;
  updated_at: string;
  is_simulation: boolean;
}

export type CreateDriverInput = Omit<TopTierDriver, 'id' | 'full_name' | 'created_at' | 'updated_at' | 'is_simulation'>;

export function useTopTierDrivers() {
  const { simulationMode } = useSimulationMode();
  const queryClient = useQueryClient();

  const { data: drivers = [], isLoading, error, refetch } = useQuery({
    queryKey: ['tt-drivers', simulationMode],
    queryFn: async () => {
      const query = supabase
        .from('tt_drivers')
        .select('*')
        .order('created_at', { ascending: false });

      if (simulationMode !== undefined) {
        query.eq('is_simulation', simulationMode);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as TopTierDriver[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: Partial<CreateDriverInput>) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('tt_drivers')
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
      queryClient.invalidateQueries({ queryKey: ['tt-drivers'] });
      queryClient.invalidateQueries({ queryKey: ['toptier-kpis'] });
      toast.success('Driver added successfully');
    },
    onError: (error) => {
      toast.error(`Failed to add driver: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TopTierDriver> & { id: string }) => {
      const { data, error } = await supabase
        .from('tt_drivers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tt-drivers'] });
      queryClient.invalidateQueries({ queryKey: ['toptier-kpis'] });
      toast.success('Driver updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update driver: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tt_drivers')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tt-drivers'] });
      queryClient.invalidateQueries({ queryKey: ['toptier-kpis'] });
      toast.success('Driver removed successfully');
    },
    onError: (error) => {
      toast.error(`Failed to remove driver: ${error.message}`);
    },
  });

  return {
    drivers,
    isLoading,
    error,
    refetch,
    createDriver: createMutation.mutate,
    updateDriver: updateMutation.mutate,
    deleteDriver: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
