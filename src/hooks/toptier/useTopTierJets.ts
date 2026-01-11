import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSimulationMode } from '@/contexts/SimulationModeContext';
import { toast } from 'sonner';

export interface TopTierJet {
  id: string;
  name: string;
  tail_number: string | null;
  jet_type: 'light' | 'midsize' | 'super_midsize' | 'heavy' | 'ultra_long_range' | null;
  manufacturer: string | null;
  model: string | null;
  year: number | null;
  status: 'available' | 'booked' | 'maintenance' | 'in_transit' | 'grounded';
  approval_status: 'approved' | 'pending' | 'rejected';
  is_partner_jet: boolean;
  partner_id: string | null;
  partner_name: string | null;
  passenger_capacity: number | null;
  range_nautical_miles: number | null;
  base_location: string | null;
  current_location: string | null;
  hourly_rate: number | null;
  daily_rate: number | null;
  total_charters: number;
  notes: string | null;
  maintenance_notes: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
  is_simulation: boolean;
}

export interface TopTierCharterRequest {
  id: string;
  jet_id: string | null;
  customer_name: string;
  customer_id: string | null;
  status: 'pending' | 'approved' | 'confirmed' | 'completed' | 'cancelled';
  departure_location: string | null;
  arrival_location: string | null;
  departure_date: string | null;
  departure_time: string | null;
  return_date: string | null;
  passenger_count: number | null;
  quoted_price: number | null;
  final_price: number | null;
  notes: string | null;
  special_requests: string | null;
  created_at: string;
  updated_at: string;
  is_simulation: boolean;
}

export function useTopTierJets() {
  const { simulationMode } = useSimulationMode();
  const queryClient = useQueryClient();

  const { data: jets = [], isLoading, error, refetch } = useQuery({
    queryKey: ['tt-jets', simulationMode],
    queryFn: async () => {
      const query = supabase
        .from('tt_private_jets')
        .select('*')
        .order('created_at', { ascending: false });

      if (simulationMode !== undefined) {
        query.eq('is_simulation', simulationMode);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as TopTierJet[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: Partial<Omit<TopTierJet, 'id' | 'created_at' | 'updated_at' | 'is_simulation' | 'total_charters'>>) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const insertData = {
        ...input,
        created_by: user?.id,
        is_simulation: simulationMode ?? false,
      };
      
      const { data, error } = await supabase
        .from('tt_private_jets')
        .insert(insertData as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tt-jets'] });
      queryClient.invalidateQueries({ queryKey: ['toptier-kpis'] });
      toast.success('Jet added successfully');
    },
    onError: (error) => {
      toast.error(`Failed to add jet: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TopTierJet> & { id: string }) => {
      const { data, error } = await supabase
        .from('tt_private_jets')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tt-jets'] });
      queryClient.invalidateQueries({ queryKey: ['toptier-kpis'] });
      toast.success('Jet updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update jet: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tt_private_jets')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tt-jets'] });
      queryClient.invalidateQueries({ queryKey: ['toptier-kpis'] });
      toast.success('Jet removed successfully');
    },
    onError: (error) => {
      toast.error(`Failed to remove jet: ${error.message}`);
    },
  });

  return {
    jets,
    isLoading,
    error,
    refetch,
    createJet: createMutation.mutate,
    updateJet: updateMutation.mutate,
    deleteJet: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

export function useTopTierCharters() {
  const { simulationMode } = useSimulationMode();
  const queryClient = useQueryClient();

  const { data: charters = [], isLoading, error, refetch } = useQuery({
    queryKey: ['tt-charters', simulationMode],
    queryFn: async () => {
      const query = supabase
        .from('tt_charter_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (simulationMode !== undefined) {
        query.eq('is_simulation', simulationMode);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as TopTierCharterRequest[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: Partial<Omit<TopTierCharterRequest, 'id' | 'created_at' | 'updated_at' | 'is_simulation'>>) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const insertData = {
        ...input,
        created_by: user?.id,
        is_simulation: simulationMode ?? false,
      };
      
      const { data, error } = await supabase
        .from('tt_charter_requests')
        .insert(insertData as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tt-charters'] });
      queryClient.invalidateQueries({ queryKey: ['toptier-kpis'] });
      toast.success('Charter request created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create charter request: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TopTierCharterRequest> & { id: string }) => {
      const { data, error } = await supabase
        .from('tt_charter_requests')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tt-charters'] });
      queryClient.invalidateQueries({ queryKey: ['toptier-kpis'] });
      toast.success('Charter request updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update charter request: ${error.message}`);
    },
  });

  return {
    charters,
    isLoading,
    error,
    refetch,
    createCharter: createMutation.mutate,
    updateCharter: updateMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
  };
}
