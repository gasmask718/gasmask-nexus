import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useLatestBriefing() {
  return useQuery({
    queryKey: ['latest-briefing'],
    queryFn: async () => {
      const { data } = await (supabase.from('weekly_briefings') as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });
}

export function useAllBriefings() {
  return useQuery({
    queryKey: ['all-briefings'],
    queryFn: async () => {
      const { data } = await (supabase.from('weekly_briefings') as any)
        .select('id, week_start, week_end, created_at')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });
}

export function useGenerateBriefing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('weekly-briefing');
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['latest-briefing'] });
      queryClient.invalidateQueries({ queryKey: ['all-briefings'] });
      toast.success('Weekly briefing generated');
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Failed to generate briefing');
    },
  });
}
