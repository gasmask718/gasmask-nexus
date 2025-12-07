import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Neighborhood {
  id: string;
  name: string;
  borough_id: string | null;
  borough?: { id: string; name: string } | null;
}

export function useNeighborhoods(boroughId?: string) {
  return useQuery({
    queryKey: ['neighborhoods', boroughId],
    queryFn: async () => {
      let query = supabase
        .from('neighborhoods')
        .select('*, borough:boroughs(id, name)')
        .order('name');
      
      if (boroughId && boroughId !== 'all') {
        query = query.eq('borough_id', boroughId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Neighborhood[];
    },
  });
}

export function useAddNeighborhood() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ name, boroughId }: { name: string; boroughId: string }) => {
      const { data, error } = await supabase
        .from('neighborhoods')
        .insert({ name, borough_id: boroughId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['neighborhoods'] });
      toast.success('Neighborhood added');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteNeighborhood() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('neighborhoods')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['neighborhoods'] });
      toast.success('Neighborhood deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
